"use strict";

const async = require("async");
const defaults = require("./defaults");
const log = require("../lib/logger")("ccsb");
const fs = require("fs");
const JSZip = require("jszip");
const mime = require("mime");
const Path = require("path");
const uuid = require("uuid");

class CcsbReader {
	constructor(path) {
		this.path = path;
	}

	setPath(path) {
		this.path = path;
	}

	loadSync() {
		// JSZip does not have sync methods.
		throw new Error("Sync is not supported when reading ccsb files.");
	}

	load(next) {
		if (!this.path) {
			// Create new file
			this.zip = new JSZip();
			this.writeFile(CcsbReader.DATA_PATH, "");
			this.writeFile(CcsbReader.CONFIG_PATH, defaults.getDefaultConfig());
			this.writeFile(CcsbReader.TEMPLATE_PATH, defaults.getDefaultTemplate());
			this.writeFile(CcsbReader.JSON_PATH, JSON.stringify({ fields: defaults.getDefaultFields() }));
			next(null);
		} else {
			// Load existing file
			async.waterfall([
				(_next) => {
					fs.readFile(this.path, _next);
				},
				async.asyncify(JSZip.loadAsync),
				(zip, _next) => {
					this.zip = zip;
					_next(null);
				}
			], (err) => {
				if (err) {
					console.error(err);
					next(new TypeError("The specified file is not a valid *.ccsb file.\n\nPlease close this window and try opening a different file."));
				} else {
					next(null);
				}
			});
		}
	}

	isLoaded() {
		return !!this.zip;
	}

	readFileSync() {
		throw new Error("Sync is not supported when reading ccsb files.");
	}

	readFile(path, next) {
		if (!path) return next(new Error("Source file is missing: " + path), null);
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

	listAllAssets(predicate) {
		if (!predicate) predicate = () => true;
		if (!this.zip) {
			log.debug("not ready to list assets from ccsb:", path);
			return next(new Error("You must call #load() before you can call #listAllAssets()"));
		}
		return this.zip.filter((_, file) => {
			if (file.name === CcsbReader.DATA_PATH) return false;
			if (file.name === CcsbReader.CONFIG_PATH) return false;
			if (file.name === CcsbReader.TEMPLATE_PATH) return false;
			if (file.name === CcsbReader.JSON_PATH) return false;
			if (file.name.substr(0, 9) === "__MACOSX/") return false;
			if (file.dir) return false;
			return predicate(file.name);
		}).map((file) => {
			return file.name;
		});
	}

	containsFile(path) {
		return this.zip.file(path) !== null;
	}

	/** Does NOT actually save the file to disk; use #save() for that. */
	writeFile(path, content) {
		if (!path) return;
		this.zip.file(path, content, { createFolders: true });
	}

	createFile(mimeType, folder, content) {
		let extension = mime.extension(mimeType);
		let filename = `${uuid.v4()}.${extension}`;
		let path = Path.join(folder, filename);
		this.zip.file(path, content, { createFolders: true });
		return path;
	}

	removeFile(path) {
		if (!path) return;
		this.zip.remove(path);
	}

	save(next) {
		if (!this.path) throw new Error("No path specified for zip file");
		this.zip
			.generateNodeStream({ type:"nodebuffer", streamFiles:true })
			.pipe(fs.createWriteStream(this.path))
			.on("finish", next);
	}
}

CcsbReader.DATA_PATH = "cards.csv";
CcsbReader.CONFIG_PATH = "config.hjson";
CcsbReader.TEMPLATE_PATH = "template.pug";
// "fields.json" for historical reasons
CcsbReader.JSON_PATH = "fields.json";

module.exports = CcsbReader;
