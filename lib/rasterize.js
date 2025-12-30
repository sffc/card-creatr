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

/* eslint-env browser */

const async = require("async");
const PDFKit = require("pdfkit");
const fs = require("fs");
const streamBuffers = require("stream-buffers");
const blobToBuffer = require("blob-to-buffer");
const JSZip = require("jszip");
const tmp = require("tmp");
const path = require("path");

function svgToPng(svgBuffer, width, height, numPages, format, next) {
	if (format !== "png" || numPages !== 1) {
		return next(new Error("Only 1-page png format is supported"));
	}
	let SVGtoPNG;
	try {
		// If svg-to-png is installed, use it.
		SVGtoPNG = require("svg-to-png");
	} catch(e) {
		// If not, try using the canvas painter.
		_canvasDrawOne(svgBuffer, width, height, 1, function(){}, 0, next);
		return;
	}
	async.auto({
		"tmpdir": (_next) => {
			tmp.dir({ unsafeCleanup: true }, _next);
		},
		"input": ["tmpdir", (results, _next) => {
			var inputPath = path.join(results.tmpdir[0], "img.svg");
			fs.writeFile(inputPath, svgBuffer, (err) => {
				_next(err, inputPath);
			});
		}],
		"output": ["tmpdir", "input", (results, _next) => {
			var outputPath = path.join(results.tmpdir[0], "img.png");
			SVGtoPNG.convert(results.input, results.tmpdir[0], {
				defaultWidth: width,
				defaultHeight: height
			}).then(() => {
				_next(null, outputPath);
			}).catch((err) => {
				_next(err);
			});
		}],
		"load": ["output", (results, _next) => {
			fs.readFile(results.output, _next);
		}],
		"cleanup": ["tmpdir", "load", (results, _next) => {
			results.tmpdir[1](); // cleanupCallback
			_next();
		}]
	}, (err, results) => {
		next(err, results.load);
	});
}

// Converts non-ASCII characters to XML entities.
function xmlescape(str) {
	var newString = "";
	for (var char of str) {
		var cp = char.codePointAt(0);
		if (cp <= 0x7F) {
			newString += char;
		} else {
			newString += "&#x" + cp.toString(16) + ";";
		}
	}
	return newString;
}

function _createCanvas(widthPx, heightPx) {
	try {
		const canvas = document.createElement("canvas");
		canvas.width = widthPx;
		canvas.height = heightPx;
		return {
			canvas,
			toBuffer(canvas, { progress, page }, next) {
				canvas.toBlob((blob) => {
					progress({ page, name: "blob" });
					blobToBuffer(blob, next);
				}, "image/png");
			},
		};
	} catch(e) {
		// fall through
	}
	try {
		const { Canvas } = require("skia-canvas");
		const canvas = new Canvas(widthPx, heightPx);
		return {
			canvas,
			toBuffer(canvas, _ignored, next) {
				canvas.toBuffer("png").then((buffer) => {
					next(null, buffer);
				}).catch((err) => {
					next(err);
				});
			},
		};
	} catch(e) {
		// fall through
	}
	console.error("ALERT: To use PNG output, please install 'skia-canvas@3' or 'svg-to-png@4' or run in a browser environment");
}

function _createImage() {
	try {
		return new Image();
	} catch(e) {
		// fall through
	}
	try {
		const { Image } = require("skia-canvas");
		return new Image();
	} catch(e) {
		// fall through
	}
	console.error("ALERT: To use PNG output, please install 'skia-canvas@3' or 'svg-to-png@4' or run in a browser environment");
}

function _base64encode(svgBuffer) {
	if ("string" === typeof svgBuffer) {
		return btoa(xmlescape(svgBuffer));
	} else {
		// Works on Node 25+ or shim in index.js
		return new Uint8Array(svgBuffer).toBase64();
	}
}

