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

var _entities = require("./entities");

var _url = require("url");

var _url2 = _interopRequireDefault(_url);

var _macGourmetConstants = require("./mac-gourmet-constants");

var _categoryClassifier = require("./category-classifier");

var _util = require("./util");

var _log = require("./log");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var constants = _macGourmetConstants.constants.constants,
    classifier = new _categoryClassifier.CategoryClassifier(),
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

  listHelper($, '.hrecipe h1.fn', function (index, title) {
    //console.log(this);  // refers to the $ wrapped title element
    //console.log(title); //refers to the plain title element
    obj.title = _.trim(_util.util.text(this));
    _log.log.oklns(obj.title);
  });
};

var addDatePublished = function addDatePublished($, obj) {
  _log.log.writelns('Adding Date Published');
  listHelper($, 'footer.metadata > time', function (index, meta) {
    obj.datePublished = _.trim(_.first(_util.util.text(this).split(_util.util.linefeed)));
    _log.log.oklns(obj.datePublished);
  });
};

var addServings = function addServings($, obj) {
  _log.log.writelns('Adding Servings');
  listHelper($, '.hrecipe .recipe-about td span.yield', function (index, h4) {
    obj.servings = _util.util.substituteFraction(_.trim(_util.util.text(this)));
    _log.log.oklns(obj.servings);
  });
};

var addImage = function addImage($, obj) {
  obj.image || (obj.image = {});
  _log.log.writelns('Adding Image');

  listHelper($, '.hrecipe .content-unit img', function () {
    obj.image = {
      src: this.attr('src'),
      alt: this.attr('alt')
    };
    return false; // stop iterating
  });
};

var addSummary = function addSummary($, obj) {
  obj.summaries || (obj.summaries = []);
  _log.log.writelns('Adding Summary');
  var text;

  listHelper($, '.hrecipe .content-unit .summary p', function (index, summary) {
    //console.log(this);  // refers to the $ wrapped summary element
    //console.log(summary); //refers to the plain summary element

    if (this.attr('class')) {
      return; // do nothing
    }

    if (this.children().length) {
      var child = this.children().first();
      if (child && child.length) {
        if (child[0].name === 'small') {
          return; // do nothing
        }
      }
    }

    text = _util.util.substituteDegree(_util.util.substituteFraction(_.trim(_entities.decode)));
    _log.log.ok(text);
    obj.summaries.push(text);
  });
};

var addIngredients = function addIngredients(parser, $, obj) {
  obj.ingredients || (obj.ingredients = []);
  obj.saveIngredients || (obj.saveIngredients = []);
  obj.categories || (obj.categories = []);
  _log.log.writelns('Adding Ingredients');
  var top = obj.ingredients,
      list = obj.ingredients,
      descriptions = [],
      saveInbObj,
      retval,
      output,
      text;

  listHelper($, '.hrecipe .content-unit .ingredients ul li span', function (index, ingredient) {
    if (!this.children('strong').length) {
      text = _.trim(_util.util.fulltext(ingredient));
      text = _util.util.decodeFractions(text);

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
          if (!_.isEmpty(output)) {
            _log.log.ok(_util.util.substituteDegree(_util.util.substituteFraction(output)));
          }
        }
      })(retval);

      if (!_.isEmpty(output)) {
        list.push(retval);
      }
    } else {
      listHelper($, 'strong', this, function () {
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
      id: constants.CATEGORIES[cat.id],
      name: cat.id
    });
    //log.ok('"' + cat.id + '", with probability of ' + cat.avg);
  });
};

