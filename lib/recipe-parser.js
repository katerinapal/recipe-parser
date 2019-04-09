Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = RecipeParser;

var _cooksIllustratedParser = require("./cooks-illustrated-parser");

var _cooksIllustratedParser2 = _interopRequireDefault(_cooksIllustratedParser);

var _scrubCooksIllustrated = require("./scrub-cooks-illustrated");

var CooksIllustratedScraper = _interopRequireWildcard(_scrubCooksIllustrated);

var _seriousEatsParser = require("./serious-eats-parser");

var _seriousEatsParser2 = _interopRequireDefault(_seriousEatsParser);

var _scrubSeriousEats = require("./scrub-serious-eats");

var SeriousEatsScraper = _interopRequireWildcard(_scrubSeriousEats);

var _foodNetworkParser = require("./food-network-parser");

var _foodNetworkParser2 = _interopRequireDefault(_foodNetworkParser);

var _scrubFoodNetwork = require("./scrub-food-network");

var FoodNetworkScraper = _interopRequireWildcard(_scrubFoodNetwork);

var _macGourmetExport = require("./mac-gourmet-export");

var _macGourmetExport2 = _interopRequireDefault(_macGourmetExport);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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
      return new _seriousEatsParser2.default();
    case 'ci':
    case 'atk':
    case 'cc':
      return new _cooksIllustratedParser2.default();
    case 'fn':
      return new _foodNetworkParser2.default();
  }
};

RecipeParser.prototype.getScraper = function (name) {
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

RecipeParser.prototype.getExporter = function (name) {
  switch (name) {
    case 'mgd':
      return new _macGourmetExport2.default();
  }
};
module.exports = exports.default;
