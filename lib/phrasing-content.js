/*
 * Copyright (C) 2020 Matthias Eichner
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

/**
 * Strips all XML tags from given text. Also returns which tags where stripped to reapply them later.
 * e.g. "Hello <tspan>World<tspan>" becomes "Hello World".
 *
 * @param text the text to strip
 * @returns {{newText: string, strippedParts: []}}
 */
function stripXML(text) {
	const strippedParts = [];
	let newText = "";
	let inside = 0;
	let strippedPart = new StrippedPart();
	let index = 0;
	for (let i = 0; i < text.length; i++) {
		const char = text.charAt(i);
		if (inside === 0 && char === "<") {
			inside = 1;
			strippedPart = new StrippedPart();
			strippedPart.from = index;
			strippedPart.tag = "";
			strippedPart.endTag = "";
		} else if (inside === 1 && char === ">") {
			strippedPart.tag += char;
			inside = 2;
			continue;
		} else if (inside === 2 && char === "<") {
			inside = 3;
			strippedPart.to = index;
		} else if (inside === 3 && char === ">") {
			strippedPart.endTag += char;
			strippedParts.push(strippedPart);
			inside = 0;
			continue;
		}
		if(inside === 0 || inside === 2) {
			newText += char;
			index++;
		} else if (inside === 1) {
			strippedPart.tag += char;
		} else if(inside === 3) {
			strippedPart.endTag += char;
		}
	}
	return {newText, strippedParts};
}

/**
 * Apply's the stripped parts to the given lines.
 *
 * @param lines
 * @param strippedParts
 * @returns {*}
 */
function applyXML(lines, strippedParts) {
	for(let i = strippedParts.length - 1; i >= 0; i--) {
		const strippedPart = strippedParts[i];
		let index = 0;
		for(let j = 0; j < lines.length; j++) {
			index += lines[j].length;
			if((index + j) >= strippedPart.from) {
				const startIndex = index - lines[j].length;
				const endIndex = strippedPart.to - startIndex - j;
				const from = Math.max(0, strippedPart.from - startIndex - j);
				const to = Math.min(index, endIndex);
				lines[j] = lines[j].slice(0, to) + strippedPart.endTag + lines[j].slice(to);
				lines[j] = lines[j].slice(0, from) + strippedPart.tag + lines[j].slice(from);
				if(endIndex <= index) {
					break;
				}
			}
		}
	}
	return lines;
}

class StrippedPart {
	constructor() {
		this.tag = null;
		this.endTag = null;
		this.from = null;
		this.to = null;
	}
}

module.exports = {stripXML, applyXML};
