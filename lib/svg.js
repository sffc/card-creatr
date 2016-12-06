"use strict";

// TODO: Remove this file and perform a simple string concatenation.  There isn't enough logic to warrant calling in the xmlbuilder library and the memory stream.

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
		svg.ele("g", { "font-family": "body" }).raw(this.content);
		svg.end(xmlbuilder.streamWriter(stream));
	}
}

module.exports = SvgHolder;
