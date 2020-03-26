import {   cooksillustratedparserjs as cooksillustratedparser_cooksillustratedparserjsjs, } from "./cooks-illustrated-parser";
import { scrape as scrubcooksillustrated_scrapejs } from "./scrub-cooks-illustrated";
import { seriouseatsparserjs as seriouseatsparser_seriouseatsparserjsjs } from "./serious-eats-parser";
import { scrape as scrubseriouseats_scrapejs } from "./scrub-serious-eats";
import { FoodNetworkRecipeParser as foodnetworkparser_FoodNetworkRecipeParserjs } from "./food-network-parser";
import { scrape as scrubfoodnetwork_scrapejs } from "./scrub-food-network";
import { macgourmetexportjs as macgourmetexport_macgourmetexportjsjs } from "./mac-gourmet-export";

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

RecipeParser.prototype.getParser = function(name) {
  switch (name) {
    case 'se':
      return new seriouseatsparser_seriouseatsparserjsjs();
    case 'ci':
    case 'atk':
    case 'cc':
      return new cooksillustratedparser_cooksillustratedparserjsjs();
    case 'fn':
      return new foodnetworkparser_FoodNetworkRecipeParserjs();
  }
};

RecipeParser.prototype.getScraper = function(name) {
  switch (name) {
    case 'se':
      return SeriousEatsScraper;
    case 'ci':
    case 'atk':
    case 'cc':
      return CooksIllustratedScraper;
    case 'fn':
      return FoodNetworkScraper;
  }
};

RecipeParser.prototype.getExporter = function(name) {
  switch (name) {
    case 'mgd':
      return new macgourmetexport_macgourmetexportjsjs();
  }
};
var exported_RecipeParser = RecipeParser;

/**
 * Expose internals.
 */
export { exported_RecipeParser as RecipeParser };
