"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RecipeParser = undefined;

var _cooksIllustratedParser = require("./cooks-illustrated-parser");

var _scrubCooksIllustrated = require("./scrub-cooks-illustrated");

var _seriousEatsParser = require("./serious-eats-parser");

var _scrubSeriousEats = require("./scrub-serious-eats");

var _foodNetworkParser = require("./food-network-parser");

var _scrubFoodNetwork = require("./scrub-food-network");

var _macGourmetExport = require("./mac-gourmet-export");

var mod_RecipeParser = RecipeParser;


// Expose internal libs.
function mRequire(name, file) {
  return RecipeParser[name] = require(file);
}

mRequire('util', './util');
mRequire('log', './log');

// Expose some metadata.
var pkg = mRequire('package', '../package.json');
RecipeParser.version = pkg.version;

/**
 * Expose internals.
 */
function RecipeParser(options) {
  options = options || {};
  this.options = options;
}

RecipeParser.prototype.getParser = function (name) {
  switch (name) {
    case 'se':
      return new _seriousEatsParser.seriouseatsparserjs();
    case 'ci':
    case 'atk':
    case 'cc':
      return new _cooksIllustratedParser.cooksillustratedparserjs();
    case 'fn':
      return new _foodNetworkParser.FoodNetworkRecipeParser();
  }
};

RecipeParser.prototype.getScraper = function (name) {
  switch (name) {
    case 'se':
      return _scrubSeriousEats.scrubseriouseatsjs;
    case 'ci':
    case 'atk':
    case 'cc':
      return _scrubCooksIllustrated.scrubcooksillustratedjs;
    case 'fn':
      return _scrubFoodNetwork.scrubfoodnetworkjs;
  }
};

RecipeParser.prototype.getExporter = function (name) {
  switch (name) {
    case 'mgd':
      return new _macGourmetExport.macgourmetexportjs();
  }
};

/**
 * Expose internals.
 */
exports.RecipeParser = mod_RecipeParser;