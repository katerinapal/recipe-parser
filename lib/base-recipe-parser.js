"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.baserecipeparserjs = undefined;

var _util = require("util");

var _util2 = _interopRequireDefault(_util);

var _pluralize = require("pluralize");

var _pluralize2 = _interopRequireDefault(_pluralize);

var _backbone = require("backbone");

var _backbone2 = _interopRequireDefault(_backbone);

var _natural = require("natural");

var _natural2 = _interopRequireDefault(_natural);

var _util3 = require("./util");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Nodejs libs.
var _ = _util3._;

var _measurements = ['bag', 'batch', 'block', 'bottle', 'box', 'bulb', 'bunch', 'can', 'container', 'crown', 'cube', 'cup', 'dash', 'dozen', 'drop', 'ear', 'envelope', 'feet', 'fillet', 'fluid ounce', 'gallon', 'gram', 'grind', 'half', 'handful', 'head', 'heart', 'inch', 'jar', 'large', 'leaf', 'liter', 'loaf', 'medium', 'mini', 'ounce', 'package', 'packet', 'part', 'pat', 'piece', 'pinch', 'pint', 'pouch', 'pound', 'quart', 'recipe', 'scoop', 'set', 'sheet', 'shot', 'side', 'slab', 'slice', 'small', 'splash', 'sprig', 'sprinkle', 'stalk', 'stem', 'stick', 'strip', 'tablespoon', 'teaspoon', 'tin', 'vial', 'whole'];
_measurements = _.union(_measurements, _.map(_measurements, function (measurement) {
  return _pluralize2.default.plural(measurement);
})).sort();

var _uncountableWords = ['dozen', 'small', 'medium', 'large', 'mini', 'whole'];
_uncountableWords.forEach(_pluralize2.default.addUncountableRule);

//(\d++(?! */))? *-? *(?:(\d+) */ *(\d+))?.*$  original
//Match the regular expression below and capture its match into backreference number 1 «(\d++(?! */))?»
//Between zero and one times, as many times as possible, giving back as needed (greedy) «?»
//Match a single digit 0..9 «\d++»
//Between one and unlimited times, as many times as possible, without giving back (possessive) «++»

//Assert that it is impossible to match the regex below starting at this position (negative lookahead) «(?! */)»
//Match the space character " " literally « *»
//Between zero and unlimited times, as many times as possible, giving back as needed (greedy) «*»
//Match the character "/" literally «/»

//Match the space character " " literally « *»
//Between zero and unlimited times, as many times as possible, giving back as needed (greedy) «*»

//Match the character "-" literally «-?»
//Between zero and one times, as many times as possible, giving back as needed (greedy) «?»

//Match the space character " " literally « *»
//Between zero and unlimited times, as many times as possible, giving back as needed (greedy) «*»

//Match the regular expression below «(?:(\d+) */ *(\d+))?»
//Between zero and one times, as many times as possible, giving back as needed (greedy) «?»
//Match the regular expression below and capture its match into backreference number 2 «(\d+)»
//Match a single digit 0..9 «\d+»
//Between one and unlimited times, as many times as possible, giving back as needed (greedy) «+»
//Match the character “ ” literally « *»
//Between zero and unlimited times, as many times as possible, giving back as needed (greedy) «*»
//Match the character “/” literally «/»
//Match the character “ ” literally « *»
//Between zero and unlimited times, as many times as possible, giving back as needed (greedy) «*»
//Match the regular expression below and capture its match into backreference number 3 «(\d+)»
//Match a single digit 0..9 «\d+»
//Between one and unlimited times, as many times as possible, giving back as needed (greedy) «+»

//Match any single character that is not a line break character «.*»
//Between zero and unlimited times, as many times as possible, giving back as needed (greedy) «*»
//Assert position at the end of the string (or before the line break at the end of the string, if any) «$»
//
//*(-|to)?                                     divider
//\d++(?:\.\d{1,2})?   match decimal
//
//(\d++(?:\.\d{1,2})?(?! *\/))? *(\d+ *\/ *\d+)? *(?:-|to)? *(\d++(?:\.\d{1,2})?(?! *\/))? *(\d+ *\/ *\d+)?.*$/;
//

