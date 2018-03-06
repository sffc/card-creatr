"use strict";

const async = require("async");
const PDFKit = require("pdfkit");
const fs = require("fs");
const streamBuffers = require("stream-buffers");
const blobToBuffer = require("blob-to-buffer");

var Rsvg = null;
var SlimerjsCapture = null;

try {
	Rsvg = require("librsvg").Rsvg;
} catch(err) {}

try {
	SlimerjsCapture = require("slimerjs-capture");
} catch(err) {}

function rsvg(svgBuffer, width, height, numPages, format) {
	// TODO: The "dpi" setting is not currently being used.
	var client = new Rsvg(svgBuffer);
  var result = client.render({
    format: format,
    width: width,
    height: height*numPages
  }).data;
  return result;
}

function slimerjs(svgBuffer, width, height, scale, numPages, format, filename, next) {
	// Note: JPG in slimerjs-capture is not supported yet.
	SlimerjsCapture.capturePngPages(svgBuffer, "svg", width*scale, height*scale, numPages, (err, pngBuffers) => {
		if (err) return next(err);
		if (format === "png") {
			next(null, pngBuffers[0]);
		} else if (format === "pdf") {
			pngListToDestination(filename, pngBuffers, width, height, next);
		} else {
			next(new Error("Unsupported format in slimerjs:", format));
		}
	});
}

// This function is currently intended to be run from a browser context rather than a node context.
// Uses canvas.drawImage() to convert svg to canvas, then canvas.toBlob() to convert canvas to png.
function canvasDrawImage(svgBuffer, widthPt, heightPt, scale, numPages, filename, progress, next) {
	var widthPx = scale * widthPt;
	var heightPx = scale * heightPt;
	var img = new Image();
	img.onload = () => {
		async.times(numPages, (i, _next) => {
			var canvas = document.createElement("canvas");
			canvas.width = widthPx;
			canvas.height = heightPx;
			progress({ page: i, name: "init" });
			canvas.getContext("2d").drawImage(img, 0, -i*heightPx, widthPx, heightPx*numPages);
			progress({ page: i, name: "canvas" });
			canvas.toBlob((blob) => {
				progress({ page: i, name: "blob" });
				blobToBuffer(blob, _next);
			}, "image/png");
		}, (err, pngBuffers) => {
			if (err) return next(err);
			pngListToDestination(filename, pngBuffers, widthPt, heightPt, next);
		});
	}
	img.src = "data:image/svg+xml;utf8," + svgBuffer;
}

function pngListToDestination(filename, pngBuffers, width, height, next) {
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
	var doc = new PDFKit({ autoFirstPage: false });
	doc.pipe(writeStream);
	for (var i=0; i<pngBuffers.length; i++) {
		var imgBuf = pngBuffers[i];
		console.log("adding page", i, imgBuf.length)
		doc.addPage({
			width: width,
			height: height
		});
		doc.image(imgBuf, 0, 0, { width: width, height: height });
	}
	doc.end();
}

module.exports = { rsvg, slimerjs, canvasDrawImage, pngListToPdfStream };
