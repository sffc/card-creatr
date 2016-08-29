#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const ReadAndRender = require("../lib/read-and-render");

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
		name: "row",
		type: Number,
		typeLabel: "[underline]{integer}",
		description: "Index of the row in the data file you would like to render.  Defaults to 0 (the first row).  Ignored if 'id' or 'title' is present.",
		defaultValue: 0
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

const inst = new ReadAndRender(options.config, {
	template: {
		path: options.template
	},
	data: {
		path: options.data
	},
	query: {
		row: options.row,
		id: options.id,
		title: options.title
	}
});

// var result;
// try {
// 	result = inst.runSync();
// 	if (result.length === 0) {
// 		throw new Error("No cards are available matching your query.");
// 	}
// } catch(e) {
// 	console.error("Error:", e.message);
// 	fs.writeFileSync("card-creatr.log", e.stack + "\n");
// 	console.error("More information available in card-creatr.log");
// 	process.exit(1);
// }

// process.stdout.write(result[0]);
// process.stdout.write("\n");

inst.run((err, result) => {
	if (err) {
		console.error("Error:", err.message);
		fs.writeFileSync("card-creatr.log", err.stack + "\n");
		console.error("More information available in card-creatr.log");
		process.exit(1);
		return;  // not needed?
	}

	process.stdout.write(result[0]);
	process.stdout.write("\n");
});
