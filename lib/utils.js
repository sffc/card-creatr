"use strict";

function serializeFieldKey(field) {
	let props = field.properties || [];
	props = props.slice();
	props.sort();
	return field.name + (
			props.length > 0 ? " (" + props.join(",") + ")" : ""
		) + (
			field.array ? "[]" : ""
		);
}

function moveProperty(obj, oldKey, newKey) {
	if (obj.hasOwnProperty(oldKey) && !obj.hasOwnProperty(newKey)) {
		obj[newKey] = obj[oldKey];
	}
	delete obj[oldKey];
}

const ARRAY_REGEX = /\[\]$/;

function csvToObjects(csvRows) {
	if (csvRows.length === 0) return [];
	let header = csvRows[0];
	return csvRows.slice(1).map((row) => {
		let obj = {};
		for (let i=0; i<header.length; i++) {
			let key = header[i];
			if (ARRAY_REGEX.test(key)) {
				obj[key] = obj[key] || [];
				obj[key].push(row[i]);
			} else {
				obj[key] = row[i];
			}
		}
		return obj;
	});
}

function entryToArray(entry) {
	return entry ? ((entry instanceof Array) ? entry : (""+entry).split("\n")) : [];
}

function objectsToCsv(objects) {
	if (objects.length === 0) return [];
	let keys = Object.keys(objects[0]);
	// Analyze the arrays to determine the number of columns required
	let arrayLengths = {};
	var header = [];
	for (let key of keys) {
		if (ARRAY_REGEX.test(key)) {
			arrayLengths[key] = objects.reduce((s,obj) => {
				return Math.max(s, entryToArray(obj[key]).length);
			}, 0);
			for (let i=0; i<arrayLengths[key]; i++) {
				header.push(key);
			}
		} else {
			// Special case for "_dirname" key, created by options.js
			if (key !== "_dirname") {
				header.push(key);
			}
		}
	}
	return [].concat([header], objects.map((obj) => {
		let row = [];
		for (let key of keys) {
			if (ARRAY_REGEX.test(key)) {
				let arr = entryToArray(obj[key]);
				for (let i=0; i<arrayLengths[key]; i++) {
					row.push(arr[i] || "");
				}
			} else {
			// Special case for "_dirname" key, created by options.js
				if (key !== "_dirname") {
					row.push(obj[key]);
				}
			}
		}
		return row;
	}));
}

function satisfiesQuery(row, query) {
	return ((typeof query === "undefined")
		|| query === null
		|| Object.keys(query).length === 0
		|| (query.id === null && query.title === null)
		|| row.id === query.id
		|| row.title === query.title);
}

function multiplyCards(cards, renderedCards, quantity) {
	// Duplicate cards according to the specified number of multiples
	let multipliedCards = [];
	for (let i=0; i<cards.length; i++) {
		let card = cards[i];
		let renderedCard = renderedCards[i];
		for (let j=0; j<quantity; j++) {
			for (let k=0; k<(card.get("/count")||1); k++) {
				multipliedCards.push(renderedCard);
			}
		}
	}
	return multipliedCards;
}

module.exports = {
	ARRAY_REGEX,
	serializeFieldKey,
	moveProperty,
	csvToObjects,
	objectsToCsv,
	satisfiesQuery,
	multiplyCards
};
