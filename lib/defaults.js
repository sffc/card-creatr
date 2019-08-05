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

function getBaseField() {
	return {
		name: "",
		properties: [],
		display: "string",
		width: 150,
		array: false,
		// NOTE: This is named "dropdownV1" in order to allow for a possibly richer array-based implementation in the future.
		dropdownV1: ""
	};
}

function getBaseFontInfo() {
	return {
		name: "",
		filename: null,
		source: "",
		sourceName: "",
		sourceVariant: ""
	};
}

function getDefaultFields() {
	var field0 = getBaseField();
	field0.name = "qty";
	field0.properties = ["uint"];
	field0.display = "number";
	field0.width = 50;
	var field1 = getBaseField();
	field1.name = "title";
	field1.width = 200;
	return [field0, field1];
}

function getDefaultTemplate() {
	return `rect(x=0, y=0, width=180, height=252, fill="white")
+text(title)(align="center", font-family="title", font-size=17, x=90, y=28)
`;
}

function getDefaultConfig() {
	return `{
	// ASSETS:
	// Add custom assets (usually images) here to make them available to the template.
	// Follow these steps:
	//  1) Add the image in the "Assets" tab. Note the file name.
	//  2) List the asset here, using the following syntax:
	//
	//   "asset_name (img,path)": "assets/filename.jpg"
	//
	assets: {
	}

	// GUIDE:
	// Fill in the following multi-line string with Markdown.  A "Guide" tab will show up on the left.  It will be the default tab instead of the "Template" tab when you open the file.  This is useful if you are designing a custom template (ccst file) to share with others.
	guide: '''
	'''

	// COORDINATE SYSTEMS:
	// Information for the internal coordinate systems within the card layout and page layout.  The "width" and "height" values will specify the width and height of the SVG view box.  For more information on the SVG view box, see https://www.google.com/search?q=svg+viewbox
	viewports: {
		card: {
			width: 180
			height: 252
			xOffset: 0
			yOffset: 0
		}
		page: {
			width: 612
			height: 792
			cardWidth: 180
			cardHeight: 252

			// Minimum print margin.  Defaults to zero.  Increase this to prevent cards from being placed too close to the edge of the page.
			printMargin: 0
		}
	}

	// PAGE LAYOUT:
	// Information to be used when exporting the cards.
	// Note: 'pt' means 'points', a unit customary for print layout in the United States.  Supported units are: em, ex, px, pt, pc, cm, mm, and in.
	dimensions: {
		card: {
			// 2.5 in by 3.5 in
			unit: "pt"
			width: 180
			height: 252
			dpi: 300
		}
		page: {
			// 8.5 in by 11 in
			unit: "pt"
			width: 612
			height: 792
			dpi: 300
		}
	}
	// Card Creatr supports two page layout strategies: "tight" and "evenSpacing". Choose "tight" to squeeze all cards into the middle of the page, with no margin between cards. Choose "evenSpacing" to add space between cards.
	layoutStrategy: "tight"

	// GRID:
	// Used by Card Creatr Studio to control the grid overlay.
	grid: {
		color: "#00FFFF"
		weight: 1
		opacity: 0.5
		size: 12
	}

	// FONT RENDER MODE:
	// Whether text should be converted to SVG paths before output.  Converting text to SVG paths sometimes eliminates strange behaviors in the operating system's font rendering engine.  Note that emoji and some Indic scripts are *not* supported in SVG path mode.  This only affects text boxes created using the +text or +textWrap mixins.
	// Options are "auto" (default) or "paths" (convert text to SVG paths)
	fontRenderMode: "auto"
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
