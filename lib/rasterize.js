"use strict";

const async = require("async");
const PDFKit = require("pdfkit");
const fs = require("fs");
const streamBuffers = require("stream-buffers");
const blobToBuffer = require("blob-to-buffer");
const JSZip = require("jszip");

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
			pngListToDestinationPdf(filename, pngBuffers, width, height, next);
		} else {
			next(new Error("Unsupported format in slimerjs:", format));
		}
	});
}

// This function is currently intended to be run from a browser context rather than a node context.
// Uses canvas.drawImage() to convert svg to canvas, then canvas.toBlob() to convert canvas to png.
function canvasDrawImage(svgBuffer, widthPt, heightPt, scale, numPages, progress, next) {
	var widthPx = scale * widthPt;
	var heightPx = scale * heightPt;
	var img = new Image();
	img.onload = () => {
		// HACK: Wait a little bit for the fonts to load. Font load events in document.fonts don't seem to fire for the SVG.
		setTimeout(() => {
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
				next(null, pngBuffers);
			});
		}, 250);
	}
	img.src = "data:image/svg+xml;utf8," + svgBuffer;
}

function _canvasDrawOne(svgBuffer, widthPt, heightPt, scale, progress, pageNumber, next) {
	var widthPx = scale * widthPt;
	var heightPx = scale * heightPt;
	var img = new Image();
	img.onload = () => {
		// HACK: Wait a little bit for the fonts to load. Font load events in document.fonts don't seem to fire for the SVG.
		setTimeout(() => {
			var canvas = document.createElement("canvas");
			canvas.width = widthPx;
			canvas.height = heightPx;
			progress({ page: pageNumber, name: "init" });
			canvas.getContext("2d").drawImage(img, 0, 0, widthPx, heightPx);
			progress({ page: pageNumber, name: "canvas" });
			canvas.toBlob((blob) => {
				progress({ page: pageNumber, name: "blob" });
				blobToBuffer(blob, (err, pngBuffer) => {
					if (err) return next(err);
					next(null, pngBuffer);
				});
			}, "image/png");
		}, 250);
	}
	img.src = "data:image/svg+xml;utf8," + svgBuffer;
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
		console.log("adding page", i, imgBuf.length)
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

module.exports = { rsvg, slimerjs, canvasDrawImage, canvasDrawImage2, pngListToDestinationPdf, pngListToPdfStream, pngListToPngsZip };
