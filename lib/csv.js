"use strict";

const async = require("async");
const csvParse = require("csv-parse");
const csvParseSync = require("csv-parse/lib/sync");
const csvStringify = require("csv-stringify");
const utils = require("./utils");

const CSV_PARSER_OPTIONS = { auto_parse: true };
const CSV_STRINGIFY_OPTIONS = { quoted: true, quotedEmpty: true };


function csvBufferToObjects(buffer, next) {
	async.waterfall([
		(_next) => {
			csvParse(buffer.toString("utf-8"), CSV_PARSER_OPTIONS, _next);
		},
		(csvRows, _next) => {
			let objects = [];
			utils.csvToObjects(csvRows).forEach((obj, i) => {
				if (typeof obj.id === "undefined") {
					obj.id = "id" + (1e6 + i);
				}
				objects.push(obj);
			});
			_next(null, objects);
		}
	], next);
}

function csvBufferToObjectsSync(buffer) {
		var csvRows = csvParseSync(buffer.toString("utf-8"), CSV_PARSER_OPTIONS);
		var objects = [];
		utils.csvToObjects(csvRows).forEach((obj, i) => {
			if (typeof obj.id === "undefined") {
				obj.id = "id" + (1e6 + i);
			}
			objects.push(obj);
		});
		return objects;
}

function objectsToCsvBuffer(objects, next) {
	async.waterfall([
		(_next) => {
			let csvRows = utils.objectsToCsv(objects);
			csvStringify(csvRows, CSV_STRINGIFY_OPTIONS, _next);
		},
		(csvString, _next) => {
			let buffer = Buffer.from(csvString, "utf-8");
			_next(null, buffer);
		}
	], next);
}

module.exports = {
	csvBufferToObjects,
	csvBufferToObjectsSync,
	objectsToCsvBuffer
};
