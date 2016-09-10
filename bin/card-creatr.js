#!/usr/bin/env node
"use strict";

const async = require("async");
const fs = require("fs");
const path = require("path");
const ReadAndRender = require("../lib/read-and-render");
const PageRenderer = require("../lib/page");
const SvgHolder = require("../lib/svg");

const optionList = [
	{
		name: "template",
		type: String,
		typeLabel: "[underline]{file}",
		description: "Path to the *.pug file containing the SVG template.",
		defaultValue: path.join(__dirname, "..", "demo", "template.pug")
	},
	{
		name: "data",
		type: String,
		typeLabel: "[underline]{file}",
		description: "Path to the spreadsheet containing the card data.",
		defaultValue: path.join(__dirname, "..", "demo", "cards.csv")
	},
	{
		name: "config",
		alias: "c",
		type: String,
		typeLabel: "[underline]{file}",
		description: "Path to the JSON or HJSON config file.",
		defaultValue: path.join(__dirname, "..", "demo", "config.hjson")
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
		description: "Number of times to print each card.",
		defaultValue: 1
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
if (options.help) {
	console.log(require("command-line-usage")(usageList));
	process.exit(0);
}

// Create the ReadAndRender instance
const inst = new ReadAndRender(options.config, {
	template: {
		path: options.template
	},
	data: {
		path: options.data
	},
	query: {
		id: options.id,
		title: options.title,
		multiples: options.multiples
	}
});

// Perform the main computation
async.auto({
	"cards": (_next) => {
		inst.run(_next);
	},
	"print": ["cards", (results, _next) => {
		var svgHolder = new SvgHolder();
		svgHolder.fonts = inst.options.fonts;
		if (options.page !== -1) {
			let pageRenderer = new PageRenderer(inst.options.viewports.page);
			svgHolder.width = inst.options.dimensions.page.width;
			svgHolder.height = inst.options.dimensions.page.height;
			svgHolder.content = pageRenderer.render(results.cards)[options.page-1];
		} else {
			svgHolder.width = inst.options.dimensions.card.width;
			svgHolder.height = inst.options.dimensions.card.height;
			svgHolder.content = results.cards[0];
		}
		svgHolder.finalize(process.stdout);
		process.stdout.write("\n");
	}]
}, (err) => {
	if (err) {
		console.error("Error:", err.message);
		fs.writeFileSync("card-creatr.log", err.stack + "\n");
		console.error("More information available in card-creatr.log");
		process.exit(1);
		return;  // not needed?
	}
});
