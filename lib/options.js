"use strict";

const async = require("async");
const datauri = require("datauri");
const fs = require("fs");
const imageSize = require("image-size");
const path = require("path");
const WordWrappr = require("word-wrappr");

const FIELD_NAME_REGEX = /^\w+/;
const PROPERTIES_REGEX = /\(([\w,]+)\)/;
const ARRAY_REGEX = /\[\]/;

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

	// Array value indicator
	let isArray = ARRAY_REGEX.test(key);

	return { name, properties, isArray };
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
			if (field.isArray) {
				if (!dest[field.name]) {
					dest[field.name] = Object.assign({}, field, { value: [] });
				} else if (!(dest[field.name].value instanceof Array)) {
					throw new Error("Conflicting array types in same source for field '" + field.name + "'");
				}
				dest[field.name].value.push(source[key]);
			} else if (typeof dest[field.name] !== "undefined") {
				throw new Error("Duplicate entry in same source for field '" + field.name + "'");
			} else {
				dest[field.name] = Object.assign({}, field, { value: source[key] });
			}
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
	return !field.isArray && typeof field.value === "object" && field.value !== null;
}

function consumeSync(dest, previousFieldName, sources) {
	sources = sources.map((source) => { return convertKeysToFields(source) });
	var allFieldNames = getAllFieldNames(sources);

	for (let fieldName of allFieldNames) {
		let fullFieldName = previousFieldName + "/" + fieldName;
		let _sources = sources.filter((source) => { return typeof source[fieldName] !== "undefined" });
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
			// Copy the _dirname values down to the nester level
			_sources.forEach((source) => { source[fieldName].value._dirname = source._dirname });
			consumeSync(dest[fieldName], fullFieldName, _sources.map((source) => { return source[fieldName].value }));

		} else {
			// Attempt to save value.  Use only the first source.
			dest[fieldName] = processFieldSync(_sources[0][fieldName], dest[fieldName], _sources[0]._dirname);
		}
	}
}

function consume(dest, previousFieldName, sources, onLoadedCallback, next) {
	try {
		sources = sources.map((source) => { return convertKeysToFields(source) });
	} catch(err) {
		next(err);
		return;
	}
	var allFieldNames = getAllFieldNames(sources);

	async.each(
		allFieldNames,
		(fieldName, _next) => {
			let fullFieldName = previousFieldName + "/" + fieldName;
			let _sources = sources.filter((source) => { return typeof source[fieldName] !== "undefined" });
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
				_sources.forEach((source) => { source[fieldName].value._dirname = source._dirname });
				consume(dest[fieldName], fullFieldName, _sources.map((source) => { return source[fieldName].value }), onLoadedCallback, (err) => {
					onLoadedCallback(fullFieldName, dest[fieldName]);
					_next(err);
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
	var result;

	if (Object.keys(field.properties).length === 0) {
		// Primitive type
		result = newValue;

	} else {
		result = {};

		// Read file if field is a path
		if (field.properties.path) {
			result.path = path.join(dirname, newValue);
			result.buffer = fs.readFileSync(result.path);
			// FIXME: Remove dependency on datauri and just do it manually
			result.dataUri = new datauri().format(result.path, result.buffer).content;
		}

		// Read image dimensions if field is an image
		if (field.properties.img) {
			result.path = path.join(dirname, newValue);
			result.dims = imageSize(result.path);
		}

		// Load WordWrappr if field is a font
		if (field.properties.font) {
			result.path = path.join(dirname, newValue);
			result.wrappr = new WordWrappr(result.path);
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
			} else {
				result = {};
				async.parallel([
					(__next) => {
						// Read file if field is a path
						if (field.properties.path) {
							result.path = path.join(dirname, newValue);
							fs.readFile(result.path, (err, buffer) => {
								if (err) {
									return __next(err);
								}
								result.buffer = buffer;
								// FIXME: Remove dependency on datauri and just do it manually
								result.dataUri = new datauri().format(result.path, result.buffer).content;
								__next(null);
							});
						} else {
							process.nextTick(() => {
								__next(null);
							});
						}
					},
					(__next) => {
						// Read image dimensions if field is an image
						if (field.properties.img) {
							result.path = path.join(dirname, newValue);
							imageSize(result.path, (err, dims) => {
								result.dims = dims;
								__next(err);
							});
						} else {
							process.nextTick(() => {
								__next(null);
							});
						}
					},
					(__next) => {
						// Load WordWrappr if field is a font
						if (field.properties.font) {
							result.path = path.join(dirname, newValue);
							result.wrappr = new WordWrappr(result.path);
							result.wrappr.load(__next);
						} else {
							process.nextTick(() => {
								__next(null);
							});
						}
					}
				], _next);
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

	addPrimary(source, dirname) {
		source._dirname = dirname;
		this._sources.unshift(source);
	}

	addFallback(source, dirname) {
		source._dirname = dirname;
		this._sources.push(source);
	}

	loadSync() {
		consumeSync(this._data, "", this._sources);
		return this;
	}

	load(next) {
		consume(this._data, "", this._sources, this._onLoadedCallback.bind(this), (err) => {
			next(err, this);
		});
	}

	_onLoadedCallback(fullFieldName, result) {
		// console.error("Field loaded:", fullFieldName);
		this._loaded[fullFieldName] = true;
		if (this._loadedListeners[fullFieldName]) {
			this._loadedListeners[fullFieldName].forEach((cb) => { cb(null, result) });
			delete this._loadedListeners[fullFieldName];
		}
	}

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

module.exports = Options;

// FIXME: Put this comment somewhere
// By default, paths are assumed to be relative to the cwd, but in the config file, it is more useful if they are relative to the location of the config file.  This function converts all the paths in the config file to be relative to the config file.
