import request from "request";
import cheerio from "cheerio";
import changeCase from "change-case";
import * as entities_decodejs from "./entities";
import URL from "url";
import * as macgourmetconstants_constantsjs from "./mac-gourmet-constants";
import { CategoryClassifier as categoryclassifier_CategoryClassifierjs } from "./category-classifier";
import { util as util_utiljs } from "./util";
import { log as log_logjs } from "./log";

var classifier = new categoryclassifier_CategoryClassifierjs(), _ = util_utiljs._;

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
    log_logjs.debug(elements.length);
    if (elements.length) {
      elements.each(function(index, element) {
        return callback.call(this, index, element);
      });
    }
  } catch(e) {
    log_logjs.errorlns(e);
  }
};

var addTitle = function($, obj) {
  log_logjs.writelns('Adding Title');
  var text;

  listHelper($, '.hrecipe h1.fn', function(index, title) {
    //console.log(this);  // refers to the $ wrapped title element
    //console.log(title); //refers to the plain title element
    obj.title = _.trim(util_utiljs.text(this));
    log_logjs.oklns(obj.title);
  });
};

var addDatePublished = function($, obj) {
  log_logjs.writelns('Adding Date Published');
  listHelper($, 'footer.metadata > time', function(index, meta) {
    obj.datePublished = _.trim(_.first(util_utiljs.text(this).split(util_utiljs.linefeed)));
    log_logjs.oklns(obj.datePublished);
  });
};

var addServings = function($, obj) {
  log_logjs.writelns('Adding Servings');
  listHelper($, '.hrecipe .recipe-about td span.yield', function(index, h4) {
    obj.servings = util_utiljs.substituteFraction(_.trim(util_utiljs.text(this)));
    log_logjs.oklns(obj.servings);
  });
};

var addImage = function($, obj) {
  obj.image || (obj.image = {});
  log_logjs.writelns('Adding Image');

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
  log_logjs.writelns('Adding Summary');
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

    text = util_utiljs.substituteDegree(util_utiljs.substituteFraction(_.trim(entities_decodejs(this.html()))));
    log_logjs.ok(text);
    obj.summaries.push(text);
  });
};

var addIngredients = function(parser, $, obj) {
  obj.ingredients || (obj.ingredients = []);
  obj.saveIngredients || (obj.saveIngredients = []);
  obj.categories || (obj.categories = []);
  log_logjs.writelns('Adding Ingredients');
  var top = obj.ingredients,
      list = obj.ingredients,
      descriptions = [],
      saveInbObj,
      retval,
      output,
      text;

  listHelper($, '.hrecipe .content-unit .ingredients ul li span', function(index, ingredient) {
    if (!this.children('strong').length) {
      text = _.trim(util_utiljs.fulltext(ingredient));
      text = util_utiljs.decodeFractions(text);

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
          log_logjs.oklns(vals.description);
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
            log_logjs.ok(util_utiljs.substituteDegree(util_utiljs.substituteFraction(output)));
          }
        }
      })(retval);

      if (!_.isEmpty(output)) {
        list.push(retval);
      }
    } else {
      listHelper($, 'strong', this, function() {
        log_logjs.ok('Group: ' + _.trim(util_utiljs.text(this)));
        var parent = {
          description: _.trim(util_utiljs.text(this)),
          isDivider: true,
          ingredients: []
        };
        top.push(parent);
        list = parent.ingredients;
      });
    }
  });
  //console.log(JSON.stringify(obj.ingredients, null, 2));

  log_logjs.writelns('Guessing Categories');
  var categories = classifier.guessCategories(descriptions);
  _.each(categories, function(cat) {
    obj.categories.push({
      id: macgourmetconstants_constantsjs.CATEGORIES[cat.id],
      name: cat.id
    });
    //log.ok('"' + cat.id + '", with probability of ' + cat.avg);
  });
};

var removeEndingColonRe = /([^:]*):$/;
var addProcedures = function($, obj) {
  log_logjs.writelns('Adding Procedures');
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
        header = _.trim(util_utiljs.text(this));
      });

      listHelper($, 'p', this, function(idx, proc) {
        tmp = _.trim(util_utiljs.substituteDegree(util_utiljs.substituteFraction(util_utiljs.fulltext(proc))));
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
        header = changeCase.titleCase(header);
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
      log_logjs.oklns(index + 1 + ' # ' + header + ' # ' + text);
    } else {
      log_logjs.oklns(index + 1 + ' - ' + text);
    }
  });
};

var addNotes = function($, obj) {
  log_logjs.writelns('Adding Notes');
  obj.notes || (obj.notes = []);
};

var hoursRe = /(\d+(?:\.\d{1,2})?(?! *\/))? *(\d+ *\/ *\d+)? *hours?.*$/;
var minutesRe = /(\d+(?:\.\d{1,2})?(?! *\/))? *(\d+ *\/ *\d+)? *minutes?.*$/;
var addTimes = function($, obj) {
  log_logjs.writelns('Adding Times');
  obj.times || (obj.times = []);
  var times = obj.times,
      minutes,
      text;

  var parseTime = function(str) {
    var matches;

    return _.map([hoursRe, minutesRe], function(re) {
      matches = str.match(re);
      if (!matches) { return {}; }

      util_utiljs.remove(matches, 0, 0);
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
    text = _.trim(util_utiljs.text(this));
    log_logjs.oklns('Prep Time: ' + text + ', Minutes: ' + calcMinutes(parseTime(text)));
    minutes = calcMinutes(parseTime(text));
    times.push(splitUp(minutes, 9)); // prep time
    return false; // stop iterating
  });

  listHelper($, '.hrecipe .recipe-about td span.totalTime', function() {
    text = _.trim(util_utiljs.text(this));
    log_logjs.oklns('Total Time: ' + text + ', Minutes: ' + calcMinutes(parseTime(text)));
    minutes = calcMinutes(parseTime(text));
    times.push(splitUp(minutes, 30));  // total time
    return false; // stop iterating
  });
};

var addCourse = function($, obj) {
  obj.categories || (obj.categories = []);
  log_logjs.writelns('Adding Course');
};

var addAsideNotes = function($, obj) {
  log_logjs.writelns('Adding Aside Notes');
  obj.asideNotes || (obj.asideNotes = []);
};

var addTags = function($, obj) {
  log_logjs.writelns('Adding Tags');
  obj.tags || (obj.tags = []);
  var tags = obj.tags;

  listHelper($, '.hrecipe .tags li', false, function(index, tag) {
    tags.push(_.trim(util_utiljs.fulltext(tag)));
  });
  log_logjs.oklns(tags.join(', '));
};

var scrape_scrape;

scrape_scrape = function(callback, parser, url) {
  request(url, function (err, response, body) {
    if (err) { throw err; }
    var $ = cheerio.load(body, {
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

    obj.parsedUrl = URL.parse(url, true);
    delete obj.parsedUrl.query;
    delete obj.parsedUrl.search;

    obj.publicationPage = [
      "<ul><li><a href='",
      URL.format(obj.parsedUrl),
      "'>",
      obj.datePublished,
      '</a></li></ul>'
    ].join('');

    callback(null, [obj]);
  });
};
export { scrape_scrape as scrape };
