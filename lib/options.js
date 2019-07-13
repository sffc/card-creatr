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

/* options.js
 *
 * This file contains logic to read and process information in Card Creatr configuration files, which, as you can see from the amount of code here, is more involved than one might think.  The functions in this file are mostly internal, and they serve the following purposes.
 *
 * parseFieldKey: Parses keys like "template (path)", "image (img,path)", and "body []" into their components, which include the field name (like "template"), the properties (like {path:true}), and an array boolean (false for "template" and "image", but true for "body").
 *
 * convertKeysToFields: Inputs raw configuration objects like
 *   {
 *     "template (path)": "hello.pug",
 *     "foo": { ... }
 *   }
 * then parses their keys using parseFieldKey, and outputs objects like
 *   {
 *     template: {
 *       name: "template",
 *       properties: { path: true },
 *       value: "hello.pug"
 *     },
 *     foo: {
 *       name: "foo",
 *       properties: {},
 *       value: { ... }
 *     }
 *   }
 *
 * getAllFieldNames: Inputs the result of convertKeysToFields for several configuration objects, and returns a list of all the unique field names in those objects.  For example, one object containing field names ["template", "foo"] and another containing ["template", "bar"] would result in ["template", "foo", "bar"].
 *
 * isConsumable: Returns whether a particular field has a nested object beneath it that needs to be visited recursively.  For example, in the example above, "foo" would return true, and "template" would return false.
 *
 * consume and consumeSync: Async and sync versions of the recursive consume function.  These functions take an array of configuration sources, in order from highest priority to lowest priority.  If the same non-consumable (terminal) field is present in multiple source configurations, the value from the first such source is used and the others are ignored.  That value will be passed to processField/processFieldSync.  If a field is consumable, all sources containing an entry for it are recursed.  These functions call convertKeysToFields, getAllFieldNames, and isConsumable.
 *
 * processField and processFieldSync: Async and sync versions of the function that interprets a terminal field value, such as "template" from the example above.  This is the function that performs application logic on the field properties.  If the field has property "path", the data from the file at that path is read into a buffer; if the field has property "img", the dimensions of the image are read; and if the field has property "font", it is read into a WordWrappr instance via opentype.js.
 *
 * class Options: The public interface to this file.  An instance of Options will allow you to add sources to be interpreted, read fields from the configuration, and add callbacks for when fields are available.  Reading fields requires the full field name; for example, "/template" for the top-level field called "template", or "/foo/bar" for the field "bar" nested underneath the field "foo".
 */

"use strict";

const async = require("async");
const fs = require("fs");
const imageSize = require("image-size");
const mime = require("mime");
const path = require("path");
const WordWrappr = require("word-wrappr");
const utils = require("./utils");

const FIELD_NAME_REGEX = /^\w+/;
const PROPERTIES_REGEX = /\(([\w,]+)\)/;

const DEFAULT_OPTIONS = {
	fonts: {
		"title (font)": WordWrappr.getDejaVuPath("DejaVuSerifCondensed", "Bold"),
		"body (font)": WordWrappr.getDejaVuPath("DejaVuSerifCondensed")
	},
	fontRenderMode: "auto"
};

const PLACEHOLDER_PNG = fs.readFileSync(path.join(__dirname, "placeholder.png"));

function parseFieldKey(key) {
	// Field name
	let nameResult = FIELD_NAME_REGEX.exec(key);
	if (nameResult === null) {
		throw new Error("Cannot parse field with key '" + key + "'");
	}
	let name = nameResult[0];

	// Properties
	let propertiesResult = PROPERTIES_REGEX.exec(key);
	let properties = {};
	if (propertiesResult !== null) {
		propertiesResult[1].split(",").forEach((property) => {
			properties[property] = true;
		});
	}

	// Is Array
	let array = utils.ARRAY_REGEX.test(key);

	return { name, properties, array };
}

function convertKeysToFields(source) {
	var dest = {};
	for (let key of Object.keys(source)) {
		if (key[0] === "_") {
			// Skip private fields prefixed with '_'
			dest[key] = source[key];
		} else if (typeof source[key] === "undefined") {
			// Skip fields having an undefined value
			continue;
		} else {
			let field = parseFieldKey(key);
			if (typeof dest[field.name] !== "undefined") {
				throw new Error("Duplicate entry in same source for field '" + field.name + "'");
			}
			dest[field.name] = Object.assign({}, field, { value: source[key] });
		}
	}
	return dest;
}

