import ext_request_request from "request";
import ext_cheerio_cheerio from "cheerio";
import ext_changecase_changeCase from "change-case";
import { decode as entities_decodejs } from "./entities";
import ext_url_URL from "url";
import { constants as macgourmetconstants_constants } from "./mac-gourmet-constants";
import { CategoryClassifier as categoryclassifier_CategoryClassifierjs } from "./category-classifier";

import {
  _ as utiljs__,
  linefeed as utiljs_linefeed,
  remove as utiljs_remove,
  substituteDegree as utiljs_substituteDegree,
  substituteFraction as utiljs_substituteFraction,
  decodeFractions as utiljs_decodeFractions,
  text as utiljs_text,
  fulltext as utiljs_fulltext,
} from "./util";

import {
  ok as logjs_ok,
  errorlns as logjs_errorlns,
  oklns as logjs_oklns,
  debug as logjs_debug,
  writelns as logjs_writelns,
} from "./log";

var constants = macgourmetconstants_constants.constants, classifier = new categoryclassifier_CategoryClassifierjs(), _ = utiljs__;

//log.warn('warn');       // >> warn
//log.error('error');     // >> error
//log.ok('ok');           // >> ok
//log.success('success'); // success
//log.fail('fail');       // fail
//log.debug('debug');     // [D] debug

var listHelper = function($, selector, context, callback) {
  if (context) {
    if (_.isFunction(context)) {
      callback = context;
      context = undefined;
    }
  }

  try {
    var elements = $(selector, context);
    logjs_debug(elements.length);
    if (elements.length) {
      elements.each(function(index, element) {
        return callback.call(this, index, element);
      });
    }
  } catch(e) {
    logjs_errorlns(e);
  }
};

var addTitle = function($, obj) {
  logjs_writelns('Adding Title');
  var text;

  listHelper($, '.hrecipe h1.fn', function(index, title) {
    //console.log(this);  // refers to the $ wrapped title element
    //console.log(title); //refers to the plain title element
    obj.title = _.trim(utiljs_text(this));
    logjs_oklns(obj.title);
  });
};

var addDatePublished = function($, obj) {
  logjs_writelns('Adding Date Published');
  listHelper($, 'footer.metadata > time', function(index, meta) {
    obj.datePublished = _.trim(_.first(utiljs_text(this).split(utiljs_linefeed)));
    logjs_oklns(obj.datePublished);
  });
};

var addServings = function($, obj) {
  logjs_writelns('Adding Servings');
  listHelper($, '.hrecipe .recipe-about td span.yield', function(index, h4) {
    obj.servings = utiljs_substituteFraction(_.trim(utiljs_text(this)));
    logjs_oklns(obj.servings);
  });
};

var addImage = function($, obj) {
  obj.image || (obj.image = {});
  logjs_writelns('Adding Image');

  listHelper($, '.hrecipe .content-unit img', function() {
    obj.image = {
      src: this.attr('src'),
      alt: this.attr('alt')
    };
    return false; // stop iterating
  });
};

var addSummary = function($, obj) {
  obj.summaries || (obj.summaries = []);
  logjs_writelns('Adding Summary');
  var text;

  listHelper($, '.hrecipe .content-unit .summary p', function(index, summary) {
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

    text = utiljs_substituteDegree(utiljs_substituteFraction(_.trim(entities_decodejs)));
    logjs_ok(text);
    obj.summaries.push(text);
  });
};

var addIngredients = function(parser, $, obj) {
  obj.ingredients || (obj.ingredients = []);
  obj.saveIngredients || (obj.saveIngredients = []);
  obj.categories || (obj.categories = []);
  logjs_writelns('Adding Ingredients');
  var top = obj.ingredients,
      list = obj.ingredients,
      descriptions = [],
      saveInbObj,
      retval,
      output,
      text;

  listHelper($, '.hrecipe .content-unit .ingredients ul li span', function(index, ingredient) {
    if (!this.children('strong').length) {
      text = _.trim(utiljs_fulltext(ingredient));
      text = utiljs_decodeFractions(text);

      retval = parser.parseIngredient(text);
      saveInbObj = {};
      saveInbObj[text] = retval;
      obj.saveIngredients.push(saveInbObj);

      (function walker(vals) {
        if (_.isArray(vals)) {
          _.each(vals, function(val) {
            walker(val);
          });
        } else if (vals.isDivider) {
          logjs_oklns(vals.description);
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
            logjs_ok(utiljs_substituteDegree(utiljs_substituteFraction(output)));
          }
        }
      })(retval);

      if (!_.isEmpty(output)) {
        list.push(retval);
      }
    } else {
      listHelper($, 'strong', this, function() {
        logjs_ok('Group: ' + _.trim(utiljs_text(this)));
        var parent = {
          description: _.trim(utiljs_text(this)),
          isDivider: true,
          ingredients: []
        };
        top.push(parent);
        list = parent.ingredients;
      });
    }
  });
  //console.log(JSON.stringify(obj.ingredients, null, 2));

  logjs_writelns('Guessing Categories');
  var categories = classifier.guessCategories(descriptions);
  _.each(categories, function(cat) {
    obj.categories.push({
      id: constants.CATEGORIES[cat.id],
      name: cat.id
    });
    //log.ok('"' + cat.id + '", with probability of ' + cat.avg);
  });
};

