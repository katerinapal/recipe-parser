import { cooksillustratedparserjs as CooksIllustratedRecipeParser } from "./cooks-illustrated-parser";
import * as CooksIllustratedScraper from "./scrub-cooks-illustrated";
import { seriouseatsparserjs as SeriousEatsRecipeParser } from "./serious-eats-parser";
import * as SeriousEatsScraper from "./scrub-serious-eats";
import { FoodNetworkRecipeParser } from "./food-network-parser";
import * as FoodNetworkScraper from "./scrub-food-network";
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
      return new FoodNetworkRecipeParser();
  }
};

RecipeParser.prototype.getScraper = function(name) {
  switch (name) {
    case 'se':
      return SeriousEatsScraper.SeriousEatsScraper;
    case 'ci':
    case 'atk':
    case 'cc':
      return CooksIllustratedScraper.CooksIllustratedScraper;
    case 'fn':
      return FoodNetworkScraper.FoodNetworkScraper;
  }
};

RecipeParser.prototype.getExporter = function(name) {
  switch (name) {
    case 'mgd':
      return new MacGourmetExport();
  }
};
var exported_RecipeParser = RecipeParser;

/**
 * Expose internals.
 */
export { exported_RecipeParser as RecipeParser };