function getAllFieldNames(sources) {
	var allFieldNames = Array.prototype.concat.apply([], sources.map((source) => {
		return Object.keys(source);
	}));
	// Get all unique fields based on the field name.
	// TODO: This is O(N^2); should be O(N log N) or less
	allFieldNames = allFieldNames.filter((fieldName, index, self) => {
		// Skip private fields prefixed with '_'
		return fieldName[0] !== "_" && self.indexOf(fieldName) === index;
	});
	return allFieldNames;
}

function isConsumable(field) {
	return !(field.value instanceof Array) && typeof field.value === "object" && field.value !== null;
}

function consumeSync(dest, previousFieldName, sources) {
	sources = sources.map((source) => { return convertKeysToFields(source); });
	var allFieldNames = getAllFieldNames(sources);

	for (let fieldName of allFieldNames) {
		let fullFieldName = previousFieldName + "/" + fieldName;
		let _sources = sources.filter((source) => { return typeof source[fieldName] !== "undefined"; });
		let isObject = isConsumable(_sources[0][fieldName]);


		// For a particular field, we expect all sources to be either values or objects, but not a mix.
		for (let i=0; i<_sources.length; i++) {
			let _isObject = isConsumable(_sources[i][fieldName]);
			if (_isObject !== isObject) {
				throw new Error("Inconsistent nesting for field with name '" + fullFieldName + "'");
			}
		}

		if (isObject) {
			// Recurse on object.
			if (typeof dest[fieldName] === "undefined") {
				dest[fieldName] = {};
			}
			// Copy the _dirname values down to the nested level
			_sources.forEach((source) => { source[fieldName].value._dirname = source._dirname; });
			consumeSync(dest[fieldName], fullFieldName, _sources.map((source) => { return source[fieldName].value; }));

		} else {
			// Attempt to save value.  Use only the first source.
			dest[fieldName] = processFieldSync(_sources[0][fieldName], dest[fieldName], _sources[0]._dirname);
		}

	}
}

function consume(dest, previousFieldName, sources, onLoadedCallback, next) {
	try {
		sources = sources.map((source) => { return convertKeysToFields(source); });
	} catch(err) {
		next(err);
		return;
	}
	var allFieldNames = getAllFieldNames(sources);

	async.each(
		allFieldNames,
		(fieldName, _next) => {
			let fullFieldName = previousFieldName + "/" + fieldName;
			let _sources = sources.filter((source) => { return typeof source[fieldName] !== "undefined"; });
			let isObject = isConsumable(_sources[0][fieldName]);

			// For a particular field, we expect all sources to be either values or objects, but not a mix.
			for (let i=0; i<_sources.length; i++) {
				let _isObject = isConsumable(_sources[i][fieldName]);
				if (_isObject !== isObject) {
					_next(new Error("Inconsistent nesting for field with name '" + fullFieldName + "'"));
					return;
				}
			}

			if (isObject) {
				// Recurse on object.
				if (typeof dest[fieldName] === "undefined") {
					dest[fieldName] = {};
				}
				// Copy the _dirname values down to the nested level
				_sources.forEach((source) => { source[fieldName].value._dirname = source._dirname; });
				consume(dest[fieldName], fullFieldName, _sources.map((source) => { return source[fieldName].value; }), onLoadedCallback, (err) => {
					if (err) {
						_next(err);
						return;
					}
					onLoadedCallback(fullFieldName, dest[fieldName]);
					_next(null);
				});

			} else {
				// Attempt to save value.  Use only the first source.
				processField(_sources[0][fieldName], dest[fieldName], _sources[0]._dirname, (err, result) => {
					if (err) {
						_next(err);
						return;
					}
					dest[fieldName] = result;
					onLoadedCallback(fullFieldName, dest[fieldName]);
					_next(null);
				});
			}
		},
		next
	);
}

