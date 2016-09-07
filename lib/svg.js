"use strict";

const xmlbuilder = require("xmlbuilder");

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
		svg.ele("style", { type: "text/css" }).txt(this._getStyleString());
		svg.ele("g", { style: "font-family: 'body';" }).raw(this.content);
		svg.end(xmlbuilder.streamWriter(stream));
	}

	_getStyleString() {
		let styleString = "";
		for (let fontName of Object.keys(this.fonts)) {
			let info = this.fonts[fontName];
			styleString += `@font-face { font-family: "${fontName}"; src: url("file://${info.path}"); }\n`;
		}
		return styleString;
	}
}

module.exports = SvgHolder;
