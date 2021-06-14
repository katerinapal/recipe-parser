var mod_RecipeParser = RecipeParser;
import { cooksillustratedparserjs as CooksIllustratedRecipeParser } from "./cooks-illustrated-parser";
import { scrubcooksillustratedjs as CooksIllustratedScraper } from "./scrub-cooks-illustrated";
import { seriouseatsparserjs as SeriousEatsRecipeParser } from "./serious-eats-parser";
import { scrubseriouseatsjs as SeriousEatsScraper } from "./scrub-serious-eats";
import { FoodNetworkRecipeParser as foodnetworkparser_FoodNetworkRecipeParser } from "./food-network-parser";
import { scrubfoodnetworkjs as FoodNetworkScraper } from "./scrub-food-network";
import { macgourmetexportjs as MacGourmetExport } from "./mac-gourmet-export";

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

RecipeParser.prototype.getParser = function(name) {
  switch (name) {
    case 'se':
      return new SeriousEatsRecipeParser();
    case 'ci':
    case 'atk':
    case 'cc':
      return new CooksIllustratedRecipeParser();
    case 'fn':
      return new foodnetworkparser_FoodNetworkRecipeParser();
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
      return new MacGourmetExport();
  }
};

/**
 * Expose internals.
 */
export { mod_RecipeParser as RecipeParser };
