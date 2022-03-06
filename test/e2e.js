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

/* eslint-env mocha */

// This is a high-level, end-to-end test that runs most code paths.

const expect = require("expect");
const fs = require("fs");
const path = require("path");
const ReadAndRender = require("..").ReadAndRender;
const isCI = require("is-ci");

// Change this to TRUE to generate new test data and overwrite the old test data. (Never commit with the value set to true!)
const OVERWRITE_EXPECTATIONS = false;

const CONFIG_PATH = path.join(__dirname, "..", "demo", "config.hjson");
const CCSB_PATH = path.join(__dirname, "..", "demo.ccsb");

const EXPECTED_SVG_PATH = path.join(__dirname, "cases", "cash.svg");
const EXPECTED_SVG = fs.readFileSync(EXPECTED_SVG_PATH);

const EXPECTED_AUTO_PATH = path.join(__dirname, "cases", "auto.svg");
const EXPECTED_AUTO = fs.readFileSync(EXPECTED_AUTO_PATH);

const EXPECTED_PNG_PATH = path.join(__dirname, "cases", "cash.png");
const EXPECTED_PNG = fs.readFileSync(EXPECTED_PNG_PATH);

// const EXPECTED_PDF_PATH = path.join(__dirname, "cases", "cash.pdf");
// const EXPECTED_PDF = fs.readFileSync(EXPECTED_PDF_PATH);

const EXPECTED_PAGE_PATH = path.join(__dirname, "cases", "page1.svg");
const EXPECTED_PAGE = fs.readFileSync(EXPECTED_PAGE_PATH);

const EXPECTED_PAGE_CONCAT_PATH = path.join(__dirname, "cases", "page_concat.svg");
const EXPECTED_PAGE_CONCAT = fs.readFileSync(EXPECTED_PAGE_CONCAT_PATH);

// const EXPECTED_MULTIPAGE_PDF_PATH = path.join(__dirname, "cases", "multipage.pdf");
// const EXPECTED_MULTIPAGE_PDF = fs.readFileSync(EXPECTED_MULTIPAGE_PDF_PATH);


function maybeOverwriteExpected(path, buffer) {
	if (!OVERWRITE_EXPECTATIONS) return;
	// eslint-disable-next-line no-console
	console.log("overwriting:", path);
	fs.writeFileSync(path, buffer);
}


function expectBufferEquals(a, b) {
	var result = a.equals(b);
	if (!result) {
		var index = 0;
		var minLength = Math.min(a.length, b.length);
		for (; index < minLength; index++) {
			if (a.readUInt8(index) !== b.readUInt8(index)) {
				let start = Math.max(index - 20, 0);
				let end = Math.min(index + 20, minLength - 1);
				let left = a.toString("utf-8", start, end);
				let right = b.toString("utf-8", start, end);
				throw new Error(`Buffers not equal: differ at index ${index}: '${left}' != '${right}' (Note: lengths are ${a.length} and ${b.length})`);
			}
		}
		throw new Error(`Buffers not same length: ${a.length} vs. ${b.length}`);
	}
}


