import ext_request_request from "request";
import ext_cheerio_cheerio from "cheerio";
import ext_changeCase from "change-case";
import { decode as entities_decode } from "./entities";
import ext_URL from "url";
import { constants as macgourmetconstants_constants } from "./mac-gourmet-constants";
import { CategoryClassifier as categoryclassifier_CategoryClassifier } from "./category-classifier";

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

import { log as log_log } from "./log";

var constants = macgourmetconstants_constants, classifier = new categoryclassifier_CategoryClassifier(), _ = utiljs__;

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
    log_log.debug(elements.length);
    if (elements.length) {
      elements.each(function(index, element) {
        return callback.call(this, index, element);
      });
    }
  } catch(e) {
    log_log.errorlns(e);
  }
};

var addTitle = function($, obj) {
  log_log.writelns('Adding Title');
  var text;

  listHelper($, '.hrecipe h1.fn', function(index, title) {
    //console.log(this);  // refers to the $ wrapped title element
    //console.log(title); //refers to the plain title element
    obj.title = _.trim(utiljs_text(this));
    log_log.oklns(obj.title);
  });
};

var addDatePublished = function($, obj) {
  log_log.writelns('Adding Date Published');
  listHelper($, 'footer.metadata > time', function(index, meta) {
    obj.datePublished = _.trim(_.first(utiljs_text(this).split(utiljs_linefeed)));
    log_log.oklns(obj.datePublished);
  });
};

var addServings = function($, obj) {
  log_log.writelns('Adding Servings');
  listHelper($, '.hrecipe .recipe-about td span.yield', function(index, h4) {
    obj.servings = utiljs_substituteFraction(_.trim(utiljs_text(this)));
    log_log.oklns(obj.servings);
  });
};

var addImage = function($, obj) {
  obj.image || (obj.image = {});
  log_log.writelns('Adding Image');

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
  log_log.writelns('Adding Summary');
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

    text = utiljs_substituteDegree(utiljs_substituteFraction(_.trim(entities_decode(this.html()))));
    log_log.ok(text);
    obj.summaries.push(text);
  });
};

var addIngredients = function(parser, $, obj) {
  obj.ingredients || (obj.ingredients = []);
  obj.saveIngredients || (obj.saveIngredients = []);
  obj.categories || (obj.categories = []);
  log_log.writelns('Adding Ingredients');
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
          log_log.oklns(vals.description);
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
            log_log.ok(utiljs_substituteDegree(utiljs_substituteFraction(output)));
          }
        }
      })(retval);

      if (!_.isEmpty(output)) {
        list.push(retval);
      }
    } else {
      listHelper($, 'strong', this, function() {
        log_log.ok('Group: ' + _.trim(utiljs_text(this)));
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

  log_log.writelns('Guessing Categories');
  var categories = classifier.guessCategories(descriptions);
  _.each(categories, function(cat) {
    obj.categories.push({
      id: macgourmetconstants_constants.CATEGORIES[cat.id],
      name: cat.id
    });
    //log.ok('"' + cat.id + '", with probability of ' + cat.avg);
  });
};

var removeEndingColonRe = /([^:]*):$/;
var addProcedures = function($, obj) {
  log_log.writelns('Adding Procedures');
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
        header = ext_changeCase.titleCase(header);
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
      log_log.oklns(index + 1 + ' # ' + header + ' # ' + text);
    } else {
      log_log.oklns(index + 1 + ' - ' + text);
    }
  });
};

var addNotes = function($, obj) {
  log_log.writelns('Adding Notes');
  obj.notes || (obj.notes = []);
};

var hoursRe = /(\d+(?:\.\d{1,2})?(?! *\/))? *(\d+ *\/ *\d+)? *hours?.*$/;
var minutesRe = /(\d+(?:\.\d{1,2})?(?! *\/))? *(\d+ *\/ *\d+)? *minutes?.*$/;
var addTimes = function($, obj) {
  log_log.writelns('Adding Times');
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
    log_log.oklns('Prep Time: ' + text + ', Minutes: ' + calcMinutes(parseTime(text)));
    minutes = calcMinutes(parseTime(text));
    times.push(splitUp(minutes, 9)); // prep time
    return false; // stop iterating
  });

  listHelper($, '.hrecipe .recipe-about td span.totalTime', function() {
    text = _.trim(utiljs_text(this));
    log_log.oklns('Total Time: ' + text + ', Minutes: ' + calcMinutes(parseTime(text)));
    minutes = calcMinutes(parseTime(text));
    times.push(splitUp(minutes, 30));  // total time
    return false; // stop iterating
  });
};

var addCourse = function($, obj) {
  obj.categories || (obj.categories = []);
  log_log.writelns('Adding Course');
};

var addAsideNotes = function($, obj) {
  log_log.writelns('Adding Aside Notes');
  obj.asideNotes || (obj.asideNotes = []);
};

var addTags = function($, obj) {
  log_log.writelns('Adding Tags');
  obj.tags || (obj.tags = []);
  var tags = obj.tags;

  listHelper($, '.hrecipe .tags li', false, function(index, tag) {
    tags.push(_.trim(utiljs_fulltext(tag)));
  });
  log_log.oklns(tags.join(', '));
};

mod_scrape = function(callback, parser, url) {
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

    obj.parsedUrl = ext_URL.parse(url, true);
    delete obj.parsedUrl.query;
    delete obj.parsedUrl.search;

    obj.publicationPage = [
      "<ul><li><a href='",
      ext_URL.format(obj.parsedUrl),
      "'>",
      obj.datePublished,
      '</a></li></ul>'
    ].join('');

    callback(null, [obj]);
  });
};
var mod_scrape;
export { mod_scrape as scrape };
