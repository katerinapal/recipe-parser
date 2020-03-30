import Backbone from "backbone";
import URL from "url";
import { util as util_utiljs } from "./util";
// Nodejs libs.
var _ = util_utiljs._;

var macgourmetexportjs_macgourmetexportjs;

// The module to be exported.
module.exports = exports = Backbone.Model.extend({
  initialize: function() {
  },
  exportRecipe: function(item, source) {
    var obj = {};
    obj['AFFILIATE_ID'] = -1;

    // Add Categories
    var categories = obj['CATEGORIES'] = [];
    var addCategory = function(id, name, userAdded) {
      categories.push({
        CATEGORY_ID: id,
        ITEM_TYPE_ID: 102,
        NAME: name,
        USER_ADDED: userAdded
      });
    };
    _.each(item.categories, function(category) {
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
    _.each(item.procedures, function(procedure) {
      procText = _.trim(procedure.text);
      if (procText) {
        procText = util_utiljs.trimMultipleWhiteSpace(procText);
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
        _.each(array, function(item) {
          walker(item, list, isTop);
        });
      }
      else if (array.isDivider) {
        if (/*!isTop &&*/ array.description === 'Or') { //flatten if not on top
          var tmpDesc = _.map(array.ingredients, function(ingredient) {
            return ingredient.description;
          }).join(' or ');

          walker({
            quantity: array.ingredients[0].quantity,
            measurement: array.ingredients[0].measurement,
            description: tmpDesc,
            direction: array.ingredients[0].direction,
            alt: array.ingredients[0].alt
          }, list, isTop);
        }
        else {
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
        tmp = util_utiljs.substituteDegree(util_utiljs.substituteFraction(tmp));

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

    obj['MEASUREMENT_SYSTEM'] = 0;  // US Standard
    obj['NAME'] = item.title;
    obj['NOTE'] = '';

    // Notes
    var notes = obj['NOTES_LIST'] = [],
        noteObj;
    _.each(item.notes, function(note, index) {
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
      _.each(item.times, function(time) {
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
    obj['SUMMARY'] = _.map(item.summaries, function(summary) {
      return '<p>' + summary + '</p>';
    })
    .join(util_utiljs.linefeed);

    obj['TYPE'] = 102;
    obj['URL'] = URL.format(item.parsedUrl);
    obj['YIELD'] = item.servings;

    return obj;
  }
});

export { macgourmetexportjs_macgourmetexportjs as macgourmetexportjs };

