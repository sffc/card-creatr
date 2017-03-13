"use strict";

var Rsvg = null;
try {
	Rsvg = require("librsvg").Rsvg;
} catch(err) {
	console.error("Warning: librsvg not available.  PNG and PDF outputs will be disabled.")
}

function render(svgBuffer, dimensions, format) {
	if (!Rsvg) {
		throw new Error("librsvg is not available");
	}

	// TODO: The "dpi" setting is not currently being used.
	var rsvg = new Rsvg(svgBuffer);
  var result = rsvg.render({
    format: format,
    width: dimensions.width,
    height: dimensions.height
  }).data;
  return result;
}

module.exports = { render };
