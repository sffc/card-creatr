"use strict";

const async = require("async");
const imageSize = require("image-size");
const path = require("path");

function convertPaths(obj, dirname) {
	for (let key of Object.keys(obj)) {
		let _obj = obj[key];
		if (key === "path") {
			// Convert to the absolute path
			obj[key] = path.join(dirname, _obj);
		} else if (typeof _obj === "object") {
			// Recurse through the object
			convertPaths(_obj, dirname);
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
			} else if (_obj !== null && typeof _obj === "object") {
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
		} else if (typeof _obj === "object") {
			// Recurse through the object
			getDimensionsSync(_obj);
		}
	}
}

module.exports = {
	convertPaths,
	getDimensions,
	getDimensionsSync
};
