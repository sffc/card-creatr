"use strict";

function moveProperty(obj, oldKey, newKey) {
	if (obj.hasOwnProperty(oldKey) && !obj.hasOwnProperty(newKey)) {
		obj[newKey] = obj[oldKey];
	}
	delete obj[oldKey];
}

module.exports = {
	moveProperty
};
