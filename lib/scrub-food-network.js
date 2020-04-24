"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.scrape = undefined;

var _request = require("request");

var _request2 = _interopRequireDefault(_request);

var _cheerio = require("cheerio");

var _cheerio2 = _interopRequireDefault(_cheerio);

var _changeCase = require("change-case");

var _changeCase2 = _interopRequireDefault(_changeCase);

var _url = require("url");

var _url2 = _interopRequireDefault(_url);

var _macGourmetConstants = require("./mac-gourmet-constants");

var macgourmetconstants_constantsjs = _interopRequireWildcard(_macGourmetConstants);

var _categoryClassifier = require("./category-classifier");

var _util = require("./util");

var _log = require("./log");

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var classifier = new _categoryClassifier.CategoryClassifier(),
    _ = _util.util._;

var listHelper = function listHelper($, selector, context, callback) {
  if (context) {
    if (_.isFunction(context)) {
      callback = context;
      context = undefined;
    }
  }

  try {
    var elements = $(selector, context);
    _log.log.debug(elements.length);
    if (elements.length) {
      elements.each(function (index, element) {
        return callback.call(this, index, element);
      });
    }
  } catch (e) {
    _log.log.errorlns(e);
  }
};

var addTitle = function addTitle($, obj) {
  _log.log.writelns('Adding Title');
  var text;

  listHelper($, '.section.title > .title > h1[itemprop="name"]', function (index, title) {
    //console.log(this);  // refers to the $ wrapped title element
    //console.log(title); //refers to the plain title element
    obj.title = _.trim(_util.util.text(this));
    _log.log.oklns(obj.title);
  });
};

var addServings = function addServings($, obj) {
  _log.log.writelns('Adding Servings');
  listHelper($, 'dd[itemprop="recipeYield"]', function () {
    obj.servings = _util.util.substituteFraction(_.trim(_util.util.text(this)));
    _log.log.oklns(obj.servings);
    return false; // stop iterating
  });
};

var addImage = function addImage($, obj) {
  obj.image || (obj.image = {});
  _log.log.writelns('Adding Image');

  listHelper($, '#photo img', function () {
    obj.image = {
      src: this.attr('src'),
      alt: this.attr('alt')
    };
    return false; // stop iterating
  });
};

var addIngredients = function addIngredients(parser, $, obj) {
  obj.ingredients || (obj.ingredients = []);
  obj.saveIngredients || (obj.saveIngredients = []);
  obj.categories || (obj.categories = []);
  _log.log.writelns('Adding Ingredients');
  var ingredients = $('.ingredients > ul li'),
      top = obj.ingredients,
      list = obj.ingredients,
      descriptions = [],
      saveInbObj,
      retval,
      output,
      text;

  listHelper($, '.ingredients > ul li', function (index, ingredient) {
    if (this.attr('itemprop') === 'ingredients') {
      text = _.trim(_util.util.fulltext(ingredient));
      retval = parser.parseIngredient(text);
      saveInbObj = {};
      saveInbObj[text] = retval;
      obj.saveIngredients.push(saveInbObj);

      (function walker(vals) {
        if (_.isArray(vals)) {
          _.each(vals, function (val) {
            walker(val);
          });
        } else if (vals.isDivider) {
          _log.log.oklns(vals.description);
          walker(vals.ingredients);
        } else {
          if (vals.description) {
            descriptions.push(vals.description);
          }
          output = _.compact([vals.quantity, vals.measurement, vals.description]).join(' ');
          if (vals.direction) {
            output += ', ' + vals.direction;
          }
          if (vals.alt) {
            output += ' (' + vals.alt + ')';
          }
          _log.log.ok(_util.util.substituteDegree(_util.util.substituteFraction(output)));
        }
      })(retval);

      list.push(retval);
    } else {
      var group = _.trim(_util.util.text(this));
      if (group) {
        var match = group.match(removeEndingColonRe);
        if (match) {
          group = _changeCase2.default.titleCase(match[1]);
        } else {
          group = _changeCase2.default.titleCase(group);
        }
      }
      _log.log.ok('Group: ' + group);

      var parent = {
        description: group,
        isDivider: true,
        ingredients: []
      };
      top.push(parent);
      list = parent.ingredients;
    }
  });
  //console.log(JSON.stringify(obj.ingredients, null, 2));

  _log.log.writelns('Guessing Categories');
  var categories = classifier.guessCategories(descriptions);
  _.each(categories, function (cat) {
    obj.categories.push({
      id: macgourmetconstants_constantsjs.CATEGORIES[cat.id],
      name: cat.id
    });
    //log.ok('"' + cat.id + '", with probability of ' + cat.avg);
  });
};

