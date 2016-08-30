"use strict";

const async = require("async");
const fs = require("fs");
const path = require("path");
const pug = require("pug");
const put = require("pug");
const WordWrappr = require("word-wrappr");

const DEFAULT_FONTS = {
	title: {
		path: WordWrappr.getDejaVuPath("DejaVuSerifCondensed", "Bold")
	},
	body: {
		path: WordWrappr.getDejaVuPath("DejaVuSerifCondensed")
	}
};

const MIXINS_PATH = path.join(__dirname, "..", "lib", "mixins.pug");

class CardRenderer {
	constructor(templatePath, config) {
		this.config = config;

		// Fill in default fonts
		this.fonts = {};
		Object.assign(this.fonts, DEFAULT_FONTS, config.fonts);

		// Create wrappr objects
		this.wrappr = {};
		for (let fontName of Object.keys(this.fonts)) {
			this.wrappr[fontName] = new WordWrappr(this.fonts[fontName].path);
		}
	}

	loadSync() {
		// Load template
		let templateString = "";
		templateString += fs.readFileSync(MIXINS_PATH).toString("utf-8");
		templateString += fs.readFileSync(this.config.template.path).toString("utf-8");
		this.template = pug.compile(templateString);

		// Load fonts
		for (let fontName of Object.keys(this.fonts)) {
			this.wrappr[fontName].loadSync();
		}
	}

	load(next) {
		async.auto({
			"mixins": (_next) => {
				fs.readFile(MIXINS_PATH, _next);
			},
			"template": (_next) => {
				fs.readFile(this.config.template.path, _next);
			},
			"fonts": (_next) => {
				async.each(
					Object.keys(this.fonts),
					(fontName, __next) => {
						this.wrappr[fontName].load(__next);
					},
					_next
				);
			},
			"combine": ["mixins", "template", (results, _next) => {
				let templateString = "";
				templateString += results.mixins.toString("utf-8");
				templateString += results.template.toString("utf-8");
				this.template = pug.compile(templateString);
				_next(null);
			}]
		}, next);
	}

	render(card) {
		var locals = {
			wrappr: this.wrappr,
			fonts: this.fonts
		};
		Object.assign(locals, this.config, card);
		return this.template(locals);
	}
}

module.exports = CardRenderer;
