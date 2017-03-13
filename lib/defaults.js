"use strict";

function getBaseField() {
	return {
		name: "",
		properties: [],
		display: "string",
		width: 150,
		array: false
	}
}

function getBaseFontInfo() {
	return {
		name: "",
		filename: null,
		source: "",
		sourceName: "",
		sourceVariant: ""
	}
}

function getDefaultFields() {
	var field1 = getBaseField();
	field1.name = "title";
	var field2 = getBaseField();
	field2.name = "image";
	field2.properties = ["img", "path"];
	field2.display = "image";
	var field3 = getBaseField();
	field3.name = "body";
	field3.width = 300;
	field3.array = true;
	return [field1, field2, field3];
}

function getDefaultTemplate() {
	return `rect(x=0, y=0, width=180, height=252, fill="#D18F56")
+text(title)(align="center", font-family="title", font-size=17, x=90, y=28)
+imageFill(image, 9, 35, 162, 110)
rect(x=9, y=145, width=162, height=98, fill="#E8D1CA")
+textWrap(body)(font-family="body", font-size=11, x=12, y=160, width=156)
`;
}

function getDefaultConfig() {
	return `{
	// Add custom fonts and assets here:
	fonts: {
	},
	assets: {
	},

	// Information for the internal coordinate systems within the card layout and page layout.  The "width" and "height" values will specify the width and height of the SVG view box.  For more information on the SVG view box, see https://www.google.com/search?q=svg+viewbox
	viewports: {
		card: {
			width: 180,
			height: 252
		},
		page: {
			width: 612,
			height: 792,
			cardWidth: 180,
			cardHeight: 252,

			// Minimum print margin.  Defaults to zero.  Increase this to prevent cards from being placed too close to the edge of the page.
			printMargin: 0
		}
	}

	// Information to be used when exporting the cards.
	// Note: 'pt' means 'points', a unit customary for print layout in the United States.  Supported units are: em, ex, px, pt, pc, cm, mm, and in.
	dimensions: {
		card: {
			// 2.5 in by 3.5 in
			unit: "pt",
			width: 180,
			height: 252,
			dpi: 300
		},
		page: {
			// 8.5 in by 11 in
			unit: "pt",
			width: 612,
			height: 792,
			dpi: 300
		}
	}
}
`;
}

module.exports = {
	getBaseField,
	getBaseFontInfo,
	getDefaultFields,
	getDefaultTemplate,
	getDefaultConfig
};
