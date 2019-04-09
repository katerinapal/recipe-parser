import CooksIllustratedRecipeParser from "./cooks-illustrated-parser";
import * as CooksIllustratedScraper from "./scrub-cooks-illustrated";
import SeriousEatsRecipeParser from "./serious-eats-parser";
import * as SeriousEatsScraper from "./scrub-serious-eats";
import FoodNetworkRecipeParser from "./food-network-parser";
import * as FoodNetworkScraper from "./scrub-food-network";
import MacGourmetExport from "./mac-gourmet-export";

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
export default function RecipeParser(options) {
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
      return new FoodNetworkRecipeParser();
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
