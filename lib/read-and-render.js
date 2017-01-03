/* read-and-render.js
 *
 * This file brings together much of the other logic in lib and performs card rendering almost all the way from start to finish.  Input is a path to the config file; output is a list of SVG strings.  The CLI, in bin/card-creatr.js, does the final step of either printing the SVG to disk or converting it to a PNG/PDF and printing that to disk.
 *
 * Although this is written massively async, there are two main CPU-bound tasks that block the event loop:
 *   pug.js -> compile template
 *   opentype.js -> parse font buffer
 * It would be good to move those tasks to the thread pool.
 */

"use strict";

const async = require("async");
const CardRenderer = require("./render");
const CcsbReader = require("./ccsb");
const csv = require("./csv");
const fs = require("fs");
const hjson = require("hjson");
const log = require("./logger")("read-and-render");
const mime = require("mime");
const Options = require("./options");
const PageRenderer = require("../lib/page");
const path = require("path");
const rsvg = require("../lib/rsvg");
const streams = require("memory-streams");
const SvgHolder = require("../lib/svg");
const WordWrappr = require("word-wrappr");
const utils = require("./utils");

// Note: *.ccsb stands for "Card Creatr Studio Bundle"
// and *.ccst stands for "Card Creatr Studio Template"
mime.define({
	"application/x-ccs-bundle": ["ccsb"],
	"application/x-ccs-template": ["ccst"],
});


class ReadAndRender {
	constructor(path, optionsOverride, optionsFallback) {
		log.trace("constructor");
		this.options = new Options();
		if (optionsFallback) {
			// Both arguments: override and fallback
			this.options.addOverride(optionsOverride, "");
			this.options.addFallback(optionsFallback, "");
		} else {
			// One argument: fallback only
			this.options.addFallback(optionsOverride, "");
		}
		this.options.addDefaultFallback();

		if (path) {
			let type = mime.lookup(path);
			if (type === "application/json" || type === "text/hjson") {
				this.configPath = path;
			} else if (type === "application/x-ccs-bundle") {
				this.ccsb = new CcsbReader(path);
			} else {
				throw new Error("Unknown config file type: " + type);
			}
		}
	}

	load(next) {
		async.auto({
			"configContent": (_next) => {
				log.trace("configContent");
				if (this.configPath) {
					fs.readFile(this.configPath, _next);
				} else if (this.ccsb) {
					async.waterfall([
						(__next) => {
							this.ccsb.load(__next);
						},
						(__next) => {
							this.ccsb.readFile(CcsbReader.CONFIG_PATH, __next);
						}
					], _next);
				} else {
					process.nextTick(() => {
						_next(null, new Buffer(0));
					});
				}
			},
			"optionTemplate": (_next) => {
				log.trace("optionTemplate");
				this.options.onceLoaded("/template", _next);
			},
			"optionData": (_next) => {
				log.trace("optionData");
				this.options.onceLoaded("/data", _next);
			},
			"optionQuery": (_next) => {
				log.trace("optionQuery");
				this.options.onceLoaded("/query", _next);
			},
			"optionsAll": ["configContent", (results, _next) => {
				log.trace("optionsAll");
				// Config values override fallback options values.
				var config = hjson.parse(results.configContent.toString("utf-8"));
				if (this.configPath) {
					this.options.addPrimary(config, path.dirname(this.configPath));
				} else if (this.ccsb) {
					this.options.addPrimary({
						"template (path)": CcsbReader.TEMPLATE_PATH,
						"data (path)": CcsbReader.DATA_PATH
					}, this.ccsb.readFile.bind(this.ccsb));
					this.options.addPrimary(config, this.ccsb.readFile.bind(this.ccsb));
				}
				this.options.load(_next);
			}],
			"renderer": (_next) => {
				log.trace("renderer");
				this.renderer = new CardRenderer();
				this.renderer.load(_next);
			},
			"rendererBuild": ["optionTemplate", (results, _next) => {
				log.trace("rendererBuild");
				var templateString = results.optionTemplate.buffer.toString("utf-8");
				this.renderer.build(templateString);
				_next(null);
			}],
			"cardData": ["optionData", (results, _next) => {
				log.trace("cardData");
				var buffer = results.optionData.buffer;
				csv.csvBufferToObjects(buffer, _next);
			}],
			"cards": ["optionQuery", "optionData", "cardData", (results, _next) => {
				log.trace("cards");
				var rows = results.cardData;
				var rowsToProcess = rows.filter((row) => {
					return utils.satisfiesQuery(row, results.optionQuery);
				});
				async.map(
					rowsToProcess,
					(row, __next) => {
						var cardOptions = new Options();
						cardOptions.addPrimary(row, results.optionData.dirname);
						cardOptions.load(__next);
					},
					_next
				);
			}],
			"collect": ["cards", (results, _next) => {
				log.trace("collect");
				this.cards = results.cards;
				_next(null);
			}]
		}, next);
	}

