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
const CardRenderer = require("./render.js");
const csvParse = require("csv-parse");
const csvParseSync = require("csv-parse/lib/sync");
const fs = require("fs");
const hjson = require("hjson");
const log = require("./logger")("read-and-render");
const Options = require("./options");
const path = require("path");
const WordWrappr = require("word-wrappr");
const utils = require("./utils");

const CSV_PARSER_OPTIONS = { auto_parse: true };

class ReadAndRender {
	constructor(configPath, optionsFallback) {
		log.trace("constructor");
		this.configPath = configPath;
		this.options = new Options();
		this.options.addFallback(optionsFallback, "");
		this.options.addDefaultFallback();
	}

	load(next) {
		async.auto({
			"configContent": (_next) => {
				log.trace("configContent");
				if (this.configPath) {
					fs.readFile(this.configPath, _next);
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
				this.options.addPrimary(config, path.dirname(this.configPath));
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
				var csvString = results.optionData.buffer.toString("utf-8");
				csvParse(csvString, CSV_PARSER_OPTIONS, _next);
			}],
			"cards": ["optionQuery", "optionData", "cardData", (results, _next) => {
				log.trace("cards");
				var csvRows = results.cardData;
				var rowsToProcess = utils.csvToObjects(csvRows)
					.filter((row) => {
						return utils.satisfiesQuery(row, results.optionQuery);
					});
				async.map(
					rowsToProcess,
					(row, __next) => {
						var cardOptions = new Options();
						cardOptions.addPrimary(row, path.dirname(results.optionData.path));
						cardOptions.load(__next);
					},
					_next
				);
			}],
			"collect": ["cards", (results, _next) => {
				log.trace("collect");
				this.cards = results.cards;
			}]
		}, next);
	}

	loadTemplateSync() {
		//
	}

	loadSync() {
		// Load all options data.
		// Config values override fallback options values.
		log.trace("configContent");
		var configContent = fs.readFileSync(this.configPath);
		var config = hjson.parse(configContent.toString("utf-8"));
		this.options.addPrimary(config, path.dirname(this.configPath));
		this.options.loadSync();

		// Load the renderer.
		log.trace("mixinsContent");
		var templateString = this.options.get("/template").buffer.toString("utf-8");
		this.renderer = new CardRenderer;
		this.renderer.loadSync();
		this.renderer.build(templateString);

		// Load the card data.
		log.trace("csvString");
		var csvString = this.options.get("/data").buffer.toString("utf-8");
		var csvRows = csvParseSync(csvString, CSV_PARSER_OPTIONS);
		var rowsToProcess = utils.csvToObjects(csvRows)
			.filter((row) => {
				return utils.satisfiesQuery(row, this.options.get("/query"));
			});
		this.cards = rowsToProcess.map((row) => {
			var cardOptions = new Options();
			cardOptions.addPrimary(row, path.dirname(this.options.get("/data").path));
			return cardOptions.loadSync();
		});
	}

	run() {
		// Perform the render.
		log.trace("renderedCards");
		var renderedCards = this.cards.map((cardOptions) => {
			return this.renderer.render(cardOptions, this.options, this.options.get("/viewports/card"));
		});

		// Duplicate cards as needed and return.
		log.trace("multiples");
		var multiples = utils.multiplyCards(this.cards, renderedCards, this.options.get("/query/multiples"));
		return multiples;
	}
}

module.exports = ReadAndRender;

