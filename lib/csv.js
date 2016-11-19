"use strict";

const async = require("async");
const csvParse = require("csv-parse");
const csvParseSync = require("csv-parse/lib/sync");
const utils = require("./utils");
const uuid = require("uuid");

const CSV_PARSER_OPTIONS = { auto_parse: true };


function csvBufferToObjects(buffer, next) {
	async.waterfall([
		(_next) => {
			csvParse(buffer.toString("utf-8"), CSV_PARSER_OPTIONS, _next);
		},
		(csvRows, _next) => {
			var objects = {};
			utils.csvToObjects(csvRows).forEach((obj) => {
				if (typeof obj.id === "undefined") {
					obj.id = uuid.v4();
				}
				objects[obj.id] = obj;
			});
			_next(null, objects);
		}
	], next);
}

function csvBufferToObjectsSync(buffer) {
		var csvRows = csvParseSync(buffer.toString("utf-8"), CSV_PARSER_OPTIONS);
		var objects = {};
		utils.csvToObjects(csvRows).forEach((obj) => {
			if (typeof obj.id === "undefined") {
				obj.id = uuid.v4();
			}
			objects[obj.id] = obj;
		});
		return objects;
}

function objectsToCsvBuffer(objects, next) {
	var csvRows = utils.objectsToCsv(objects);
	// TODO: CSV Writer
	throw new Error("CSV writer not implemented");
}

module.exports = {
	csvBufferToObjects,
	csvBufferToObjectsSync,
	objectsToCsvBuffer
};