function processFieldSync(field, oldValue, dirname) {
	const newValue = field.value;
	var result, buffer;

	const numProps = Object.keys(field.properties).length;
	if (numProps === 0) {
		// Primitive type
		result = newValue;

	} else if (field.properties.uint) {
		// Unsigned integer
		result = parseInt(newValue);

	} else if (field.properties.number) {
		// Parse as a number
		result = parseFloat(newValue);

	} else {
		result = {};

		var shouldLoadBuffer = (field.properties.path || field.properties.img || field.properties.font);

		// Read file if it is required for later steps
		if (shouldLoadBuffer) {
			result.dirname = dirname;
			let fn;
			if (typeof dirname === "function") {
				// Custom file reader function as dirname.
				result.path = newValue;
				result.mimeType = mime.lookup(result.path || "");
				fn = dirname;
			} else {
				// Default reading file from filesystem.
				result.path = path.join(dirname, newValue);
				result.mimeType = mime.lookup(result.path || "");
				fn = fs.readFileSync;
			}
			try {
				if (result.path == null) {
					throw new Error("Cannot load file from null path");
				}
				buffer = fn(result.path);
			} catch(err) {
				if (!field.properties.img) throw err;
				buffer = null;
			}
			// If file is not found, and the field has the "img" property, fail silently and load the placeholder image instead.
			if (buffer == null) {
				if (field.properties.img) {
					buffer = PLACEHOLDER_PNG;
					result.mimeType = mime.lookup("placeholder.png");
				} else {
					throw new Error("Could not load file: " + result.path + ": file loader function returned null");
				}
			}

			result.buffer = buffer;
			result.dataUri = `data:${ result.mimeType };base64,${ result.buffer.toString("base64") }`;
		}

		// Read image dimensions if field is an image
		if (field.properties.img) {
			result.dims = imageSize(buffer);
		}

		// Load WordWrappr if field is a font
		if (field.properties.font) {
			result.wrappr = new WordWrappr(buffer);
			result.wrappr.loadSync();
		}
	}

	return result;
}

function processField(field, oldValue, dirname, next) {
	const newValue = field.value;
	var result;

	async.series([
		(_next) => {
			if (Object.keys(field.properties).length === 0) {
				// Primitive type
				result = newValue;
				process.nextTick(() => {
					_next(null);
				});
			} else if (field.properties.uint) {
				// Unsigned integer
				result = parseInt(newValue);
				process.nextTick(() => {
					_next(null);
				});
			} else if (field.properties.number) {
				// Parse as a number
				result = parseFloat(newValue);
				process.nextTick(() => {
					_next(null);
				});
			} else {
				// The variable "result", the value we will end up saving in the options object, is not to be confused with the variable "results", the object for referencing intermediate results in async.auto.
				result = {};

				var shouldLoadBuffer = (field.properties.path || field.properties.img || field.properties.font);

				async.auto({
					"bufferInit": (__next) => {
						// Read file if it is required for later steps
						if (shouldLoadBuffer) {
							result.dirname = dirname;
							let fn;
							if (typeof dirname === "function") {
								// Custom file reader function as dirname.
								result.path = newValue;
								result.mimeType = mime.lookup(result.path || "");
								fn = dirname;
							} else {
								// Default reading file from filesystem.
								result.path = path.join(dirname, newValue);
								result.mimeType = mime.lookup(result.path || "");
								fn = fs.readFile;
							}
							if (result.path == null) {
								__next(null, new Error("Cannot load file from null path"), null);
							} else {
								fn(result.path, (_err, _buffer) => {
									__next(null, _err, _buffer);
								});
							}
						} else {
							process.nextTick(() => {
								__next(null, null, null);
							});
						}
					},
					"buffer": ["bufferInit", (results, __next) => {
						let err = results.bufferInit[0];
						let buffer = results.bufferInit[1];
						if (buffer === null) err = new Error("Could not load file: " + result.path + ": file loader function returned null");
						if (!err) return __next(null, buffer);
						// If file is not found, and the field has the "img" property, fail silently and load the placeholder image instead.
						if (field.properties.img) {
							result.mimeType = mime.lookup("placeholder.png");
							__next(null, PLACEHOLDER_PNG);
						} else {
							return __next(err);
						}
					}],
					"path": ["buffer", (results, __next) => {
						result.buffer = results.buffer;
						try {
							result.dataUri = `data:${ result.mimeType };base64,${ result.buffer.toString("base64") }`;
						} catch(err) {
							return __next(err);
						}
						__next(null);
					}],
					"img": ["buffer", (results, __next) => {
						// Read image dimensions if field is an image
						if (field.properties.img) {
							try {
								result.dims = imageSize(results.buffer);
							} catch(err) {
								return __next(err);
							}
						}
						return __next(null);
					}],
					"font": ["buffer", (results, __next) => {
						// Load WordWrappr if field is a font
						// process.nextTick() is not necessary because, as of this writing, wrappr.load() has no actual async components.
						if (field.properties.font) {
							result.wrappr = new WordWrappr(results.buffer);
							return result.wrappr.load(__next);
						}
						return __next(null);
					}]
				}, _next);
			}
		},
		(_next) => {
			// Post-processing (none at the moment)
			_next(null);
		}
	], (err) => {
		next(err, result);
	});
}

