Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.indexjs = undefined;

var _recipeParser = require("./lib/recipe-parser");

var RecipeParser = _interopRequireWildcard(_recipeParser);

function _interopRequireWildcard(obj) {
  if (obj && obj.__esModule) {
    return obj;
  } else {
    var newObj = {};if (obj != null) {
      for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];
      }
    }newObj.default = obj;return newObj;
  }
}

var indexjs = RecipeParser;
exports.indexjs = indexjs;
