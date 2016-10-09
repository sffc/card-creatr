"use strict";

const Rsvg = require("librsvg").Rsvg;
const fs = require("fs");

function render(buffer, dimensions, format) {
	var rsvg = new Rsvg(buffer);
  var result = rsvg.render({
    format: format,
    width: dimensions.width,
    height: dimensions.height
  }).data;
  return result;
}

module.exports = { render };
