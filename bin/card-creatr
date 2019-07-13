#!/usr/bin/env node
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

"use strict";

const fs = require("fs");
const log = require("../lib/logger")("card-creatr");
const mime = require("mime");
const ReadAndRender = require("../lib/read-and-render");

const optionList = [
	{
		name: "input",
		alias: "i",
		type: String,
		typeLabel: "{underline file}",
		description: "Path to either a *.ccsb bundle file or a JSON/HJSON config file.",
	},
	{
		name: "output",
		alias: "o",
		type: String,
		typeLabel: "{underline file}",
		description: "Path to the output file.  Supported file types are *.svg and *.png.  If omitted, an SVG will be printed to standard out.",
	},
	{
		name: "template",
		type: String,
		typeLabel: "{underline file}",
		description: "Path to the *.pug file containing the SVG template.",
	},
	{
		name: "data",
		type: String,
		typeLabel: "{underline file}",
		description: "Path to the spreadsheet containing the card data.",
	},
	{
		name: "id",
		type: String,
		typeLabel: "{underline string}",
		description: "The 'id' of the row in the data file you would like to render.  Requires that one of the columns in your data file to be named 'id'.",
		defaultValue: null
	},
	{
		name: "title",
		type: String,
		typeLabel: "{underline string}",
		description: "The 'title' value of the row in the data file you would like to render.  Requires one of the columns in your data file to be named 'title'.",
		defaultValue: null
	},
	{
		name: "page",
		type: Number,
		description: "Generate a page layout for printing instead of an individual card layout.  For example, '--page 2' will generate the second page of cards.",
		defaultValue: -1
	},
	{
		name: "multiples",
		type: Number,
		description: "Number of times to print each card.  Relevant only if 'page' is specified.",
		defaultValue: 1
	},
	{
		name: "sync",
		type: Boolean,
		description: "Whether to run Card Creatr using the slower synchronous API.  Most users can ignore this option.",
		defaultValue: false
	},
	{
		name: "options",
		type: String,
		typeLabel: "{underline json}",
		description: "Additional options to override those in the config.hjson file.  Provide a JSON string: '\\\{ \"key1\": \"value1\", ... \\\}'",
		defaultValue: null
	},
	{
		name: "help",
		alias: "h",
		description: "Print this usage guide.",
		type: Boolean	
	}
];

const usageList = [
	{
		header: "Card Creatr",
		content: "Command-line utility designed for generating custom playing cards using pug templates and data stored in a spreadsheet file."
	},
	{
		header: "Options",
		optionList: optionList
	}
];

log.trace("options");
const options = require("command-line-args")(optionList);
if (options.help || !options.input) {
	console.log(require("command-line-usage")(usageList));
	process.exit(0);
}

// Create the ReadAndRender instance
log.trace("inst");
const inst = new ReadAndRender(
	options.input,
	options.options ? JSON.parse(options.options) : {},
	{
		"template (path)": options.template,
		"data (path)": options.data,
		query: {
			id: options.id,
			title: options.title
		}
	}
);

// Compute output format
var format = "svg";
if (options.output) {
	let type = mime.lookup(options.output);
	if (type === "image/png") format = "png";
	if (type === "application/pdf") format = "pdf";
}

// Perform the main computation
log.trace("run");
if (options.sync) {
	try {
		inst.loadSync();
		inst.run(options.page, options.multiples, format, (err, outputBuffer) => {
			if (err) {
				afterError(err);
			} else {
				afterRun(outputBuffer);
			}
		});
	} catch(err) {
		afterError(err);
	}
} else {
	inst.load((err) => {
		if (err) {
			afterError(err);
			return;
		}
		try {
			inst.run(options.page, options.multiples, format, (err, outputBuffer) => {
				if (err) {
					afterError(err);
				} else {
					afterRun(outputBuffer);
				}
			});
		} catch(err) {
			afterError(err);
		}
	});
}

function afterError(err) {
	log.trace("afterError");
	if (err) {
		console.error("Error:", err.message);
		fs.writeFileSync("card-creatr.log", err.stack + "\n");
		console.error("More information available in card-creatr.log");
		process.exit(1);
	}
}

function afterRun(outputBuffer) {
	log.trace("afterRun");
	if (options.output) {
		fs.writeFile(options.output, outputBuffer, afterSave);
	} else {
		process.stdout.write(outputBuffer);
		afterSave();
	}
	log.trace("done");
}

function afterSave(err) {
	if (err) return afterError(err);
	// allow node.js to exit
}
