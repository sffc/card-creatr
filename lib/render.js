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

"use strict";

const fs = require("fs");
const path = require("path");
const pug = require("pug");
const utils = require("./utils");
const xmlbuilder = require("xmlbuilder");

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

const MIXINS_PATH = path.join(__dirname, "mixins.pug");

class CardRenderer {
	constructor() {
		this.mixinsString = null;
		this.template = null;
	}

	load(next) {
		fs.readFile(MIXINS_PATH, (err, buffer) => {
			if (err) return next(err);
			this.mixinsString = buffer.toString("utf-8");
			next(null);
		});
	}

	loadSync() {
		this.mixinsString = fs.readFileSync(MIXINS_PATH).toString("utf-8");
	}

	build(templateString) {
		this.template = pug.compile(this.mixinsString + "\n" + templateString);
		return;
	}

	buildCopy(templateString) {
		let copy = new CardRenderer();
		copy.mixinsString = this.mixinsString;
		copy.build(templateString);
		return copy;
	}

	_applyTextDefaults(attributes, fonts, options) {
		// Convert from hyphens to camel case
		utils.moveProperty(attributes, "font-family", "fontFamily");
		utils.moveProperty(attributes, "font-size", "fontSize");
		// Apply default values.  Keep values in optional "options" argument first, then "attributes", then the defaults, in that order.
		let _options = Object.assign({}, DEFAULT_TEXT_ATTRIBUTES, attributes, options);
		options = Object.assign(options || {}, _options);
		// Convert from hyphens to camel case
		// Ensure that fontFamily exists, and get the wrappr instance.
		if (!fonts[options.fontFamily]) {
			throw new Error("Unknown font family: \"" + options.fontFamily + "\"");
		} else {
			options.wrappr = fonts[options.fontFamily].wrappr;
		}
		// Clear the options out of the attributes object.  Any remaining attributes will be assigned to the child SVG elements.
		for (let key of Object.keys(DEFAULT_TEXT_ATTRIBUTES)) {
			delete attributes[key];
		}
		return options;
	}

	_applyTextWrapDefaults(attributes, fonts, options) {
		// Convert from hyphens to camel case
		utils.moveProperty(attributes, "line-height", "lineHeight");
		utils.moveProperty(attributes, "paragraph-spacing", "paragraphSpacing");
		// Apply the text defaults
		options = this._applyTextDefaults(attributes, fonts, options || {});
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
			let width = options.wrappr.computeWidth(line, options.fontSize);
			return options.wrappr.font.getPath(line, options.x-width/2, options.y, options.fontSize).toPathData();
		} else if (options.align === "right") {
			let width = options.wrappr.computeWidth(line, options.fontSize);
			return options.wrappr.font.getPath(line, options.x-width, options.y, options.fontSize).toPathData();
		} else {
			// options.align === "left"
			return options.wrappr.font.getPath(line, options.x, options.y, options.fontSize).toPathData();
		}
	}

	_makeTextAttributes(line, options) {
		line = new String(line);  // in case a non-string argument like a number is passed
		var x, y;
		if (options.align === "center") {
			let width = options.wrappr.computeWidth(line, options.fontSize);
			x = options.x - width/2;
			y = options.y;
		} else if (options.align === "right") {
			let width = options.wrappr.computeWidth(line, options.fontSize);
			x = options.x - width;
			y = options.y;
		} else {
			x = options.x;
			y = options.y;
		}

		var result = Object.assign({}, options, { x, y });
		// SVG expects the hyphenated form of fontFamily and fontSize
		utils.moveProperty(result, "fontFamily", "font-family");
		utils.moveProperty(result, "fontSize", "font-size");
		for (let key of Object.keys(result)) {
			if (typeof result[key] === "object") {
				delete result[key];
			}
		}
		return result;
	}

	render(cardOptions, globalOptions, viewport, extraOptions) {
		var locals = {
			_fonts: globalOptions.get("/fonts"),
			_fontRenderMode: globalOptions.get("/fontRenderMode"),
			_applyTextDefaults: this._applyTextDefaults.bind(this),
			_applyTextWrapDefaults: this._applyTextWrapDefaults.bind(this),
			_makeTextPath: this._makeTextPath.bind(this),
			_makeTextAttributes: this._makeTextAttributes.bind(this),
		};
		Object.assign(locals, globalOptions.toObject(), cardOptions.toObject(), extraOptions || {});

		let svg = xmlbuilder.create("svg", { headless: true });
		svg.att({
			width: 1, height: 1,
			viewBox: `${viewport.xOffset||0} ${viewport.yOffset||0} ${viewport.width} ${viewport.height}`,
			preserveAspectRatio: "none"
		});
		svg.raw(this.template(locals));
		return svg.end();
	}
}

module.exports = CardRenderer;
