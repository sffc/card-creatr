"use strict";

const async = require("async");
const fs = require("fs");
const path = require("path");
const pug = require("pug");
const put = require("pug");
const WordWrappr = require("word-wrappr");
const xmlbuilder = require("xmlbuilder");
const utils = require("./utils");

const MIXINS_PATH = path.join(__dirname, "..", "lib", "mixins.pug");

const DEFAULT_TEXT_ATTRIBUTES = {
	align: "left",
	fontFamily: "body",
	fontSize: 12,
	x: 0,
	y: 0
};

const DEFAULT_TEXT_WRAP_ATTRIBUTES = {
	width: 100,
	lineHeight: null,
	paragraphSpacing: null
};

class CardRenderer {
	constructor(templatePath, config) {
		this.config = config;
		this.fonts = config.fonts;

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

	_applyTextDefaults(attributes, options) {
		// Convert from hyphens to camel case
		utils.moveProperty(attributes, "font-family", "fontFamily");
		utils.moveProperty(attributes, "font-size", "fontSize");
		// Apply default values.  Keep values in optional "options" argument first, then "attributes", then the defaults, in that order.
		let _options = Object.assign({}, DEFAULT_TEXT_ATTRIBUTES, attributes, options);
		options = Object.assign(options || {}, _options);
		// Convert from hyphens to camel case
		// Ensure that fontFamily exists, and get the wrappr instance.
		if (!this.wrappr[options.fontFamily]) {
			console.error("Warning: Unable to find font:", options.fontFamily);
			options.fontFamily = DEFAULT_TEXT_ATTRIBUTES.fontFamily;
		}
		options.wrappr = this.wrappr[options.fontFamily];
		// Clear the options out of the attributes object.  Any remaining attributes will be assigned to the child SVG elements.
		for (let key of Object.keys(DEFAULT_TEXT_ATTRIBUTES)) {
			delete attributes[key];
		}
		return options;
	}

	_applyTextWrapDefaults(attributes, options) {
		// Convert from hyphens to camel case
		utils.moveProperty(attributes, "line-height", "lineHeight");
		utils.moveProperty(attributes, "paragraph-spacing", "paragraphSpacing");
		// Apply the text defaults
		options = this._applyTextDefaults(attributes, options || {});
		// Apply the wrapping defaults.  (Note: The second Object.assign clones the options object so that it can be passed as an argument to the main Object.assign)
		Object.assign(options, DEFAULT_TEXT_WRAP_ATTRIBUTES, attributes, Object.assign({}, options));
		// Special handling for lineHeight and paragraphSpacing
		if (options.lineHeight === null) {
			options.lineHeight = 1.2 * options.fontSize;
		}
		if (options.paragraphSpacing === null) {
			options.paragraphSpacing = 0.5 * options.fontSize;
		}
		// Clear the options out of the attributes object.  Any remaining attributes will be assigned to the child SVG elements.
		for (let key of Object.keys(DEFAULT_TEXT_WRAP_ATTRIBUTES)) {
			delete attributes[key];
		}
		return options;
	}

	_makeTextPath(line, options) {
		line = new String(line);  // in case a non-string argument like a number is passed
		if (options.align === "center") {
			var width = options.wrappr.computeWidth(line, options.fontSize);
			return options.wrappr.font.getPath(line, options.x-width/2, options.y, options.fontSize).toPathData();
		} else if (options.align === "right") {
			var width = options.wrappr.computeWidth(line, options.fontSize);
			return options.wrappr.font.getPath(line, options.x-width, options.y, options.fontSize).toPathData();
		} else {
			// options.align === "left"
			return options.wrappr.font.getPath(line, options.x, options.y, options.fontSize).toPathData();
		}
	}

	render(card, viewport) {
		var locals = {
			_wrappr: this.wrappr,
			_fonts: this.fonts,
			_applyTextDefaults: this._applyTextDefaults.bind(this),
			_applyTextWrapDefaults: this._applyTextWrapDefaults.bind(this),
			_makeTextPath: this._makeTextPath.bind(this)
		};
		Object.assign(locals, this.config, card);

		let svg = xmlbuilder.create("svg", { headless: true });
		svg.att({
			width: 1, height: 1,
			viewBox: `0 0 ${viewport.width} ${viewport.height}`,
			preserveAspectRatio: "none"
		});
		svg.raw(this.template(locals));
		return svg.end();
	}
}

module.exports = CardRenderer;
