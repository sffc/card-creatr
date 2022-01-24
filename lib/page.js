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

const assert = require("assert");
const xmlbuilder = require("xmlbuilder");

class PageRenderer {
	constructor(viewport, strategy, reversed) {
		this.viewport = viewport;
		// "reversed" is a boolean.  It flips the order in which the cards are rendered.  This is useful for creating layouts for double-sided printing of cards.

		// Convenience references
		let pageWidth = viewport.width - 2*viewport.printMargin;
		let pageHeight = viewport.height - 2*viewport.printMargin;
		let cardWidth = viewport.cardWidth;
		let cardHeight = viewport.cardHeight;

		// Fit as many cards as possible in the horizontal and vertical directions.
		let hCap = Math.trunc(pageWidth / cardWidth);
		let vCap = Math.trunc(pageHeight / cardHeight);
		this._capacity = hCap * vCap;
		if (this._capacity === 0) {
			throw new Error("Cannot fit any cards onto the page.");
		}

		// Compute the grid using the desired strategy.
		this._placeholders = [];
		if (strategy === "evenSpacing") {
			// Even spacing strategy: put space between all of the cards and the edge of the paper
			let hSpc = (pageWidth - hCap * cardWidth) / (hCap + 1);
			let vSpc = (pageHeight - vCap * cardHeight) / (vCap + 1);
			for (let i=0; i<vCap; i++) {
				let y = vSpc + (vSpc + cardHeight) * i + viewport.printMargin;
				for (let jx=0; jx<hCap; jx++) {
					let j = (reversed ? hCap - jx - 1 : jx);
					let x = hSpc + (hSpc + cardWidth) * j + viewport.printMargin;
					this._placeholders.push({ x, y });
				}
			}
		} else {
			// Default strategy: bunch all the cards tightly in the middle of the paper
			let hMar = (pageWidth - hCap * cardWidth) / 2;
			let vMar = (pageHeight - vCap * cardHeight) / 2;
			for (let i=0; i<vCap; i++) {
				let y = vMar + cardHeight * i + viewport.printMargin;
				for (let jx=0; jx<hCap; jx++) {
					let j = (reversed ? hCap - jx - 1 : jx);
					let x = hMar + cardWidth * j + viewport.printMargin;
					this._placeholders.push({ x, y });
				}
			}
		}

		// Make the default card.
		let defaultCard = xmlbuilder.create("rect", { headless: true });
		defaultCard.att({
			x: 0, y: 0, width: 1, height: 1,
			fill: "#D9D9D9"
		});
		this._DEFAULT_CARD = defaultCard.end();
	}

	_renderOne(cards, yCoord, yOffset) {
		assert(cards.length <= this._capacity);
		let page = xmlbuilder.create("svg", { headless: true });
		page.att({
			width: 1, height: 1, x: 0, y: yCoord,
			viewBox: `0 0 ${this.viewport.width} ${this.viewport.height}`,
			preserveAspectRatio: "none"
		});
		for (let i=0; i<this._placeholders.length; i++) {
			let placeholder = this._placeholders[i];
			if(cards[i]) {
				page.ele("g", {
					transform: `translate(${placeholder.x},${placeholder.y + yOffset})`
				}).ele("svg", {
					width: this.viewport.cardWidth, height: this.viewport.cardHeight,
					viewBox: "0 0 1 1",
					preserveAspectRatio: "none"
				}).raw(cards[i]);
			}
		}
		return page.end();
	}

	render(cards) {
		let pages = [];
		for (let i=0; i<cards.length; i+=this._capacity) {
			pages.push(this._renderOne(cards.slice(i, i + this._capacity), 0, i % 2 === 0 ? 0 : 1.5));
		}
		return pages;
	}

	renderConcatenated(cards) {
		let string = "";
		let numPages = 0;
		for (let i=0; i<cards.length; i+=this._capacity) {
			string += this._renderOne(cards.slice(i, i + this._capacity), numPages, i % 2 === 0 ? 0 : 1.5);
			numPages++;
		}
		return { string, numPages };
	}
}

module.exports = PageRenderer;
