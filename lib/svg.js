"use strict";

const async = require("async");
const xmlbuilder = require("xmlbuilder");
const FontHandler = require("./fonts");

class SvgHolder {
	constructor(width, height, viewBox) {
		this.width = width;
		this.height = height;
		this.fonts = [];
		this.content = "";
	}

	finalize(stream) {
		var svg = xmlbuilder.create("svg");
		svg.att({
			version: "1.1",
			xmlns: "http://www.w3.org/2000/svg",
			"xmlns:xlink": "http://www.w3.org/1999/xlink",
			width: this.width,
			height: this.height,
			viewBox: "0 0 1 1",
			preserveAspectRatio: "none"
		});
		// svg.ele("style", { type: "text/css" }).txt(this._getStyleString());
		svg.ele("g", { "font-family": "body" }).raw(this.content);
		for (let fontName of Object.keys(this.fonts)) {
			let info = this.fonts[fontName];
			let fh = new FontHandler(fontName, info.path, info.localName);
			fh.loadSync();
			let txt = fh.toSvg();
			svg.raw(txt);
		}
		svg.end(xmlbuilder.streamWriter(stream));
	}

	_getStyleString() {
		let styleString = "";
		for (let fontName of Object.keys(this.fonts)) {
			let info = this.fonts[fontName];
			styleString += `@font-face { font-family: "${fontName}"; src: local("${info.localName}"), url("${info.dataUri}"), url("file://${info.path}"); }\n`;
		}
		return styleString;
	}
}

module.exports = SvgHolder;