// This function is currently intended to be run from a browser context rather than a node context.
// Uses canvas.drawImage() to convert svg to canvas, then canvas.toBlob() to convert canvas to png.
// eslint-env browser
function canvasDrawImage(svgBuffer, widthPt, heightPt, scale, numPages, progress, next) {
	var widthPx = scale * widthPt;
	var heightPx = scale * heightPt;
	// eslint-ignore-next-line no-undef
	var img = _createImage();
	img.onload = () => {
		// HACK: Wait a little bit for the fonts to load. Font load events in document.fonts don't seem to fire for the SVG.
		setTimeout(() => {
			async.times(numPages, (i, _next) => {
				const { canvas, toBuffer } = _createCanvas(widthPx, heightPx);
				progress({ page: i, name: "init" });
				// HACK: Electron Chromium in August 2019 prints a strange transparent rectangle when the drawImage height is greater than or equal to the canvas size. To work around this, subtract off a small amount of pixels when drawing the image.
				canvas.getContext("2d").drawImage(img, 0, -i*heightPx, widthPx, heightPx*numPages - 0.001);
				progress({ page: i, name: "canvas" });
				toBuffer(canvas, { progress, page: i }, _next);
			}, (err, pngBuffers) => {
				if (err) return next(err);
				next(null, pngBuffers);
			});
		}, 250);
	};
	img.onerror = (/* event */) => {
		progress({ page: 0, name: "error" });
		setTimeout(() => {
			next(new Error("Could not render SVG (syntax error?)"));
		}, 100);
	};
	img.src = "data:image/svg+xml;base64," + _base64encode(svgBuffer);
}

function _canvasDrawOne(svgBuffer, widthPt, heightPt, scale, progress, pageNumber, next) {
	var widthPx = scale * widthPt;
	var heightPx = scale * heightPt;
	var img = _createImage();
	img.onload = () => {
		// HACK: Wait a little bit for the fonts to load. Font load events in document.fonts don't seem to fire for the SVG.
		setTimeout(() => {
			const { canvas, toBuffer } = _createCanvas(widthPx, heightPx);
			progress({ page: pageNumber, name: "init" });
			// HACK: Electron Chromium in August 2019 prints a strange transparent rectangle when the drawImage height is greater than or equal to the canvas size. To work around this, subtract off a small amount of pixels when drawing the image.
			canvas.getContext("2d").drawImage(img, 0, 0, widthPx, heightPx - 0.001);
			progress({ page: pageNumber, name: "canvas" });
			toBuffer(canvas, { progress, page: 0 }, next);
		}, 250);
	};
	img.onerror = (/* event */) => {
		progress({ page: pageNumber, name: "error" });
		setTimeout(() => {
			next(new Error("Could not render SVG (syntax error?)"));
		}, 100);
	};
	img.src = "data:image/svg+xml;base64," + _base64encode(svgBuffer);
}

// Like canvasDrawImage but works with an array of SVG page buffers.
function canvasDrawImage2(svgBuffers, widthPt, heightPt, scale, progress, next) {
	async.map(svgBuffers.map((buffer, i) => [buffer, i]), ([buffer, i], _next) => {
		_canvasDrawOne(buffer, widthPt, heightPt, scale, progress, i, _next);
	}, next);
}

function pngListToDestinationPdf(filename, pngBuffers, width, height, next) {
	var writeStream;
	if (filename) {
		writeStream = fs.createWriteStream(filename);
	} else {
		writeStream = new streamBuffers.WritableStreamBuffer();
	}
	writeStream.on("finish", () => {
		if (filename) {
			next(null, null);
		} else {
			next(null, writeStream.getContents());
		}
	});
	pngListToPdfStream(writeStream, pngBuffers, width, height);
}

function pngListToPdfStream(writeStream, pngBuffers, width, height) {
	var doc = new PDFKit({
		autoFirstPage: false,
	});
	doc.pipe(writeStream);
	for (var i=0; i<pngBuffers.length; i++) {
		var imgBuf = pngBuffers[i];
		doc.addPage({
			size: [width, height]
		});
		doc.image(imgBuf, 0, 0, { width: width, height: height });
	}
	doc.end();
}

function pngListToPngsZip(filename, pngBuffers, width, height, next) {
	var zip = new JSZip();
	var f = new Intl.NumberFormat("en", { minimumIntegerDigits: 3 });
	for (let i=0; i<pngBuffers.length; i++) {
		zip.file("card_" + f.format(i) + ".png", pngBuffers[i]);
	}
	zip.generateNodeStream({ type:"nodebuffer", streamFiles:true })
		.pipe(fs.createWriteStream(filename))
		.on("finish", next);
}

module.exports = { svgToPng, canvasDrawImage, canvasDrawImage2, pngListToDestinationPdf, pngListToPdfStream, pngListToPngsZip };
