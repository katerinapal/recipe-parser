"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RecipeParser = undefined;

var _cooksIllustratedParser = require("./cooks-illustrated-parser");

var _scrubCooksIllustrated = require("./scrub-cooks-illustrated");

var scrubcooksillustrated_scrapejs = _interopRequireWildcard(_scrubCooksIllustrated);

var _seriousEatsParser = require("./serious-eats-parser");

var _scrubSeriousEats = require("./scrub-serious-eats");

var scrubseriouseats_scrapejs = _interopRequireWildcard(_scrubSeriousEats);

var _foodNetworkParser = require("./food-network-parser");

var _scrubFoodNetwork = require("./scrub-food-network");

var scrubfoodnetwork_scrapejs = _interopRequireWildcard(_scrubFoodNetwork);

var _macGourmetExport = require("./mac-gourmet-export");

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

// Expose internal libs.
function mRequire(name, file) {
  return RecipeParser[name] = require(file);
}

mRequire('util', './util');
mRequire('log', './log');

// Expose some metadata.
var pkg = mRequire('package', '../package.json');
RecipeParser.version = pkg.version;

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
      return scrubseriouseats_scrapejs;
    case 'ci':
    case 'atk':
    case 'cc':
      return scrubcooksillustrated_scrapejs;
    case 'fn':
      return scrubfoodnetwork_scrapejs;
  }
};

RecipeParser.prototype.getExporter = function (name) {
  switch (name) {
    case 'mgd':
      return new _macGourmetExport.macgourmetexportjs();
  }
};
var exported_RecipeParser = RecipeParser;

/**
 * Expose internals.
 */
exports.RecipeParser = exported_RecipeParser;
