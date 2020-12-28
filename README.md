card-creatr
===========

*card-creatr* is a command-line utility that renders \*.ccsb files to SVG or PNG output.  A graphical user interface for this tool is [Card Creatr Studio](https://cardcreatr.sffc.xyz).

[![Node.js CI](https://github.com/sffc/card-creatr/workflows/Node.js%20CI/badge.svg)](https://github.com/sffc/card-creatr/actions)
[![npm version](http://img.shields.io/npm/v/card-creatr.svg?style=flat)](https://npmjs.org/package/card-creatr "View this project on npm")

## Command Line Usage

The npm package provides the binary *card-creatr*:

	$ npm install -g card-creatr
	$ card-creatr --help

You should provide an input and an output file.  The output file should be either SVG or PNG.

	$ card-creatr -i example.ccsb -o example.png

You can also provide the path to the config.hjson file in an unpacked \*.ccsb file (expanded as a zip archive).

## Library Usage

Node.js library functions are exposed for users who wish to invoke card-creatr programmatically.  These internals are not guaranteed to be stable, at least not until card-creatr reaches a major release milestone.  For examples of usage, see the source code of Card Creatr Studio.
