"use strict";

const opentype = require("opentype.js");
const xmlbuilder = require("xmlbuilder");

class FontHandler {
	// TODO: Fix this API.
	constructor(alias, path, localName) {
		this.alias = alias;
		this.path = path;
		this.localName = localName;
	}

	load(next) {
		opentype.load(this.path, (err, font) => {
			if (err) {
				next(err);
				return;
			}
			this.font = font;
			next(null);
		});
	}

	loadSync() {
		this.font = opentype.loadSync(this.path);
	}

	toSvg() {
		let fontDefs = xmlbuilder.create("defs", { headless: true });
		let font = fontDefs.ele("font");
		let fontFace = font.ele("font-face", {
			"font-family": this.alias,
			"units-per-em": this.font.unitsPerEm,
			"ascent": this.font.ascender,
			"descender": this.font.descender
		});
		// TODO: font-face-src
		let missingGlyph = font.ele("missing-glyph");
		missingGlyph.ele("path", { d: "M0,0h200v200h-200z" });
		for (let i=0; i<this.font.glyphs.length; i++) {
			let glyph = this.font.glyphs.get(i);
			if (!glyph.unicode) {
				// TODO: Better handling for this case?
				continue;
			};
			let gPath = glyph.getPath(0, 0, this.font.unitsPerEm, { xScale: 1, yScale: -1 });
			let gData = gPath.toPathData();
			font.ele("glyph", {
				"glyph-name": glyph.name,
				"unicode": String.fromCodePoint(glyph.unicode),
				"horiz-adv-x": glyph.advanceWidth,
				"d": gData
			});
		}
		return font.end();
	}
}

module.exports = FontHandler;