describe("ReadAndRender", function() {

	// Asynchronous load function
	describe("#load()", function() {
		this.timeout(30000);
		it("should produce the expected SVG output for config.hjson", function(done) {
			var inst = new ReadAndRender(CONFIG_PATH, { query: { title: "Cash Out" } });
			inst.load((err) => {
				if (err) return done(err);
				try {
					var buffer = inst.run(-1, 1, "svg");
					maybeOverwriteExpected(EXPECTED_SVG_PATH, buffer);
					expectBufferEquals(buffer, EXPECTED_SVG);
					return done(null);
				} catch(err) {
					return done(err);
				}
			});
		});
		it("should produce the expected SVG output for config.ccsb", function(done) {
			var inst = new ReadAndRender(CCSB_PATH, { query: { title: "Cash Out" } });
			inst.load((err) => {
				if (err) return done(err);
				try {
					var buffer = inst.run(-1, 1, "svg");
					maybeOverwriteExpected(EXPECTED_SVG_PATH, buffer);
					expectBufferEquals(buffer, EXPECTED_SVG);
					return done(null);
				} catch(err) {
					return done(err);
				}
			});
		});
		it("should produce the expected PNG output for config.hjson", function(done) {
			var inst = new ReadAndRender(CONFIG_PATH, { query: { title: "Cash Out" } });
			inst.load((err) => {
				if (err) return done(err);
				try {
					inst.run(-1, 1, "png", (err, buffer) => {
						if (err) return done(err);
						maybeOverwriteExpected(EXPECTED_PNG_PATH, buffer);
						expectBufferEquals(buffer, EXPECTED_PNG, 0.95);
						return done(null);
					});
				} catch(err) {
					return done(err);
				}
			});
		});
		it("should produce the expected PNG output for config.ccsb", function(done) {
			var inst = new ReadAndRender(CCSB_PATH, { query: { title: "Cash Out" } });
			inst.load((err) => {
				if (err) return done(err);
				try {
					inst.run(-1, 1, "png", (err, buffer) => {
						if (err) return done(err);
						maybeOverwriteExpected(EXPECTED_PNG_PATH, buffer);
						expectBufferEquals(buffer, EXPECTED_PNG, 0.95);
						return done(null);
					});
				} catch(err) {
					return done(err);
				}
			});
		});
		it("should produce the expected Page 1 output for config.hjson", function(done) {
			var inst = new ReadAndRender(CONFIG_PATH, {});
			inst.load((err) => {
				if (err) return done(err);
				try {
					var buffer = inst.run(1, 2, "svg");
					maybeOverwriteExpected(EXPECTED_PAGE_PATH, buffer);
					expectBufferEquals(buffer, EXPECTED_PAGE);
					return done(null);
				} catch(err) {
					return done(err);
				}
			});
		});
		it("should produce the expected Concatenated Pages output for config.hjson", function(done) {
			var inst = new ReadAndRender(CONFIG_PATH, {});
			inst.load((err) => {
				if (err) return done(err);
				try {
					var buffer = inst.run(-2, 5, "svg");
					maybeOverwriteExpected(EXPECTED_PAGE_CONCAT_PATH, buffer);
					expectBufferEquals(buffer, EXPECTED_PAGE_CONCAT);
					return done(null);
				} catch(err) {
					return done(err);
				}
			});
		});
		// TODO: Fix and re-enable multi-page PDF output.
		/*
		it("should produce the expected multipage PDF output using slimerjs for config.hjson", function(done) {
			this.timeout(5000);
			var inst = new ReadAndRender(CONFIG_PATH, {});
			inst.load((err) => {
				if (err) return done(err);
				try {
					inst.run(-2, 5, "pdf", (err, buffer) => {
						if (err) return done(err);
						maybeOverwriteExpected(EXPECTED_MULTIPAGE_PDF_PATH, buffer);
						// The PDF seems to contain numbers that sometimes differ.  Just check the length for equality.
						expect(EXPECTED_MULTIPAGE_PDF.length === buffer.length);
						return done(null);
					});
				} catch(err) {
					return done(err);
				}
			});
		});
		*/
		it("should produce the expected SVG output for fontRenderMode=auto", function(done) {
			var inst = new ReadAndRender(CONFIG_PATH, { fontRenderMode: "auto" }, { query: { title: "Cash Out" } });
			inst.load((err) => {
				if (err) return done(err);
				try {
					var buffer = inst.run(-1, 1, "svg");
					maybeOverwriteExpected(EXPECTED_AUTO_PATH, buffer);
					expectBufferEquals(buffer, EXPECTED_AUTO);
					return done(null);
				} catch(err) {
					return done(err);
				}
			});
		});
	});

	// Synchronous load function
	describe("#loadSync()", function() {
		it("should produce the expected SVG output for config.hjson", function() {
			var inst = new ReadAndRender(CONFIG_PATH, { query: { title: "Cash Out" } });
			inst.loadSync();
			var buffer = inst.run(-1, 1, "svg");
			maybeOverwriteExpected(EXPECTED_SVG_PATH, buffer);
			expectBufferEquals(buffer, EXPECTED_SVG);
		});
		it("should throw error for config.ccsb", function() {
			var inst = new ReadAndRender(CCSB_PATH, {});
			expect(inst.loadSync.bind(inst)).toThrow(/Sync is not supported when reading ccsb files/);
		});
	});

});