var quantityRe = /(?:about\s+)?(\d+(?:\.\d{1,2})?(?! *\/))? *(\d+ *\/ *\d+)? *(?:-|–|to)? *(\d+(?:\.\d{1,2})?(?! *\/))? *(\d+ *\/ *\d+)?(.*)$/;
var punctStr = '[-!"#$%&\'()\\*+,\\.\\/:;<=>?@\\^_`{|}~]';
var parenthesesRe = /\(([^\)]*)\)/;
var parenthesesGlobalRe = /\(([^)]+?)\),?/g;
var frontParenthesesRe = /^\(([^\)]*)\)(.*)$/;
var whiteSpaceRe = /\s{2,}/g;
var directionTokenizerRe = /[,_]/;
// Instead of [^A-Za-z0-9_] for \W, I customized it to
// include the hyphen for words like half-and-half.
var wordTokenizerRe = /[^-a-z0-9_]+/i;

var parenthesesGroupRe = /\(([^)]*)\)/g;
var commaSplitterRe = /,/;
var andSplitterRe = /(?:\s+)?\band\s+/i;
var orSplitterRe = /(?:\s+)?\bor\s+/i;

// The module to be exported.
exports.baserecipeparserjs = baserecipeparserjs_baserecipeparserjs = _backbone2.default.Model.extend({
  initialize: function initialize() {
    this.splitComma = _.bind(this.splitOnRegex, this, commaSplitterRe);
    this.splitAnd = _.bind(this.splitOnRegex, this, andSplitterRe);
    this.splitOr = _.bind(this.splitOnRegex, this, orSplitterRe);

    this._words = [];
  },
  splitOnRegex: function splitOnRegex(regex, text) {
    // no state in regex engine so this is a hack around it to keep
    // us from splitting within a parentheses group.
    var filteredData = text,
        matches = text.match(parenthesesGroupRe);

    if (matches) {
      filteredData = text.replace(parenthesesGroupRe, '-placeholder-');
    }

    var arr = _.map(filteredData.split(regex), function (item) {
      return _.trim(item);
    });

    if (!matches) {
      return arr;
    }

    var j = 0;
    return _.map(arr, function (entry, i) {
      while (entry.indexOf('-placeholder-') >= 0) {
        entry = entry.replace(/-placeholder-/, matches[j++]);
      }
      return entry;
    });
  },
  isQuantity: function isQuantity(text) {
    if (!text) {
      return false;
    }

    // retval[0] represents from (where there is a `to` in the quantity)
    // retval[1] represents to (where there is a `to` in the quantity)
    var quantities = this.parseQuantity(text);
    var found = _.find(quantities, function (qty) {
      return qty.whole || qty.part;
    });
    return !!found;
  },
  parseQuantity: function parseQuantity(text) {
    var breakdown = {},
        retval = [],
        matches;

    text = text.replace(/\⁄/g, '/');
    matches = text.match(quantityRe);

    if (!matches) {
      return retval;
    }

    // remove the first element
    (0, _util3.remove)(matches, 0, 0);

    for (var i = 0; i < matches.length; i += 2) {
      if (matches.length >= i + 2) {
        retval.push({
          whole: matches[i],
          part: matches[i + 1]
        });
      } else if (matches.length >= i + 1) {
        retval.push({
          whole: matches[i]
        });
      }
    }

    // remove anything after 2nd element
    // retval[0] represents from (where there is a `to` in the quantity)
    // retval[1] represents to (where there is a `to` in the quantity)
    (0, _util3.remove)(retval, 2, 50);
    return retval;
  },
  pruneQuantity: function pruneQuantity(text) {
    text = text.replace(/\⁄/g, '/');
    var matches = text.match(quantityRe);

    if (!matches) {
      return;
    }

    var idx = 5;
    if (matches.length > idx) {
      return matches[idx];
    }
  },
  chopWordsFromFront: function chopWordsFromFront(text, array, from) {
    var tokenizer = new _natural2.default.RegexpTokenizer({ pattern: wordTokenizerRe }),
        matched,
        found = 0;

    var tokens = _.first(tokenizer.tokenize(text), from);
    for (var i = 0, l = tokens.length; i < l; i++) {
      if (_.indexOf(array, tokens[i].toLowerCase()) >= 0) {
        if (i > 0) {
          if (_.indexOf(_uncountableWords, tokens[i].toLowerCase()) < 0) {
            found = i + 1;
          }
        } else {
          found = i + 1;
        }
      } else {
        break;
      }
    }

    for (i = 0, l = found; i < l; i++) {
      text = text.replace(new RegExp(tokens[i] + punctStr + '?', 'i'), '').trim();
    }
    tokens.length = found;
    if (tokens.length) {
      matched = tokens.join(' ');
    }

    return {
      pruned: text,
      matched: matched
    };
  },
  getQuantity: function getQuantity(text) {
    var tokens = _.compact(_.map(this.parseQuantity(text), function (duple) {
      if (duple.whole && duple.part) {
        return duple.whole + ' ' + duple.part;
      } else if (duple.whole) {
        return duple.whole;
      } else if (duple.part) {
        return duple.part;
      }
    }));
    if (tokens.length) {
      return tokens.join(' to ');
    }
  },
  getMeasurement: function getMeasurement(text) {
    var prunedQuantity = this.pruneQuantity(text),
        altMeasurement,
        matches,
        obj;

    // check for existence of parentheses in front
    // '3 (10-ounce) bags flat-leaf spinach, stems removed, leaves washed and dried'
    matches = prunedQuantity.match(frontParenthesesRe);
    if (matches) {
      altMeasurement = matches[1];
      prunedQuantity = _.trim(matches[2]).replace(whiteSpaceRe, ' ');
    }

    obj = this.chopWordsFromFront(prunedQuantity, _measurements, 2) || {};
    if (altMeasurement) {
      obj.altMeasurement = altMeasurement;
    } else if (obj.matched && obj.pruned) {
      if (_.indexOf(_util3.altMeasurementTerms, obj.matched.toLowerCase()) >= 0) {
        // now test if front of pruned has parentheses,
        // indicating a measurment for can/bag, etc..
        // '1 can (14 1/2 ounces) diced tomatoes, drained'
        // {
        //   "pruned": "(14 1/2 ounces) diced tomatoes, drained",
        //   "matched": "can"
        // }
        matches = obj.pruned.match(frontParenthesesRe);
        if (matches) {
          obj.altMeasurement = matches[1];
          obj.pruned = _.trim(matches[2]).replace(whiteSpaceRe, ' ');
        }
      }
    }

    // '3 (10-ounce) bags flat-leaf spinach, stems removed, leaves washed and dried'
    // {
    //   pruned: 'flat-leaf spinach, stems removed, leaves washed and dried',
    //   matched: 'bags',
    //   altMeasurement: '10-ounce'
    // }
    return obj;
  },
  getDirectionsAndAlts: function getDirectionsAndAlts(text) {
    var descriptionObj = this.getDescriptions(text),
        tokenizer = new _natural2.default.RegexpTokenizer({ pattern: wordTokenizerRe }),
        tokenizerComma = new _natural2.default.RegexpTokenizer({ pattern: directionTokenizerRe }),
        descriptions = descriptionObj.descriptions,
        matchedDescriptions = descriptionObj.matchedDescriptions,
        parentheses = descriptionObj.parentheses,
        direction = descriptionObj.direction,
        matches,
        tokens;

    var directionClone,
        retval = [],
        matched,
        found,
        desc,
        alt,
        obj,
        tmp;

    _.each(_.zip(descriptions, matchedDescriptions), function (tuple) {
      tmp = alt = found = undefined;
      directionClone = _.clone(direction);
      desc = tuple[0];
      matched = tuple[1];

      if (matched) {
        // create tokens array of matched descriptions
        tokens = _.map(tokenizer.tokenize(matched), function (token) {
          return token.toLowerCase();
        });
      }

      if (directionClone) {
        // strip out parentheses from direction
        matches = directionClone.match(parenthesesGlobalRe); // there's only 1 for 1..2 descriptions
        if (matches) {
          // lets go with the last match (not foolproof by any means), but
          // when there's more than one pair of parentheses, who wins?
          // cut crosswise into very thin (1/16-inch) slices (about 2 tablespoons)
          alt = matches[matches.length - 1].match(parenthesesRe)[1];
          directionClone = directionClone.replace(matches[matches.length - 1], ''); // remove the parentheses from the direction
          directionClone = directionClone.trim().replace(whiteSpaceRe, ' '); // trim and replace extra spaces with one
        } else {
          var isQty;
          // lets try tokenizing the direction and look for a `quantity` missing parentheses
          tokens = _.map(tokenizerComma.tokenize(directionClone), function (token) {
            return token.trim().toLowerCase();
          });
          tokens = _.filter(tokens, function (token) {
            if (tokenizer.tokenize(token).length <= 5) {
              // hacky
              isQty = this.isQuantity(token);
              if (isQty) {
                found = true;
                alt = token;
              }
              return !isQty;
            }
            return true;
          }, this);
          if (found) {
            directionClone = tokens.join(', ');
          }
        }
      }

      if (parentheses) {
        // is parentheses a `quanity` or just a `note`?
        if (!this.isQuantity(parentheses)) {
          directionClone = _.compact([directionClone, parentheses]).join(', ');
        } else {
          alt = parentheses;
        }
      }

      obj = {
        alt: alt,
        direction: null
      };

      tmp = _.compact([matched, directionClone]);
      if (_.isEmpty(tmp)) {
        obj.direction = undefined;
      } else {
        obj.direction = tmp.join(', ');
      }
      retval.push(obj);
    }, this);

    //console.log(obj); // {alt: undefined, direction: 'fresh, or thawed if frozen'}
    //console.log('retval: ', retval);
    return retval;
  },
  getDescriptions: function getDescriptions(text) {
    var description = (this.getMeasurement(text) || {}).pruned,
        matchedDescriptions = [],
        parentheses,
        descriptions,
        isOrSplit,
        direction,
        matches,
        tmp;

    //console.log('>' + description);
    matches = this.splitComma(description);

    description = _.first(matches);
    // remove the first element, so we can join the remainder
    (0, _util3.remove)(matches, 0, 0);
    direction = matches.join(', ');

    // strip out parentheses
    matches = description.match(parenthesesRe);
    if (matches) {
      (0, _util3.remove)(matches, 0, 0); // remove the first element
      parentheses = _.first(matches);

      this.trigger('description:strip-parentheses', parentheses, description, function (err, retval) {
        if (!err) {
          parentheses = retval.parentheses;
          description = retval.description;
        }
      });
    }

    // split on `or` or `and`
    var ands = this.splitAnd(description);
    this.trigger('description:split-on-and', ands, function (err, retval) {
      // first try `and`
      if (!err) {
        descriptions = retval.descriptions;
      }
    });
    if (descriptions.length < 2) {
      var ors = this.splitOr(description);
      this.trigger('description:split-on-or', ors, null, function (err, retval) {
        // then try `or`
        if (!err) {
          descriptions = retval.descriptions;
        }
      });
      if (descriptions.length > 1) {
        isOrSplit = true; // so callee can build `isDivider` data struct
      }
    }

    // if first word contained in parentheses is `or` then split
    // think of it as an alternate ingredient.
    //   ex, (or cracked white peppercorns) vs (sweet or bittersweet)
    if (parentheses && parentheses.indexOf('or') === 0) {
      descriptions.push(this.splitOr(parentheses)[1]);
      this.trigger('description:split-on-or', descriptions, parentheses, function (err, retval) {
        if (!err) {
          parentheses = retval.parentheses;
          descriptions = retval.descriptions;
        }
      });
      if (descriptions.length > 1) {
        isOrSplit = true; // so callee can build `isDivider` data struct
      }
    }

    // clean up
    descriptions = _.map(descriptions, function (desc) {
      // trim and replace extra spaces with one
      return _.trim(desc.replace(whiteSpaceRe, ' '));
    });

    descriptions = _.map(descriptions, function (desc) {
      tmp = this.chopWordsFromFront(desc, this._words, 3) || {};
      matchedDescriptions.push(tmp.matched);
      return tmp.pruned;
    }, this);

    return {
      isOrSplit: !!isOrSplit,
      descriptions: descriptions,
      matchedDescriptions: matchedDescriptions,
      parentheses: parentheses,
      direction: direction
    };
  },
  getAllPieces: function getAllPieces(text) {
    var quantity = this.getQuantity(text),
        measurementObj = this.getMeasurement(text),
        // props: pruned, altMeasurement, matched
    descriptionObj = this.getDescriptions(text),
        // isOrSplit, descriptions, matchedDescriptions, parentheses, direction
    descriptions = descriptionObj.descriptions,
        directions = this.getDirectionsAndAlts(text),
        // [{direction, alt}[,{}, ...n]]
    quantities = [],
        measurementObjs = [];

    // build up the quantities, and measurement object lists
    for (var i = 0; i < descriptions.length; i++) {
      quantities.push(quantity);
      measurementObjs.push(measurementObj);
    }

    var zipDesc, zipMsr, zipDir, zipQty, retval;

    // If we have an more than one direction, the 2nd, 3rd, etc could
    // also be a quantity with different amounts, lets try
    retval = _.zip.apply(_, _.map(_.zip(descriptions, quantities, measurementObjs, directions), function (tuple, idx) {
      zipDesc = tuple[0];
      zipQty = tuple[1];
      zipMsr = tuple[2];
      zipDir = tuple[3];

      if (idx > 0) {
        // already know the first has been parsed
        if (this.isQuantity(zipDesc)) {
          // '2 tablespoons juice from+1+lemon' --> true
          zipQty = this.getQuantity(zipDesc);
          zipMsr = this.getMeasurement(zipDesc);
          zipDir = this.getDirectionsAndAlts(zipDesc);
          zipDesc = this.getDescriptions(zipDesc).descriptions.join('');
        }
      }

      return [zipDesc, zipQty, zipMsr, zipDir];
    }, this));

    // re-assign the lists with 2nd or more descriptions that happened
    // to also be a quantity and needed to be further parsed
    descriptionObj.descriptions = descriptions = retval[0];
    quantities = retval[1];
    measurementObjs = retval[2];
    directions = retval[3];

    // now back to regular business
    this.trigger('adjust:qty-desc-direc', {
      quantities: quantities,
      measurementObjs: measurementObjs,
      descriptionObj: descriptionObj,
      directions: directions
    }, function (err, retval) {
      if (!err) {
        // unzip return values
        descriptionObj.descriptions = retval.descriptions;
        directions = retval.directions;
        quantities = retval.quantities;
      }
    });

    var measurements = _.map(measurementObjs, function (obj) {
      return obj.matched;
    });

    // we are done
    return {
      quantities: quantities,
      measurements: measurements,
      descriptionObj: descriptionObj,
      directions: directions
    };
  },
  parseIngredient: function parseIngredient(text) {
    var allPieces = this.getAllPieces(text),
        quantities = allPieces.quantities,
        measurements = allPieces.measurements,
        descriptionObj = allPieces.descriptionObj,
        descriptions = descriptionObj.descriptions,
        directions = allPieces.directions;

    var retval = _.map(_.zip(descriptions, directions, quantities, measurements), function (tuple) {
      return {
        quantity: tuple[2],
        measurement: tuple[3],
        description: tuple[0],
        direction: tuple[1].direction,
        alt: tuple[1].alt
      };
    });

    _.each(retval, function (fixme) {
      for (var key in fixme) {
        if (!fixme[key]) {
          delete fixme[key];
        }
      }
    });

    if (descriptionObj.isOrSplit) {
      retval = {
        description: 'Or',
        isDivider: true,
        ingredients: retval
      };
    } else if (retval.length === 1) {
      retval = _.first(retval);
    }

    return retval;
  }
});
var baserecipeparserjs_baserecipeparserjs;
exports.baserecipeparserjs = baserecipeparserjs_baserecipeparserjs;