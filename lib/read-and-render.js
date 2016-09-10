"use strict";

const async = require("async");
const CardRenderer = require("../lib/render.js");
const CardReader = require("../lib/data.js");
const hjson = require("hjson");
const fs = require("fs");
const path = require("path");
const utils = require("./utils");
const WordWrappr = require("word-wrappr");

const DEFAULT_FONTS = {
	title: {
		path: WordWrappr.getDejaVuPath("DejaVuSerifCondensed", "Bold"),
		localName: "DejaVu Serif Condensed Bold"
	},
	body: {
		path: WordWrappr.getDejaVuPath("DejaVuSerifCondensed"),
		localName: "DejaVu Serif Condensed"
	}
};

class ReadAndRender {
	constructor(configPath, optionsFallback) {
		this.configPath = configPath;
		this.optionsFallback = utils.assignDeep({}, optionsFallback, {
			dirname: path.dirname(this.configPath),
			fonts: DEFAULT_FONTS
		});
	}

	run(next) {
		async.auto({
			"configContent": (_next) => {
				fs.readFile(this.configPath, _next);
			},
			"options": ["configContent", (results, _next) => {
				// Config values override fallback options values
				const config = hjson.parse(results.configContent.toString("utf-8"));

				// By default, paths are assumed to be relative to the cwd, but in the config file, it is more useful if they are relative to the location of the config file.  This function converts all the paths in the config file to be relative to the config file.
				utils.convertPaths(config, path.dirname(this.configPath));
				this.options = utils.assignDeep({}, this.optionsFallback, config);
				utils.loadDataUris(this.options);
				_next(null);
			}],
			"optionsAll": ["options", (results, _next) => {
				// Get image dimensions
				utils.getDimensions(this.options, _next);
			}],
			"renderer": ["options", (results, _next) => {
				// Load template data
				this.renderer = new CardRenderer(this.options.template.path, this.options);
				this.renderer.load(_next);
			}],
			"reader": ["options", (results, _next) => {
				// Load card data
				this.reader = new CardReader(this.options.data.path);
				this.reader.load(_next);
			}],
			"readerAll": ["reader", (results, _next) => {
				// Convert paths on the cards data to be relative to the config file
				utils.convertPaths(this.reader.data, path.dirname(this.configPath));

				utils.loadDataUris(this.reader.data);

				// Get image dimensions
				utils.getDimensions(this.reader.data, _next);
			}],
			"cards": ["optionsAll", "readerAll", (results, _next) => {
				// Get the card value
				const cards = this._getCards();
				if (cards.length === 0) {
					_next(new Error("The specified card does not exist."));
				} else {
					_next(null, cards);
				}
			}],
			"render": ["options", "renderer", "cards", (results, _next) => {
				var result;
				try {
					result = results.cards.map((card) => {
						return this.renderer.render(card, this.options.viewports.card);
					});
				} catch(err) {
					return _next(err);
				}
				return _next(null, result);
			}]
		}, (err, results) => {
			next(err, results.render);
		});
	}

	runSync() {
		// Config values override fallback options values
		const config = hjson.parse(fs.readFileSync(this.configPath).toString("utf-8"));

		// By default, paths are assumed to be relative to the cwd, but in the config file, it is more useful if they are relative to the location of the config file.  This function converts all the paths in the config file to be relative to the config file.
		utils.convertPaths(config, path.dirname(this.configPath));
		this.options = utils.assignDeep({}, this.optionsFallback, config);

		// Load data
		this.renderer = new CardRenderer(this.options.template.path, this.options);
		this.renderer.loadSync();
		this.reader = new CardReader(this.options.data.path);
		this.reader.loadSync();

		// Convert paths on the cards data to be relative to the config file
		utils.convertPaths(this.reader.data, path.dirname(this.configPath));

		// Get image dimensions
		utils.getDimensionsSync(this.reader.data);

		// Get the cards array
		const cards = this._getCards();
		if (cards.length === 0) {
			throw new Error("The specified card does not exist.");
		}

		// Render and return
		return cards.map((card) => {
			return this.renderer.render(card, this.options.viewports.card);
		});
	}

	_getCards() {
		let start = (
			(this.options.query.id ? this.reader.getByValue("id", this.options.query.id) :
			(this.options.query.title ? this.reader.getByValue("title", this.options.query.title) :
			this.reader.data)));

		// Duplicate cards according to the specified number of multiples
		let cards = [];
		for (let card of start) {
			for (let j=0; j<this.options.query.multiples; j++) {
				cards.push(card);
			}
		}
		return cards;
	}
}

module.exports = ReadAndRender;