var removeEndingColonRe = /([^:]*):$/;
var addProcedures = function addProcedures($, obj) {
  _log.log.writelns('Adding Procedures');
  obj.procedures || (obj.procedures = []);
  var header, match, text, img, tmp;

  listHelper($, '.hrecipe .procedure ol.instructions li', function (index, procedure) {
    header = img = undefined;
    text = '';

    listHelper($, '.recipe-image-large > img', this, function () {
      img = this.attr('src');
    });

    listHelper($, '.procedure-text', this, function () {
      listHelper($, 'strong', this, function () {
        header = _.trim(_util.util.text(this));
      });

      listHelper($, 'p', this, function (idx, proc) {
        tmp = _.trim(_util.util.substituteDegree(_util.util.substituteFraction(_util.util.fulltext(proc))));
        if (!_.isEmpty(tmp)) {
          if (header) {
            tmp = _.trim(tmp.replace(header, ''));

            match = tmp.match(/^:\s*(.*)$/);
            if (match) {
              tmp = match[1];
            }
          }
          text += tmp;
        }
      });

      if (header) {
        header = _.trim(header);
        header = _changeCase2.default.titleCase(header);
        match = header.match(removeEndingColonRe);
        if (match) {
          header = match[1];
        }
      }

      obj.procedures.push({
        header: header,
        text: text,
        image: {
          src: img
        }
      });
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
};

var hoursRe = /(\d+(?:\.\d{1,2})?(?! *\/))? *(\d+ *\/ *\d+)? *hours?.*$/;
var minutesRe = /(\d+(?:\.\d{1,2})?(?! *\/))? *(\d+ *\/ *\d+)? *minutes?.*$/;
var addTimes = function addTimes($, obj) {
  _log.log.writelns('Adding Times');
  obj.times || (obj.times = []);
  var times = obj.times,
      minutes,
      text;

  var parseTime = function parseTime(str) {
    var matches;

    return _.map([hoursRe, minutesRe], function (re) {
      matches = str.match(re);
      if (!matches) {
        return {};
      }

      _util.util.remove(matches, 0, 0);
      if (matches.length > 1) {
        return {
          whole: matches[0],
          part: matches[1]
        };
      } else if (matches.length > 0) {
        return {
          whole: matches[0]
        };
      }
    });
  };

  var calcMinutes = function calcMinutes(array) {
    var multiplier = 60,
        loopSum;
    return _.reduce(array, function (memo, time, index) {
      if (index === 1) {
        multiplier = 1;
      }
      loopSum = 0;
      if (time) {
        if (time.whole) {
          loopSum += parseInt(eval(time.whole) * multiplier, 10);
        }
        if (time.part) {
          loopSum += parseInt(eval(time.part) * multiplier, 10);
        }
        return memo + loopSum;
      }
      return memo;
    }, 0);
  };

  var splitUp = function splitUp(minutes, kind) {
    return {
      kind: kind,
      hours: Math.floor(minutes / 60),
      minutes: minutes % 60
    };
  };

  // 9 - prep
  // 10 - cook
  // 30 - total
  // 28 - inactive
  listHelper($, '.hrecipe .recipe-about td span.prepTime', function () {
    text = _.trim(_util.util.text(this));
    _log.log.oklns('Prep Time: ' + text + ', Minutes: ' + calcMinutes(parseTime(text)));
    minutes = calcMinutes(parseTime(text));
    times.push(splitUp(minutes, 9)); // prep time
    return false; // stop iterating
  });

  listHelper($, '.hrecipe .recipe-about td span.totalTime', function () {
    text = _.trim(_util.util.text(this));
    _log.log.oklns('Total Time: ' + text + ', Minutes: ' + calcMinutes(parseTime(text)));
    minutes = calcMinutes(parseTime(text));
    times.push(splitUp(minutes, 30)); // total time
    return false; // stop iterating
  });
};

var addCourse = function addCourse($, obj) {
  obj.categories || (obj.categories = []);
  _log.log.writelns('Adding Course');
};

var addAsideNotes = function addAsideNotes($, obj) {
  _log.log.writelns('Adding Aside Notes');
  obj.asideNotes || (obj.asideNotes = []);
};

var addTags = function addTags($, obj) {
  _log.log.writelns('Adding Tags');
  obj.tags || (obj.tags = []);
  var tags = obj.tags;

  listHelper($, '.hrecipe .tags li', false, function (index, tag) {
    tags.push(_.trim(_util.util.fulltext(tag)));
  });
  _log.log.oklns(tags.join(', '));
};

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
    addTags($, obj);

    obj.parsedUrl = _url2.default.parse(url, true);
    delete obj.parsedUrl.query;
    delete obj.parsedUrl.search;

    obj.publicationPage = ["<ul><li><a href='", _url2.default.format(obj.parsedUrl), "'>", obj.datePublished, '</a></li></ul>'].join('');

    callback(null, [obj]);
  });
};
var scrape_scrape;
exports.scrape = scrape_scrape;