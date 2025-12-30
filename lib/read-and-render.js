/*
 * Copyright (C) 2019 Shane F. Carr
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

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
const rasterize = require("../lib/rasterize");
const streamBuffers = require("stream-buffers");
const SvgHolder = require("../lib/svg");
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
						_next(null, Buffer.alloc(0));
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
			"jsonContent": ["configContent", (results, _next) => {
				if (this.ccsb) {
					this.ccsb.readFile(CcsbReader.JSON_PATH, _next);
				} else {
					// TODO: Add command-line option to specify fields.json path if not using a ccsb file.
					process.nextTick(() => {
						_next(null, Buffer.from("{}"));
					});
				}
			}],
			"optionsAll": ["configContent", "jsonContent", (results, _next) => {
				log.trace("optionsAll");
				// Config values override fallback options values.
				var config = hjson.parse(results.configContent.toString("utf-8"));
				var jsonObj = JSON.parse((results.jsonContent || "{}").toString("utf-8"));
				if (this.configPath) {
					this.options.addPrimary(config, path.dirname(this.configPath));
				} else if (this.ccsb) {
					this.options.addPrimary({
						"template (path)": CcsbReader.TEMPLATE_PATH,
						"data (path)": CcsbReader.DATA_PATH
					}, this.ccsb.readFile.bind(this.ccsb));
					this.options.addPrimary(config, this.ccsb.readFile.bind(this.ccsb));
					// Add the fonts from fields.json
					// TODO: This is duplicated from CCS store.js
					let intermediate = {};
					for (let fontInfo of (jsonObj.fonts || [])) {
						intermediate[fontInfo.name + " (font)"] = fontInfo.filename;
					}
					this.options.addPrimary({ fonts: intermediate }, this.ccsb.readFile.bind(this.ccsb));
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
		var configContent, jsonContent;
		if (this.configPath) {
			configContent = fs.readFileSync(this.configPath);
		} else if (this.ccsb) {
			this.ccsb.loadSync();
			configContent = this.ccsb.readFileSync(CcsbReader.CONFIG_PATH);
			jsonContent = this.ccsb.readFileSync(CcsbReader.JSON_PATH);
		} else {
			configContent = Buffer.alloc(0);
		}
		var config = hjson.parse(configContent.toString("utf-8"));
		var jsonObj = JSON.parse((jsonContent || "{}").toString("utf-8"));
		if (this.configPath) {
			this.options.addPrimary(config, path.dirname(this.configPath));
		} else if (this.ccsb) {
			this.options.addPrimary({
				"template (path)": CcsbReader.TEMPLATE_PATH,
				"data (path)": CcsbReader.DATA_PATH
			}, this.ccsb.readFileSync.bind(this.ccsb));
			this.options.addPrimary(config, this.ccsb.readFileSync.bind(this.ccsb));
			// Add the fonts from fields.json
			// TODO: This is duplicated from CCS store.js
			let intermediate = {};
			for (let fontInfo of (jsonObj.fonts || [])) {
				intermediate[fontInfo.name + " (font)"] = fontInfo.filename;
			}
			this.options.addPrimary({ fonts: intermediate }, this.ccsb.readFileSync.bind(this.ccsb));
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

	run(page, multiples, format, next) {
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
		var svgHolder = new SvgHolder();
		svgHolder.fonts = this.options.get("/fonts");
		svgHolder.writeFontFaceCSS = (this.options.get("/fontRenderMode") === "auto");
		if (page === -1) {
			svgHolder.dims = this.options.get("/dimensions/card");
			svgHolder.content = cards[0];
		} else {
			let pageRenderer = new PageRenderer(this.options.get("/viewports/page"), this.options.get("/layoutStrategy"), this.options.get("/renderReversed"));
			svgHolder.dims = this.options.get("/dimensions/page");
			if (page === -2) {
				let output = pageRenderer.renderConcatenated(cards);
				svgHolder.content = output.string;
				svgHolder.numPages = output.numPages;
			} else if (page === -3) {
				let output = pageRenderer.renderConcatenated(cards, { cardBacks: cards });
				svgHolder.content = output.string;
				svgHolder.numPages = output.numPages;
			} else {
				svgHolder.content = pageRenderer.render(cards)[page-1];
			}
		}

		var writeStream, svgBuffer;

		log.trace("output");
		writeStream = new streamBuffers.WritableStreamBuffer();
		svgHolder.finalize(writeStream);
		svgBuffer = writeStream.getContents();
		if (format === "svg") {
			log.trace("svg");
			if (next) next(null, svgBuffer);
			return svgBuffer;
		} else if (format === "png") {
			log.trace("png");
			rasterize.svgToPng(svgBuffer, svgHolder.dims.width, svgHolder.dims.height, svgHolder.numPages, format, next);
		} else {
			throw new Error("Unknown format: " + format);
		}
	}
}

module.exports = ReadAndRender;

