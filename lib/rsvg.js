"use strict";

const Rsvg = require("librsvg").Rsvg;
const fs = require("fs");

function render(buffer, dimensions, format) {
	// TODO: The "dpi" setting is not currently being used.
	var rsvg = new Rsvg(buffer);
  var result = rsvg.render({
    format: format,
    width: dimensions.width,
    height: dimensions.height
  }).data;
  return result;
}

module.exports = { render };
