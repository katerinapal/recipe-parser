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

var entities = _interopRequireWildcard(_entities);

var _url = require("url");

var _url2 = _interopRequireDefault(_url);

var _macGourmetConstants = require("./mac-gourmet-constants");

var constants = _interopRequireWildcard(_macGourmetConstants);

var _categoryClassifier = require("./category-classifier");

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

var classifier = new _categoryClassifier.CategoryClassifier(),
    _ = util._;

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
    log.debug(elements.length);
    if (elements.length) {
      elements.each(function (index, element) {
        return callback.call(this, index, element);
      });
    }
  } catch (e) {
    log.errorlns(e);
  }
};

var addTitle = function addTitle($, obj) {
  log.writelns('Adding Title');
  var text;

  listHelper($, '.hrecipe h1.fn', function (index, title) {
    //console.log(this);  // refers to the $ wrapped title element
    //console.log(title); //refers to the plain title element
    obj.title = _.trim(util.text(this));
    log.oklns(obj.title);
  });
};

var addDatePublished = function addDatePublished($, obj) {
  log.writelns('Adding Date Published');
  listHelper($, 'footer.metadata > time', function (index, meta) {
    obj.datePublished = _.trim(_.first(util.text(this).split(util.linefeed)));
    log.oklns(obj.datePublished);
  });
};

var addServings = function addServings($, obj) {
  log.writelns('Adding Servings');
  listHelper($, '.hrecipe .recipe-about td span.yield', function (index, h4) {
    obj.servings = util.substituteFraction(_.trim(util.text(this)));
    log.oklns(obj.servings);
  });
};

var addImage = function addImage($, obj) {
  obj.image || (obj.image = {});
  log.writelns('Adding Image');

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
  log.writelns('Adding Summary');
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

    text = util.substituteDegree(util.substituteFraction(_.trim(entities.decode(this.html()))));
    log.ok(text);
    obj.summaries.push(text);
  });
};

var addIngredients = function addIngredients(parser, $, obj) {
  obj.ingredients || (obj.ingredients = []);
  obj.saveIngredients || (obj.saveIngredients = []);
  obj.categories || (obj.categories = []);
  log.writelns('Adding Ingredients');
  var top = obj.ingredients,
      list = obj.ingredients,
      descriptions = [],
      saveInbObj,
      retval,
      output,
      text;

  listHelper($, '.hrecipe .content-unit .ingredients ul li span', function (index, ingredient) {
    if (!this.children('strong').length) {
      text = _.trim(util.fulltext(ingredient));
      text = util.decodeFractions(text);

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
          log.oklns(vals.description);
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
            log.ok(util.substituteDegree(util.substituteFraction(output)));
          }
        }
      })(retval);

      if (!_.isEmpty(output)) {
        list.push(retval);
      }
    } else {
      listHelper($, 'strong', this, function () {
        log.ok('Group: ' + _.trim(util.text(this)));
        var parent = {
          description: _.trim(util.text(this)),
          isDivider: true,
          ingredients: []
        };
        top.push(parent);
        list = parent.ingredients;
      });
    }
  });
  //console.log(JSON.stringify(obj.ingredients, null, 2));

  log.writelns('Guessing Categories');
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
  log.writelns('Adding Procedures');
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
        header = _.trim(util.text(this));
      });

      listHelper($, 'p', this, function (idx, proc) {
        tmp = _.trim(util.substituteDegree(util.substituteFraction(util.fulltext(proc))));
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
      log.oklns(index + 1 + ' # ' + header + ' # ' + text);
    } else {
      log.oklns(index + 1 + ' - ' + text);
    }
  });
};

var addNotes = function addNotes($, obj) {
  log.writelns('Adding Notes');
  obj.notes || (obj.notes = []);
};

var hoursRe = /(\d+(?:\.\d{1,2})?(?! *\/))? *(\d+ *\/ *\d+)? *hours?.*$/;
var minutesRe = /(\d+(?:\.\d{1,2})?(?! *\/))? *(\d+ *\/ *\d+)? *minutes?.*$/;
var addTimes = function addTimes($, obj) {
  log.writelns('Adding Times');
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

      util.remove(matches, 0, 0);
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
    text = _.trim(util.text(this));
    log.oklns('Prep Time: ' + text + ', Minutes: ' + calcMinutes(parseTime(text)));
    minutes = calcMinutes(parseTime(text));
    times.push(splitUp(minutes, 9)); // prep time
    return false; // stop iterating
  });

  listHelper($, '.hrecipe .recipe-about td span.totalTime', function () {
    text = _.trim(util.text(this));
    log.oklns('Total Time: ' + text + ', Minutes: ' + calcMinutes(parseTime(text)));
    minutes = calcMinutes(parseTime(text));
    times.push(splitUp(minutes, 30)); // total time
    return false; // stop iterating
  });
};

var addCourse = function addCourse($, obj) {
  obj.categories || (obj.categories = []);
  log.writelns('Adding Course');
};

var addAsideNotes = function addAsideNotes($, obj) {
  log.writelns('Adding Aside Notes');
  obj.asideNotes || (obj.asideNotes = []);
};

var addTags = function addTags($, obj) {
  log.writelns('Adding Tags');
  obj.tags || (obj.tags = []);
  var tags = obj.tags;

  listHelper($, '.hrecipe .tags li', false, function (index, tag) {
    tags.push(_.trim(util.fulltext(tag)));
  });
  log.oklns(tags.join(', '));
};

var scrape = function scrape(callback, parser, url) {
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

exports.scrape = scrape;
;
