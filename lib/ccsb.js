"use strict";

const async = require("async");
const log = require("../lib/logger")("ccsb");
const fs = require("fs");
const JSZip = require("jszip");

class CcsbReader {
	constructor(path) {
		this.path = path;
	}

	loadSync() {
		// JSZip does not have sync methods.
		throw new Error("Sync is not supported when reading ccsb files.");
	}

	load(next) {
		async.waterfall([
			(_next) => {
				fs.readFile(this.path, _next);
			},
			async.asyncify(JSZip.loadAsync),
			(zip, _next) => {
				this.zip = zip;
				_next(null);
			}
		], next);
	}

	readFileSync() {
		throw new Error("Sync is not supported when reading ccsb files.");
	}

	readFile(path, next) {
		if (!this.zip) {
			log.debug("not ready to read from ccsb:", path);
			return next(new Error("You must call #load() before you can call #readFile()"));
		}
		log.debug("reading file from ccsb:", path);
		async.waterfall([
			async.asyncify(() => {
				let file = this.zip.file(path);
				if (file === null) {
					throw new Error("Cannot find file in *.ccsb bundle: " + path);
				} else {
					return file.async("nodebuffer");
				}
			})
		], next);
	}

	/** Does NOT actually save the file to disk; use #save() for that. */
	writeFile(path, content) {
		this.zip.file(path, content);
	}

	save(next) {
		this.zip
			.generateNodeStream({ type:"nodebuffer", streamFiles:true })
			.pipe(fs.createWriteStream(this.path))
			.on("finish", next);
	}
}

CcsbReader.DATA_PATH = "cards.csv";
CcsbReader.CONFIG_PATH = "config.hjson";
CcsbReader.TEMPLATE_PATH = "template.pug";
CcsbReader.FIELDS_PATH = "fields.json";

module.exports = CcsbReader;
