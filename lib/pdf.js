"use strict";

const async = require("async");
const datauri = require("datauri");
const java = require("java");
const mvn = require("node-java-maven");

var svgUri = new datauri("out.svg").content;

mvn((err, mvnResults) => {
	if (err) return console.error(err);

	mvnResults.classpath.forEach(function(c) {
		console.log('adding ' + c + ' to classpath');
		java.classpath.push(c);
	});

	const Transcoder = java.import('org.apache.batik.transcoder.Transcoder');
	const TranscoderInput = java.import('org.apache.batik.transcoder.TranscoderInput');
	const TranscoderOutput = java.import('org.apache.batik.transcoder.TranscoderOutput');
	const FileOutputStream = java.import('java.io.FileOutputStream');
	const TIFFTranscoder = java.import('org.apache.batik.transcoder.image.TIFFTranscoder');

	async.auto({
		"file": (_next) => {
			console.log("s1");
			java.newInstance("java.io.File", "out.svg", _next);
		},
		"url": ["file", (results, _next) => {
			console.log("s2");
			results.file.toURL(_next);
		}],
		"urlStr": ["url", (results, _next) => {
			console.log("s3");
			results.url.toString(_next);
		}],
		"input": ["urlStr", (results, _next) => {
			console.log("s4");
			java.newInstance("org.apache.batik.transcoder.TranscoderInput", results.urlStr, _next);
		}],
		"outputStream": (_next) => {
			console.log("s5");
			java.newInstance("java.io.FileOutputStream", "pdfout.tiff", _next);
		},
		"output": ["outputStream", (results, _next) => {
			console.log("s6");
			java.newInstance("org.apache.batik.transcoder.TranscoderOutput", results.outputStream, _next);
		}],
		"transcoder": (_next) => {
			console.log("s7");
			java.newInstance("org.apache.batik.transcoder.image.TIFFTranscoder", _next);
		},
		"foo1": ["input", (results, _next) => {
			results.input.getURI(_next);
			var javaLangSystem = java.import('java.lang.System');
			javaLangSystem.err.printlnSync('Hello World');
		}],
		"foo2": ["foo1", (results, _next) => {
			console.log("foo1:", results.foo1);
		}],
		"transcode": ["input", "output", "transcoder", (results, _next) => {
			console.log("s8");
			// console.log(results);
			console.log("s9");
			var r = results.transcoder.transcodeSync(results.input, results.output);
			_next(r);
		}],
		"done": ["transcode", (results, _next) => {
			console.log("done?!");
		}]
	}, (err, results) => {
		console.error(err, results);
	});

	console.log("hiu");
	var j1 = java.newInstanceSync("java.io.File", "out.svg");
	console.log("hij1");
	var j2 = j1.toURLSync();
	console.log("hij2");
	var j3 = j2.toString();
	console.log("hi0");
	var input_transcoder = java.newInstanceSync("org.apache.batik.transcoder.TranscoderInput", j3);
	console.log("hiq");
	var ostream = java.newInstanceSync("java.io.FileOutputStream", "pdfout.png");
	console.log("hip");
	var output_transcoder = java.newInstanceSync("org.apache.batik.transcoder.TranscoderOutput", ostream);
	console.log("hi1");
	var transcoder = java.newInstanceSync("org.apache.batik.transcoder.image.PNGTranscoder");
	console.log("hi2");
	transcoder.transcodeSync(input_transcoder, output_transcoder);
	console.log("hi3");
	ostream.flushSync();
	console.log("hi4");
	ostream.closeSync();
	console.log("done");
});