class Options {
	constructor() {
		this._data = {};
		this._sources = [];
		this._overrides = [];
		this._loaded = {};
		this._loadedListeners = {};
	}

	toObject() {
		return this._data;
	}

	get(fullFieldName) {
		var fieldNames = fullFieldName.split("/").slice(1);
		var result = this._data;
		for (var i=0; i<fieldNames.length; i++) {
			if (!result) {
				throw new Error("Cannot find field: " + fullFieldName);
			}
			result = result[fieldNames[i]];
		}
		return result;
	}

	/** The dirname parameter can be either a string or a function.  If it is a string, it should be the absolute path to the directory containing the source's assets.  If it is a function, the function needs to implement the API of both fs.readFile(path) and fs.readFileSync(path, callback). */
	addOverride(source, dirname) {
		source._dirname = dirname;
		this._overrides.push(source);
	}

	/** The dirname parameter can be either a string or a function.  If it is a string, it should be the absolute path to the directory containing the source's assets.  If it is a function, the function needs to implement the API of both fs.readFile(path) and fs.readFileSync(path, callback). */
	addPrimary(source, dirname) {
		source._dirname = dirname;
		this._sources.unshift(source);
	}

	/** The dirname parameter can be either a string or a function.  If it is a string, it should be the absolute path to the directory containing the source's assets.  If it is a function, the function needs to implement the API of both fs.readFile(path) and fs.readFileSync(path, callback). */
	addFallback(source, dirname) {
		source._dirname = dirname;
		this._sources.push(source);
	}

	addDefaultFallback() {
		this.addFallback(DEFAULT_OPTIONS, "");
	}

	loadSync() {
		var sources = [].concat(this._overrides, this._sources);
		consumeSync(this._data, "", sources);
		return this;
	}

	load(next) {
		var sources = [].concat(this._overrides, this._sources);
		consume(this._data, "", sources, this._onLoadedCallback.bind(this), (err) => {
			// Check for any remaining "onceLoaded" listeners
			if (this._loadedListeners) {
				for (let field of Object.keys(this._loadedListeners)) {
					for (let listener of this._loadedListeners[field]) {
						listener(null, null);
					}
				}
				this._loadedListeners = [];
			}
			next(err, this);
		});
	}

	_onLoadedCallback(fullFieldName, result) {
		// console.error("Field loaded:", fullFieldName);
		this._loaded[fullFieldName] = true;
		if (this._loadedListeners[fullFieldName]) {
			this._loadedListeners[fullFieldName].forEach((cb) => { cb(null, result); });
			delete this._loadedListeners[fullFieldName];
		}
	}

	/** NOTE: This function only works for async loading. */
	onceLoaded(fullFieldName, callback) {
		if (this._loaded[fullFieldName]) {
			process.nextTick(() => {
				callback(null, this.get(fullFieldName));
			});
		} else {
			if (!this._loadedListeners[fullFieldName]) {
				this._loadedListeners[fullFieldName] = [];
			}
			this._loadedListeners[fullFieldName].push(callback);
		}
	}
}

// Utility functions for export
Options.parseFieldKey = parseFieldKey;

module.exports = Options;

// FIXME: Put this comment somewhere
// By default, paths are assumed to be relative to the cwd, but in the config file, it is more useful if they are relative to the location of the config file.  This function converts all the paths in the config file to be relative to the config file.