// http://www.foodnetwork.com/recipes/alton-brown/pumpkin-pie-recipe.html
var removeEndingColonRe = /([^:]*):$/;
var addProcedures = function addProcedures($, obj) {
  _log.log.writelns('Adding Procedures');
  obj.procedures || (obj.procedures = []);
  var header, match, text;

  listHelper($, '.directions[itemprop="recipeInstructions"] > *', function (index, procedure) {
    if (this.is('span.subtitle')) {
      header = _.trim(_util.util.text(this));
    } else if (this.is('p')) {
      text = _util.util.substituteDegree(_util.util.substituteFraction(_.trim(_util.util.fulltext(procedure))));
      if (header) {
        match = header.match(removeEndingColonRe);
        if (match) {
          header = _changeCase2.default.titleCase(match[1]);
        }
      }

      obj.procedures.push({
        header: header,
        text: text
      });

      if (header) {
        _log.log.oklns(index + 1 + ' # ' + header + ' # ' + text);
      } else {
        _log.log.oklns(index + 1 + ' - ' + text);
      }

      header = undefined;
    } else {
      return true; // keep iterating
    }
  });
};

var addNotes = function addNotes($, obj) {
  _log.log.writelns('Adding Notes');
  obj.notes || (obj.notes = []);
  var text;

  listHelper($, '.serves > p', function (index, note) {
    text = _util.util.substituteDegree(_util.util.substituteFraction(_.trim(_util.util.fulltext(note))));

    obj.notes.push({
      text: text
    });
    _log.log.oklns(index + 1 + '- ' + text);
  });
};

var addTimes = function addTimes($, obj) {
  _log.log.writelns('Adding Times');
  var text;

  //addTime(9, item.prepTime); // prep
  //addTime(5, item.cookTime); // cook
  //addTime(30, item.totalTime); // total
  //addTime(28, item.inactiveTime); // inactive
  //matches = time.match(/(\d+)H(\d+)M/i); // PT1H0M
  //if (matches) {
  //hours = parseInt(matches[1], 10);
  //minutes = parseInt(matches[2], 10);
  listHelper($, '.other-attributes meta[itemprop="totalTime"]', function (index, meta) {
    text = _.trim(this.attr('content'));
    //PT0H0M  - 0 hours, 0 mins
    //PT1H20M - 1 hour, 20 mins
    obj.totalTime = text; // TODO - parse
    _log.log.oklns(text);
  });
};

var addCourse = function addCourse($, obj) {
  obj.categories || (obj.categories = []);
  _log.log.writelns('Adding Course');
  var name, val, cat;

  listHelper($, '.other-attributes meta[itemprop="recipeCategory"]', function (index, meta) {
    name = _.trim(this.attr('content'));
    if (name) {
      _log.log.oklns(name);

      if (name === 'Side Dishes') {
        cat = 'Side Dishes';
      } else if (name === 'Main Courses') {
        cat = 'Main Dish';
        val = 'Main';
      } else if (name === 'Desserts or Baked Goods') {
        cat = 'Desserts';
        val = 'Dessert';
      } else if (name === 'Appetizers') {
        val = cat = 'Appetizer';
      }

      if (val) {
        obj.course = {
          id: macgourmetconstants_constantsjs.COURSES[val],
          name: val
        };
      }

      if (cat) {
        obj.categories.push({
          id: macgourmetconstants_constantsjs.CATEGORIES[cat],
          name: cat
        });
      }
    }

    if (obj.course) {
      _log.log.oklns(obj.course.id + ' - ' + obj.course.name);
    }
  });
};

var addTags = function addTags($, obj) {
  //verbose('## Adding Tags');
  obj.tags || (obj.tags = []);
  listHelper($, '.article-info li.tags span', false, function (tag) {
    if (!tag) {
      return;
    }
    obj.tags.push(_util.util.trim(tag.striptags));
  });
};

var scrape_scrape;

exports.scrape = scrape_scrape = function scrape_scrape(callback, parser, url) {
  (0, _request2.default)(url, function (err, response, body) {
    if (err) {
      throw err;
    }
    var $ = _cheerio2.default.load(body, {
      verbose: true,
      ignoreWhitespace: true
    });

    var obj = {};
    addTitle($, obj);

    addServings($, obj);
    addImage($, obj);
    addIngredients(parser, $, obj);
    //addProcedures($, obj);
    //addNotes($, obj);
    //addTimes($, obj);
    //addCourse($, obj);
    //addTags($, obj);

    obj.parsedUrl = _url2.default.parse(url, true);
    delete obj.parsedUrl.query;
    delete obj.parsedUrl.search;

    callback(null, [obj]);
  });
};

//obj['PUBLICATION_PAGE'] = "<ul><li><a href=''></a></li><li><a href=''>" + seasonEpisode + '</a></li></ul>';
//obj['SOURCE'] = 'Good Eats';
/*
var exportRecipe = function(item) {

  var preps = obj['PREP_TIMES'] = [];
  var addTime = function(id, time) {
    var hours,
        minutes,
        matches;


      preps.push({
        TIME_TYPE_ID: id,
        AMOUNT: hours > 0 ? hours : minutes,
        AMOUNT_2: hours > 0 ? minutes : 0,
        TIME_UNIT_ID: hours > 0 ? 1 : 2,
        TIME_UNIT_2_ID: hours > 0 ? 2 : 1
      });
    }
  };

};
*/
exports.scrape = scrape_scrape;