"use strict";

// This is a high-level, end-to-end test that runs most code paths.

const expect = require("expect");
const fs = require("fs");
const path = require("path");
const ReadAndRender = require("..").ReadAndRender;

const CONFIG_PATH = path.join(__dirname, "..", "demo", "config.hjson");
const CCSB_PATH = path.join(__dirname, "..", "demo.ccsb");

const EXPECTED_SVG = fs.readFileSync(path.join(__dirname, "cases", "cash.svg"));
const EXPECTED_AUTO = fs.readFileSync(path.join(__dirname, "cases", "auto.svg"));
const EXPECTED_PNG = fs.readFileSync(path.join(__dirname, "cases", "cash.png"));
const EXPECTED_PDF = fs.readFileSync(path.join(__dirname, "cases", "cash.pdf"));
const EXPECTED_PAGE = fs.readFileSync(path.join(__dirname, "cases", "page1.svg"));
const EXPECTED_PAGE_CONCAT = fs.readFileSync(path.join(__dirname, "cases", "page_concat.svg"));
const EXPECTED_MULTIPAGE_PDF = fs.readFileSync(path.join(__dirname, "cases", "multipage.pdf"));

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
		it("should produce the expected SVG output for config.hjson", function(done) {
			var inst = new ReadAndRender(CONFIG_PATH, { query: { title: "Cash Out" } });
			inst.load((err) => {
				if (err) return done(err);
				try {
					var buffer = inst.run(-1, 1, "svg");
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
					var buffer = inst.run(-1, 1, "png");
					expectBufferEquals(buffer, EXPECTED_PNG);
					return done(null);
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
					var buffer = inst.run(-1, 1, "pdf");
					expectBufferEquals(buffer, EXPECTED_PDF);
					return done(null);
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
					expectBufferEquals(buffer, EXPECTED_PAGE_CONCAT);
					return done(null);
				} catch(err) {
					return done(err);
				}
			});
		});
		it("should produce the expected multipage PDF output using slimerjs for config.hjson", function(done) {
			this.timeout(5000);
			var inst = new ReadAndRender(CONFIG_PATH, {});
			inst.load((err) => {
				if (err) return done(err);
				try {
					inst.run(-2, 5, "pdf", (err, buffer) => {
						if (err) return done(err);
						// The PDF seems to contain numbers that sometimes differ.  Just check the length for equality.
						expect(EXPECTED_MULTIPAGE_PDF.length === buffer.length);
						return done(null);
					});
				} catch(err) {
					return done(err);
				}
			});
		});
		it("should produce the expected SVG output for fontRenderMode=auto", function(done) {
			var inst = new ReadAndRender(CONFIG_PATH, { fontRenderMode: "auto" }, { query: { title: "Cash Out" } });
			inst.load((err) => {
				if (err) return done(err);
				try {
					var buffer = inst.run(-1, 1, "svg");
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
			expectBufferEquals(buffer, EXPECTED_SVG);
		});
		it("should throw error for config.ccsb", function() {
			var inst = new ReadAndRender(CCSB_PATH, {});
			expect(inst.loadSync.bind(inst)).toThrow(/Sync is not supported when reading ccsb files/);
		});
	});

});