	loadSync() {
		// Load all options data.
		// Config values override fallback options values.
		log.trace("configContent");
		var configContent;
		if (this.configPath) {
			configContent = fs.readFileSync(this.configPath);
		} else if (this.ccsb) {
			this.ccsb.loadSync();
			configContent = this.ccsb.readFileSync(CcsbReader.CONFIG_PATH);
		} else {
			configContent = new Buffer(0);
		}
		var config = hjson.parse(configContent.toString("utf-8"));
		if (this.configPath) {
			this.options.addPrimary(config, path.dirname(this.configPath));
		} else if (this.ccsb) {
			this.options.addPrimary({
				"template (path)": CcsbReader.TEMPLATE_PATH,
				"data (path)": CcsbReader.DATA_PATH
			}, this.ccsb.readFileSync.bind(this.ccsb));
			this.options.addPrimary(config, this.ccsb.readFileSync.bind(this.ccsb));
		}
		this.options.loadSync();

		// Load the renderer.
		log.trace("mixinsContent");
		var templateString = this.options.get("/template").buffer.toString("utf-8");
		this.renderer = new CardRenderer;
		this.renderer.loadSync();
		this.renderer.build(templateString);

		// Load the card data.
		log.trace("csvString");
		var buffer = this.options.get("/data").buffer;
		var rows = csv.csvBufferToObjectsSync(buffer);
		var rowsToProcess = rows.filter((row) => {
			return utils.satisfiesQuery(row, this.options.get("/query"));
		});
		this.cards = rowsToProcess.map((row) => {
			var cardOptions = new Options();
			cardOptions.addPrimary(row, this.options.get("/data").dirname);
			return cardOptions.loadSync();
		});
	}

	run(page, multiples, format) {
		// Check preconditions
		if (this.cards.length === 0) {
			throw new Error("No cards were found matching your query.");
		}

		// Perform the render.
		log.trace("renderedCards");
		var renderedCards = this.cards.map((cardOptions) => {
			return this.renderer.render(cardOptions, this.options, this.options.get("/viewports/card"));
		});

		// Duplicate cards as needed.
		log.trace("multiples");
		var cards = utils.multiplyCards(this.cards, renderedCards, multiples);

		// Finalize the SVG.
		log.trace("finalizing");
		var dimensions;
		var svgHolder = new SvgHolder();
		svgHolder.fonts = this.options.get("/fonts");
		svgHolder.writeFontFaceCSS = (this.options.get("/fontRenderMode") === "auto");
		if (page !== -1) {
			let pageRenderer = new PageRenderer(this.options.get("/viewports/page"));
			dimensions = this.options.get("/dimensions/page");
			svgHolder.width = dimensions.width + dimensions.unit;
			svgHolder.height = dimensions.height + dimensions.unit;
			svgHolder.content = pageRenderer.render(cards)[page-1];
		} else {
			dimensions = this.options.get("/dimensions/card");
			svgHolder.width = dimensions.width + dimensions.unit;
			svgHolder.height = dimensions.height + dimensions.unit;
			svgHolder.content = cards[0];
		}

		// Return buffer.
		log.trace("output");
		var writeStream = new streams.WritableStream();
		svgHolder.finalize(writeStream);
		var svgBuffer = writeStream.toBuffer();
		if (format === "svg") {
			log.trace("svg");
			return svgBuffer;
		} else if (format === "png" || format === "pdf") {
			log.trace("rsvg");
			let rasterBuffer = rsvg.render(svgBuffer, dimensions, format);
			return rasterBuffer;
		} else {
			throw new Error("Unknown format: " + format);
		}
	}
}

module.exports = ReadAndRender;

