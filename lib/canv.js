var canvg = require("canvg");
var Canvas = require("canvas");
const fs = require("fs");

var canvas = new Canvas(0, 0, "pdf");
var svgStr = fs.readFileSync("out.svg", "utf-8");
console.log(svgStr.length)

canvg(canvas, svgStr);

fs.writeFileSync("canv.pdf", canvas.toBuffer());
