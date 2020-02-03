Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.macgourmetexportjs = undefined;

var _backbone = require("backbone");

var _backbone2 = _interopRequireDefault(_backbone);

var _url = require("url");

var _url2 = _interopRequireDefault(_url);

var _util = require("./util");

var util = _interopRequireWildcard(_util);

var _log = require("./log");

var log = _interopRequireWildcard(_log);

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

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

// Nodejs libs.
var _ = util._;

var macgourmetexportjs = _backbone2.default.Model.extend({
  initialize: function initialize() {},
  exportRecipe: function exportRecipe(item, source) {
    var obj = {};
    obj['AFFILIATE_ID'] = -1;

    // Add Categories
    var categories = obj['CATEGORIES'] = [];
    var addCategory = function addCategory(id, name, userAdded) {
      categories.push({
        CATEGORY_ID: id,
        ITEM_TYPE_ID: 102,
        NAME: name,
        USER_ADDED: userAdded
      });
    };
    _.each(item.categories, function (category) {
      addCategory(category.id, category.name, false);
    });

    // Add course
    if (item.course) {
      obj['COURSE_ID'] = parseInt(item.course.id, 10);
      obj['COURSE_NAME'] = item.course.name;
    } else {
      obj['COURSE_ID'] = 2;
      obj['COURSE_NAME'] = 'Main';
    }

    obj['CUISINE_ID'] = -1;
    obj['DIFFICULTY'] = 0;

    // Add directions
    var directions = obj['DIRECTIONS_LIST'] = [];
    var procText, procObj;
    _.each(item.procedures, function (procedure) {
      procText = _.trim(procedure.text);
      if (procText) {
        procText = util.trimMultipleWhiteSpace(procText);
        procObj = {
          VARIATION_ID: -1,
          LABEL_TEXT: procedure.header || '',
          IS_HIGHLIGHTED: false,
          DIRECTION_TEXT: procText
        };
        if (procedure.image && procedure.image.data) {
          procObj['IMAGE'] = procedure.image.data;
        }
        directions.push(procObj);
      }
    });

    // EQUIPMENT

    // Add main picture
    if (item.image && item.image.data) {
      obj['EXPORT_TYPE'] = 'BINARY';
      obj['IMAGE'] = item.image.data;
    }

    // Add Ingredients
    var list = obj['INGREDIENTS_TREE'] = [];
    (function walker(array, list, isTop) {
      if (_.isArray(array)) {
        _.each(array, function (item) {
          walker(item, list, isTop);
        });
      } else if (array.isDivider) {
        if ( /*!isTop &&*/array.description === 'Or') {
          //flatten if not on top
          var tmpDesc = _.map(array.ingredients, function (ingredient) {
            return ingredient.description;
          }).join(' or ');

          walker({
            quantity: array.ingredients[0].quantity,
            measurement: array.ingredients[0].measurement,
            description: tmpDesc,
            direction: array.ingredients[0].direction,
            alt: array.ingredients[0].alt
          }, list, isTop);
        } else {
          var tmp = {};
          tmp['DIVIDER_INGREDIENT'] = {
            DESCRIPTION: array.description,
            DIRECTION: '',
            INCLUDED_RECIPE_ID: -1,
            IS_DIVIDER: true,
            IS_MAIN: false,
            MEASUREMENT: '',
            QUANTITY: '' + array.ingredients.length
          };

          var children = [];
          tmp['INGREDIENTS'] = children;
          list.push(tmp);
          walker(array.ingredients, children, false);
        }
      } else {
        var tmp = '';
        if (array.direction) {
          tmp += array.direction;
        }
        if (array.alt) {
          if (tmp) {
            tmp = tmp + ' (' + array.alt + ')';
          } else {
            tmp = '(' + array.alt + ')';
          }
        }
        tmp = util.substituteDegree(util.substituteFraction(tmp));

        list.push({
          DESCRIPTION: array.description,
          DIRECTION: tmp,
          INCLUDED_RECIPE_ID: -1,
          IS_DIVIDER: false,
          IS_MAIN: false,
          MEASUREMENT: array.measurement || '',
          QUANTITY: array.quantity || ''
        });
      }
    })(item.ingredients, list, true);

    if (item.tags) {
      obj['KEYWORDS'] = item.tags.join(', ');
    } else {
      obj['KEYWORDS'] = '';
    }

    obj['MEASUREMENT_SYSTEM'] = 0; // US Standard
    obj['NAME'] = item.title;
    obj['NOTE'] = '';

    // Notes
    var notes = obj['NOTES_LIST'] = [],
        noteObj;
    _.each(item.notes, function (note, index) {
      noteObj = {
        'NOTE_TEXT': note.text
      };
      if (note.image && note.image.data) {
        noteObj['IMAGE'] = note.image.data;
      }
      if (_.isNumber(note.order)) {
        noteObj['SORT_ORDER'] = note.order;
      } else {
        noteObj['SORT_ORDER'] = index;
      }
      if (_.isNumber(note.kind)) {
        noteObj['TYPE_ID'] = note.kind;
      } else {
        noteObj['TYPE_ID'] = 10;
      }
      notes.push(noteObj);
    });

    obj['NUTRITION'] = '';

    // PREP_TIMES
    if (item.times) {
      var preps = obj['PREP_TIMES'] = [];
      _.each(item.times, function (time) {
        preps.push({
          TIME_TYPE_ID: time.kind,
          AMOUNT: time.hours > 0 ? time.hours : time.minutes,
          AMOUNT_2: time.hours > 0 ? time.minutes : 0,
          TIME_UNIT_ID: time.hours > 0 ? 1 : 2,
          TIME_UNIT_2_ID: time.hours > 0 ? 2 : 1
        });
      });
    }

    obj['PUBLICATION_PAGE'] = item.publicationPage;
    obj['SERVINGS'] = 1;
    obj['SOURCE'] = source;

    // Add Summary
    obj['SUMMARY'] = _.map(item.summaries, function (summary) {
      return '<p>' + summary + '</p>';
    }).join(util.linefeed);

    obj['TYPE'] = 102;
    obj['URL'] = _url2.default.format(item.parsedUrl);
    obj['YIELD'] = item.servings;

    return obj;
  }
});

exports.macgourmetexportjs = macgourmetexportjs;
