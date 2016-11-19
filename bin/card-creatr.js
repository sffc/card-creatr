#!/usr/bin/env node
"use strict";

const async = require("async");
const fs = require("fs");
const log = require("../lib/logger")("card-creatr");
const path = require("path");
const ReadAndRender = require("../lib/read-and-render");
const PageRenderer = require("../lib/page");
const rsvg = require("../lib/rsvg");
const streams = require("memory-streams");
const SvgHolder = require("../lib/svg");

const optionList = [
	{
		name: "input",
		alias: "i",
		type: String,
		typeLabel: "[underline]{file}",
		description: "Path to either a *.ccsb bundle file or a JSON/HJSON config file.",
	},
	{
		name: "output",
		alias: "o",
		type: String,
		typeLabel: "[underline]{file}",
		description: "Path to the output file.  Supported file types are *.svg, *.png, and *.pdf.  If omitted, an SVG will be printed to standard out.",
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
const inst = new ReadAndRender(options.input, {
	"template (path)": options.template,
	"data (path)": options.data,
	query: {
		id: options.id,
		title: options.title,
		multiples: options.multiples
	}
});

// Perform the main computation
log.trace("run");
if (options.sync) {
	try {
		inst.loadSync();
		let cards = inst.run();
		afterRun(cards);
	} catch(err) {
		afterError(err);
	}
} else {
	inst.load((err) => {
		if (err) {
			afterError(err);
			return;
		}
		let cards = inst.run();
		afterRun(cards);
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

function afterRun(cards) {
	log.trace("afterRun");
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

	log.trace("output");
	if (options.output) {
		let extension = options.output.substring(options.output.length - 4);
		let format = "svg";
		if (extension === ".png") format = "png";
		if (extension === ".pdf") format = "pdf";
		if (format === "svg") {
			log.trace("svg");
			let writeStream = fs.createWriteStream(options.output);
			svgHolder.finalize(writeStream);
			writeStream.end();
		} else {
			log.trace("rsvg");
			let writeStream = new streams.WritableStream();
			svgHolder.finalize(writeStream);
			let svgBuffer = writeStream.toBuffer();
			let rasterBuffer = rsvg.render(svgBuffer, dimensions, format);
			fs.writeFile(options.output, rasterBuffer);
		}
	} else {
		log.trace("stdout");
		svgHolder.finalize(process.stdout);
		process.stdout.write("\n");
	}
	log.trace("done");
}
