const Rsvg = require("librsvg").Rsvg;
const fs = require("fs");

var svg = new Rsvg();

// When finishing reading SVG, render and save as PNG image. 
svg.on('finish', function() {
  console.log('SVG width: ' + svg.width);
  console.log('SVG height: ' + svg.height);
  fs.writeFile('tiger.png', svg.render({
    format: 'png',
    width: 600,
    height: 400
  }).data);
});
 
// Stream SVG file into render instance. 
fs.createReadStream('out.svg').pipe(svg);
