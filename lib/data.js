"use strict";

const parser = require("@vote539/excel-as-json");

class CardReader {
	constructor(dataPath) {
		this.dataPath = dataPath;
	}

	loadSync() {
		this.data = parser.processFileSync(this.dataPath, null, false);
	}

	load(next) {
		parser.processFile(this.dataPath, null, false, (err, data) => {
			this.data = data;
			next(err);
		});
	}

	getByValue(key, value) {
		return this.data.filter((row) => {
			return row[key] === value;
		});
	}

	getByIndex(index) {
		return this.data.filter((row,i) => {
			return index === i;
		});
	}
}

module.exports = CardReader;
