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

//log.warn('warn');       // >> warn
//log.error('error');     // >> error
//log.ok('ok');           // >> ok
//log.success('success'); // success
//log.fail('fail');       // fail
//log.debug('debug');     // [D] debug

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

  listHelper($, '.recipe.content h2[itemprop="name"]', function (index, title) {
    //console.log(this);  // refers to the $ wrapped title element
    //console.log(title); //refers to the plain title element
    obj.title = _.trim(_util.util.text(this));
    _log.log.oklns(obj.title);
  });
};

var addDatePublished = function addDatePublished($, obj) {
  _log.log.writelns('Adding Date Published');
  listHelper($, 'meta[itemprop="datePublished"]', function (index, meta) {
    obj.datePublished = _.trim(this.attr('content'));
    _log.log.oklns(obj.datePublished);
  });
};

var addServings = function addServings($, obj) {
  _log.log.writelns('Adding Servings');
  listHelper($, 'h4[itemprop="recipeYield"]', function (index, h4) {
    obj.servings = _util.util.substituteFraction(_.trim(_util.util.text(this)));
    _log.log.oklns(obj.servings);
  });
};

var addImage = function addImage($, obj) {
  obj.image || (obj.image = {});
  _log.log.writelns('Adding Image');

  var patternRe = /\('(.+?)'\)/g,
      backgroundImage,
      match;

  listHelper($, '.recipe-image .image', function (index, img) {
    var backgroundImage = _.first(_util.util.splitCSS(this.css('background')));
    match = patternRe.exec(backgroundImage);

    if (match && match.length) {
      _log.log.ok(match[1]);
      obj.image = {
        src: match[1]
      };
    } else {
      _log.log.ok(backgroundImage);
      obj.image = {
        src: backgroundImage
      };
    }
    return false; // stop iterating
  });
};

var addSummary = function addSummary($, obj) {
  obj.summaries || (obj.summaries = []);
  _log.log.writelns('Adding Summary');
  var text;

  listHelper($, '.why .full p', function (index, summary) {
    //console.log(this);  // refers to the $ wrapped summary element
    //console.log(summary); //refers to the plain summary element
    text = _util.util.substituteDegree(_util.util.substituteFraction(_.trim(_util.util.fulltext(summary))));
    _log.log.ok(index + 1 + '- ' + text);
    obj.summaries.push(text);
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
      listHelper($, 'h5', this, function () {
        _log.log.ok('Group: ' + _.trim(_util.util.text(this)));
        var parent = {
          description: _.trim(_util.util.text(this)),
          isDivider: true,
          ingredients: []
        };
        top.push(parent);
        list = parent.ingredients;
      });
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

var removeLeadingDigitPeriodRe = /(?:^\d+\.\s+)(.*)$/;
var removeEndingColonRe = /([^:]*):$/;
var addProcedures = function addProcedures($, obj) {
  _log.log.writelns('Adding Procedures');
  obj.procedures || (obj.procedures = []);
  var header, match, text;

  listHelper($, '.instructions ol li[itemprop="recipeInstructions"] div', function (index, procedure) {
    header = undefined;

    listHelper($, 'b', this, function () {
      header = _.trim(_util.util.text(this));
    });

    text = _util.util.substituteDegree(_util.util.substituteFraction(_.trim(_util.util.fulltext(procedure))));
    match = text.match(removeLeadingDigitPeriodRe);
    if (match) {
      text = match[1];
    }
    if (header) {
      text = _.trim(text.replace(header, ''));
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

var addAsideNotes = function addAsideNotes($, obj) {
  _log.log.writelns('Adding Aside Notes');
  obj.asideNotes || (obj.asideNotes = []);
  var match, text, note, img, h4, h3;

  listHelper($, '.asides > .aside', function (i, aside) {
    listHelper($, 'h4', this, function () {
      h4 = _.trim(_util.util.text(this));
    });
    listHelper($, 'h3', this, function () {
      h3 = _.trim(_util.util.text(this));
    });

    note = {
      h4: h4,
      h3: h3,
      intros: [],
      notes: []
    };

    $(this).children('p').each(function (index, element) {
      text = _util.util.substituteDegree(_util.util.substituteFraction(_.trim(_util.util.text(this))));
      if (text) {
        note.intros.push(text);
      }
    });

    listHelper($, '.page-item', this, function () {
      listHelper($, 'figure > img', this, function () {
        img = this.attr('src');
      });
      listHelper($, 'figure > figcaption', this, function () {
        text = _util.util.substituteDegree(_util.util.substituteFraction(_.trim(_util.util.fulltext(this))));
        match = text.match(removeLeadingDigitPeriodRe);
        if (match) {
          text = match[1];
        }
      });
      note.notes.push({
        text: text,
        image: {
          src: img
        }
      });
    });

    obj.asideNotes.push(note);

    _log.log.ok(note.h4 + ' : ' + note.h3);
    _.each(note.notes, function (note, i) {
      _log.log.ok(i + 1 + '- ' + note.text);
      _log.log.ok(i + 1 + '- ' + note.image.src);
    });
  });
};

var combineNotes = function combineNotes(obj) {
  var asideNotes = obj.asideNotes,
      notes = obj.notes,
      dest = [];

  delete obj.asideNotes;
  delete obj.notes;

  // Combine Notes and Aside Notes (with pictures)
  // into new destination of notes (flattened).
  var i = 0,
      noteObj,
      title;
  _.each(notes, function (note) {
    noteObj = {};
    dest.push({
      text: note.text,
      order: i++,
      kind: 10
    });
  });
  _.each(asideNotes, function (asideNote) {
    title = ['<h4>' + asideNote.h4 + '</h4>', '<h3>' + asideNote.h3 + '</h3>'];

    var intros = _.map(asideNote.intros, function (intro) {
      return '<p>' + intro + '</p>';
    }).join(_util.util.linefeed);

    if (intros && intros.length) {
      dest.push({
        text: title.concat(intros).join(_util.util.linefeed),
        order: i++,
        kind: 10
      });
      title = []; // reset the <h4> and <h3>
    }

    _.each(asideNote.notes, function (note) {
      noteObj = {
        text: title.concat(['<p>' + note.text + '</p>']).join(_util.util.linefeed),
        order: i++,
        kind: 10
      };
      title = []; // reset the <h4> and <h3>

      if (note.image) {
        noteObj.image = note.image;
      }
      dest.push(noteObj);
    });
  });

  obj.notes = dest;
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
    addDatePublished($, obj);
    addServings($, obj);
    addImage($, obj);
    addSummary($, obj);
    addIngredients(parser, $, obj);
    addProcedures($, obj);
    addNotes($, obj);
    addTimes($, obj);
    addCourse($, obj);
    addAsideNotes($, obj);
    combineNotes(obj);

    obj.parsedUrl = _url2.default.parse(url, true);
    delete obj.parsedUrl.query;
    delete obj.parsedUrl.search;

    obj.publicationPage = ["<ul><li><a href='", _url2.default.format(obj.parsedUrl), "'>", obj.datePublished, '</a></li></ul>'].join('');

    callback(null, [obj]);
  });
};
exports.scrape = scrape_scrape;