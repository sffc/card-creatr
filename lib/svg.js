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

// TODO: Remove this file and perform a simple string concatenation.  There isn't enough logic to warrant calling in the xmlbuilder library and the memory stream.

const streamBuffers = require("stream-buffers");
const xmlbuilder = require("xmlbuilder");

class SvgHolder {
	constructor() {
		this.dims = {};
		this.fonts = {};
		this.writeFontFaceCSS = true;
		this.content = "";
		this.numPages = 1;
	}

	finalize(stream) {
		var svg = xmlbuilder.create("svg");
		svg.att({
			version: "1.1",
			xmlns: "http://www.w3.org/2000/svg",
			"xmlns:xlink": "http://www.w3.org/1999/xlink",
			width: this.dims.width + this.dims.unit,
			height: (this.dims.height * this.numPages) + this.dims.unit,
			viewBox: "0 0 1 " + this.numPages,
			preserveAspectRatio: "none"
		});
		if (this.writeFontFaceCSS) {
			svg.ele("style", { type: "text/css" }).txt(this._getStyleString());
		}
		svg.raw(this.content);
		svg.end(xmlbuilder.streamWriter(stream));
	}

	finalizeToBuffer() {
		var writeStream = new streamBuffers.WritableStreamBuffer();
		this.finalize(writeStream);
		return writeStream.getContents();
	}

	_getStyleString() {
		let styleString = "";
		for (let fontName of Object.keys(this.fonts)) {
			let info = this.fonts[fontName];
			styleString += `@font-face { font-family: "${fontName}"; src: url("${info.dataUri}"); }\n`;
		}
		return styleString;
	}
}

module.exports = SvgHolder;