var removeEndingColonRe = /([^:]*):$/;
var addProcedures = function($, obj) {
  logjs_writelns('Adding Procedures');
  obj.procedures || (obj.procedures = []);
  var header,
      match,
      text,
      img,
      tmp;

  listHelper($, '.hrecipe .procedure ol.instructions li', function(index, procedure) {
    header = img = undefined;
    text = '';

    listHelper($, '.recipe-image-large > img', this, function() {
      img = this.attr('src');
    });

    listHelper($, '.procedure-text', this, function() {
      listHelper($, 'strong', this, function() {
        header = _.trim(utiljs_text(this));
      });

      listHelper($, 'p', this, function(idx, proc) {
        tmp = _.trim(utiljs_substituteDegree(utiljs_substituteFraction(utiljs_fulltext(proc))));
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
        header = ext_changecase_changeCase.titleCase(header);
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
      logjs_oklns(index + 1 + ' # ' + header + ' # ' + text);
    } else {
      logjs_oklns(index + 1 + ' - ' + text);
    }
  });
};

var addNotes = function($, obj) {
  logjs_writelns('Adding Notes');
  obj.notes || (obj.notes = []);
};

var hoursRe = /(\d+(?:\.\d{1,2})?(?! *\/))? *(\d+ *\/ *\d+)? *hours?.*$/;
var minutesRe = /(\d+(?:\.\d{1,2})?(?! *\/))? *(\d+ *\/ *\d+)? *minutes?.*$/;
var addTimes = function($, obj) {
  logjs_writelns('Adding Times');
  obj.times || (obj.times = []);
  var times = obj.times,
      minutes,
      text;

  var parseTime = function(str) {
    var matches;

    return _.map([hoursRe, minutesRe], function(re) {
      matches = str.match(re);
      if (!matches) { return {}; }

      utiljs_remove(matches, 0, 0);
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

  var calcMinutes = function(array) {
    var multiplier = 60,
        loopSum;
    return _.reduce(array, function(memo, time, index) {
      if (index === 1) { multiplier = 1; }
      loopSum = 0;
      if (time) {
        if (time.whole) {
          loopSum += parseInt((eval(time.whole) * multiplier), 10);
        }
        if (time.part) {
          loopSum += parseInt((eval(time.part) * multiplier), 10);
        }
        return memo + loopSum;
      }
      return memo;
    }, 0);
  };

  var splitUp = function(minutes, kind) {
    return {
      kind: kind,
      hours: Math.floor(minutes/60),
      minutes: minutes % 60
    };
  };

  // 9 - prep
  // 10 - cook
  // 30 - total
  // 28 - inactive
  listHelper($, '.hrecipe .recipe-about td span.prepTime', function() {
    text = _.trim(utiljs_text(this));
    logjs_oklns('Prep Time: ' + text + ', Minutes: ' + calcMinutes(parseTime(text)));
    minutes = calcMinutes(parseTime(text));
    times.push(splitUp(minutes, 9)); // prep time
    return false; // stop iterating
  });

  listHelper($, '.hrecipe .recipe-about td span.totalTime', function() {
    text = _.trim(utiljs_text(this));
    logjs_oklns('Total Time: ' + text + ', Minutes: ' + calcMinutes(parseTime(text)));
    minutes = calcMinutes(parseTime(text));
    times.push(splitUp(minutes, 30));  // total time
    return false; // stop iterating
  });
};

var addCourse = function($, obj) {
  obj.categories || (obj.categories = []);
  logjs_writelns('Adding Course');
};

var addAsideNotes = function($, obj) {
  logjs_writelns('Adding Aside Notes');
  obj.asideNotes || (obj.asideNotes = []);
};

var addTags = function($, obj) {
  logjs_writelns('Adding Tags');
  obj.tags || (obj.tags = []);
  var tags = obj.tags;

  listHelper($, '.hrecipe .tags li', false, function(index, tag) {
    tags.push(_.trim(utiljs_fulltext(tag)));
  });
  logjs_oklns(tags.join(', '));
};

scrape_scrape = function(callback, parser, url) {
  ext_request_request(url, function (err, response, body) {
    if (err) { throw err; }
    var $ = ext_cheerio_cheerio.load(body, {
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

    obj.parsedUrl = ext_url_URL.parse(url, true);
    delete obj.parsedUrl.query;
    delete obj.parsedUrl.search;

    obj.publicationPage = [
      "<ul><li><a href='",
      ext_url_URL.format(obj.parsedUrl),
      "'>",
      obj.datePublished,
      '</a></li></ul>'
    ].join('');

    callback(null, [obj]);
  });
};
var scrape_scrape;
export { scrape_scrape as scrape };
