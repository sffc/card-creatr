"use strict";

const async = require("async");
const CardRenderer = require("../lib/render.js");
const csvParse = require("csv-parse");
const csvParseSync = require("csv-parse/lib/sync");
const hjson = require("hjson");
const fs = require("fs");
const Options = require("./options");
const path = require("path");
const WordWrappr = require("word-wrappr");

const DEFAULT_OPTIONS = {
	fonts: {
		"title (font)": WordWrappr.getDejaVuPath("DejaVuSerifCondensed", "Bold"),
		"body (font)": WordWrappr.getDejaVuPath("DejaVuSerifCondensed")
	}
};

const MIXINS_PATH = path.join(__dirname, "..", "lib", "mixins.pug");
const CSV_PARSER_OPTIONS = { auto_parse: true };

class ReadAndRender {
	constructor(configPath, optionsFallback) {
		this.configPath = configPath;
		this.options = new Options();
		this.options.addFallback(optionsFallback, "");
		this.options.addFallback(DEFAULT_OPTIONS, "");
	}

	run(next) {
		async.auto({
			"configContent": (_next) => {
				if (this.configPath) {
					fs.readFile(this.configPath, _next);
				} else {
					process.nextTick(() => {
						_next(null, new Buffer(0));
					});
				}
			},
			"mixinsContent": (_next) => {
				fs.readFile(MIXINS_PATH, _next);
			},
			"optionTemplate": (_next) => {
				this.options.onceLoaded("/template", _next);
			},
			"optionData": (_next) => {
				this.options.onceLoaded("/data", _next);
			},
			"optionQuery": (_next) => {
				this.options.onceLoaded("/query", _next);
			},
			"optionsAll": ["configContent", (results, _next) => {
				// Config values override fallback options values.
				var config = hjson.parse(results.configContent.toString("utf-8"));
				this.options.addPrimary(config, path.dirname(this.configPath));
				this.options.load(_next);
			}],
			"renderer": ["optionTemplate", "mixinsContent", (results, _next) => {
				var mixinsString = results.mixinsContent.toString("utf-8");
				var templateString = results.optionTemplate.buffer.toString("utf-8");
				var renderer = new CardRenderer(mixinsString, templateString);
				_next(null, renderer);
			}],
			"cardData": ["optionData", (results, _next) => {
				var csvString = results.optionData.buffer.toString("utf-8");
				csvParse(csvString, CSV_PARSER_OPTIONS, _next);
			}],
			"cards": ["optionQuery", "optionData", "cardData", (results, _next) => {
				var csvRows = results.cardData;
				var rowsToProcess = csvRows
					.slice(1)
					.map((row) => { return this.rowToObject(csvRows[0], row) })
					.filter((row) => {
						return this.satisfiesQuery(row, results.optionQuery);
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
			"render": ["optionsAll", "renderer", "cards", (results, _next) => {
				var renderer = results.renderer;
				var cards = results.cards;
				var renderedCards;

				try {
					renderedCards = cards.map((cardOptions) => {
						return renderer.render(cardOptions, this.options, this.options.get("/viewports/card"));
					});
				} catch(err) {
					return _next(err);
				}
				return _next(null, renderedCards);
			}],
			"multiples": ["cards", "optionQuery", "render", (results, _next) => {
				var multipliedCards = this.multiplyCards(results.cards, results.render, results.optionQuery.multiples);
				return _next(null, multipliedCards);
			}]
		}, (err, results) => {
			next(err, results.multiples);
		});
	}

	runSync() {
		// Load all options data.
		// Config values override fallback options values.
		var configContent = fs.readFileSync(this.configPath);
		var config = hjson.parse(configContent.toString("utf-8"));
		this.options.addPrimary(config, path.dirname(this.configPath));
		this.options.loadSync();

		// Load the renderer.
		var mixinsContent = fs.readFileSync(MIXINS_PATH);
		var mixinsString = mixinsContent.toString("utf-8");
		var templateString = this.options.get("/template").buffer.toString("utf-8");
		var renderer = new CardRenderer(mixinsString, templateString);

		// Load the card data.
		var csvString = this.options.get("/data").buffer.toString("utf-8");
		var csvRows = csvParseSync(csvString, CSV_PARSER_OPTIONS);
		var rowsToProcess = csvRows
			.slice(1)
			.map((row) => { return this.rowToObject(csvRows[0], row) })
			.filter((row) => {
				return this.satisfiesQuery(row, this.options.get("/query"));
			});
		var cards = rowsToProcess.map((row) => {
			var cardOptions = new Options();
			cardOptions.addPrimary(row, path.dirname(this.options.get("/data").path));
			return cardOptions.loadSync();
		});

		// Perform the render.
		var renderedCards = cards.map((cardOptions) => {
			return renderer.render(cardOptions, this.options, this.options.get("/viewports/card"));
		});

		// Duplicate cards as needed and return.
		return this.multiplyCards(cards, renderedCards, this.options.get("/query/multiples"));
	}

	satisfiesQuery(row, query) {
		return (Object.keys(query).length === 0
			|| (query.id === null && query.title === null)
			|| row.id === query.id
			|| row.title === query.title);
	}

	rowToObject(header, row) {
		var obj = {};
		for (let i=0; i<header.length; i++) {
			let key = header[i];
			while (typeof obj[key] !== "undefined") {
				key += "+";
			}
			obj[key] = row[i];
		}
		return obj;
	}

	multiplyCards(cards, renderedCards, quantity) {
		// Duplicate cards according to the specified number of multiples
		let multipliedCards = [];
		for (let i=0; i<cards.length; i++) {
			let card = cards[i];
			let renderedCard = renderedCards[i];
			for (let j=0; j<quantity; j++) {
				for (let k=0; k<(card.get("/count")||1); k++) {
					multipliedCards.push(renderedCard);
				}
			}
		}
		return multipliedCards;
	}
}

module.exports = ReadAndRender;

