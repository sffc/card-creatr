#!/usr/bin/env node
"use strict";

const async = require("async");
const fs = require("fs");
const path = require("path");
const ReadAndRender = require("../lib/read-and-render");
const PageRenderer = require("../lib/page");
const rsvg = require("../lib/rsvg");
const streams = require("memory-streams");
const SvgHolder = require("../lib/svg");

const optionList = [
	{
		name: "config",
		alias: "c",
		type: String,
		typeLabel: "[underline]{file}",
		description: "Path to the JSON or HJSON config file.",
	},
	{
		name: "out",
		alias: "o",
		type: String,
		typeLabel: "[underline]{file}",
		description: "Path to the output file.  Supported file types are *.svg and *.png.  If omitted, an SVG will be printed to standard out.",
	},
	{
		name: "template",
		type: String,
		typeLabel: "[underline]{file}",
		description: "Path to the *.pug file containing the SVG template.",
	},
	{
		name: "data",
		type: String,
		typeLabel: "[underline]{file}",
		description: "Path to the spreadsheet containing the card data.",
	},
	{
		name: "id",
		type: String,
		typeLabel: "[underline]{string}",
		description: "The 'id' of the row in the data file you would like to render.  Requires that one of the columns in your data file to be named 'id'.",
		defaultValue: null
	},
	{
		name: "title",
		type: String,
		typeLabel: "[underline]{string}",
		description: "The 'title' value of the row in the data file you would like to render.  Requires one of the columns in your data file to be named 'title'.",
		defaultValue: null
	},
	{
		name: "page",
		type: Number,
		description: "Generate a page layout for printing instead of an individual card layout.",
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

const options = require("command-line-args")(optionList);
if (options.help || !options.config) {
	console.log(require("command-line-usage")(usageList));
	process.exit(0);
}

// Create the ReadAndRender instance
const inst = new ReadAndRender(options.config, {
	"template (path)": options.template,
	"data (path)": options.data,
	query: {
		id: options.id,
		title: options.title,
		multiples: options.multiples
	}
});

// Perform the main computation
if (options.sync) {
	try {
		let cards = inst.runSync();
		afterRun(cards);
	} catch(err) {
		afterError(err);
	}
} else {
	inst.run((err, cards) => {
		if (err) {
			afterError(err);
			return;
		}
		afterRun(cards);
	});
}

function afterError(err) {
	if (err) {
		console.error("Error:", err.message);
		fs.writeFileSync("card-creatr.log", err.stack + "\n");
		console.error("More information available in card-creatr.log");
		process.exit(1);
	}
}

function afterRun(cards) {
	if (cards.length === 0) {
		console.error("Error: No cards were found matching your query.");
		process.exit(1);
	}

	var dimensions;
	var svgHolder = new SvgHolder();
	svgHolder.fonts = inst.options.get("/fonts");
	if (options.page !== -1) {
		let pageRenderer = new PageRenderer(inst.options.get("/viewports/page"));
		dimensions = inst.options.get("/dimensions/page");
		svgHolder.width = dimensions.width + dimensions.unit;
		svgHolder.height = dimensions.height + dimensions.unit;
		svgHolder.content = pageRenderer.render(cards)[options.page-1];
	} else {
		dimensions = inst.options.get("/dimensions/card");
		svgHolder.width = dimensions.width + dimensions.unit;
		svgHolder.height = dimensions.height + dimensions.unit;
		svgHolder.content = cards[0];
	}

	if (options.out) {
		let extension = options.out.substring(options.out.length - 4);
		let format = "svg";
		if (extension === ".png") format = "png";
		if (extension === ".pdf") format = "pdf";
		if (format === "svg") {
			let writeStream = fs.createWriteStream(options.out);
			svgHolder.finalize(writeStream);
			writeStream.end();
		} else {
			let writeStream = new streams.WritableStream();
			svgHolder.finalize(writeStream);
			let svgBuffer = writeStream.toBuffer();
			let rasterBuffer = rsvg.render(svgBuffer, dimensions, format);
			fs.writeFile(options.out, rasterBuffer);
		}
	} else {
		svgHolder.finalize(process.stdout);
		process.stdout.write("\n");
	}
}
