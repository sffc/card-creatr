"use strict";

const async = require("async");
const datauri = require("datauri");
const imageSize = require("image-size");
const path = require("path");

function convertPaths(obj, dirname) {
	for (let key of Object.keys(obj)) {
		let _obj = obj[key];
		if (key === "path") {
			// Convert to the absolute path
			obj[key] = path.join(dirname, _obj);
		} else if (typeof _obj === "object" && _obj !== null) {
			// Recurse through the object
			convertPaths(_obj, dirname);
		}
	}
}

function loadDataUris(obj) {
	for (let key of Object.keys(obj)) {
		let _obj = obj[key];
		if (key === "path") {
			// Load path as base64
			// FIXME: Make async
			obj.dataUri = new datauri(obj[key]).content;
		} else if (typeof _obj === "object" && _obj !== null) {
			// Recurse through the object
			loadDataUris(_obj);
		}
	}
}

function getDimensions(obj, next) {
	async.each(
		Object.keys(obj),
		(key, _next) => {
			let _obj = obj[key];
			if (key === "image") {
				// Get the dimensions
				imageSize(_obj.path, (err, result) => {
					_obj.dims = result;
					_next(err);
				});
			} else if (typeof _obj === "object" && _obj !== null) {
				// Recurse through the object
				getDimensions(_obj, _next);
			} else {
				_next(null);
			}
		},
		next
	);
}

function getDimensionsSync(obj) {
	for (let key of Object.keys(obj)) {
		let _obj = obj[key];
		if (key === "image") {
			// Get the dimensions
			_obj.dims = imageSize(_obj.path);
		} else if (typeof _obj === "object" && _obj !== null) {
			// Recurse through the object
			getDimensionsSync(_obj);
		}
	}
}

function assignDeep(dest) {
	let sources = Array.prototype.slice.call(arguments, 1);
	for (let source of sources) {
		for (let key of Object.keys(source)) {
			if (typeof source[key] !== "object") {
				// Primitive type
				dest[key] = source[key];
			} else if (dest.hasOwnProperty(key)) {
				// Recurse on object
				assignDeep(dest[key], source[key]);
			} else {
				// Shallow copy of object
				dest[key] = Object.assign({}, source[key]);
			}
		}
	}
	return dest;
}

function moveProperty(obj, oldKey, newKey) {
	if (obj.hasOwnProperty(oldKey) && !obj.hasOwnProperty(newKey)) {
		obj[newKey] = obj[oldKey];
	}
	delete obj[oldKey];
}

module.exports = {
	convertPaths,
	loadDataUris,
	getDimensions,
	getDimensionsSync,
	assignDeep,
	moveProperty
};
