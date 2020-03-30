import request from "request";
import cheerio from "cheerio";
import changeCase from "change-case";
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

  listHelper($, '.recipe.content h2[itemprop="name"]', function(index, title) {
    //console.log(this);  // refers to the $ wrapped title element
    //console.log(title); //refers to the plain title element
    obj.title = _.trim(util_utiljs.text(this));
    log_logjs.oklns(obj.title);
  });
};

var addDatePublished = function($, obj) {
  log_logjs.writelns('Adding Date Published');
  listHelper($, 'meta[itemprop="datePublished"]', function(index, meta) {
    obj.datePublished = _.trim(this.attr('content'));
    log_logjs.oklns(obj.datePublished);
  });
};

var addServings = function($, obj) {
  log_logjs.writelns('Adding Servings');
  listHelper($, 'h4[itemprop="recipeYield"]', function(index, h4) {
    obj.servings = util_utiljs.substituteFraction(_.trim(util_utiljs.text(this)));
    log_logjs.oklns(obj.servings);
  });
};

var addImage = function($, obj) {
  obj.image || (obj.image = {});
  log_logjs.writelns('Adding Image');

  var patternRe = /\('(.+?)'\)/g,
      backgroundImage,
      match;

  listHelper($, '.recipe-image .image', function(index, img) {
    var backgroundImage = _.first(util_utiljs.splitCSS(this.css('background')));
    match = patternRe.exec(backgroundImage);

    if (match && match.length) {
      log_logjs.ok(match[1]);
      obj.image = {
        src: match[1]
      };
    } else {
      log_logjs.ok(backgroundImage);
      obj.image = {
        src: backgroundImage
      };
    }
    return false; // stop iterating
  });
};

var addSummary = function($, obj) {
  obj.summaries || (obj.summaries = []);
  log_logjs.writelns('Adding Summary');
  var text;

  listHelper($, '.why .full p', function(index, summary) {
    //console.log(this);  // refers to the $ wrapped summary element
    //console.log(summary); //refers to the plain summary element
    text = util_utiljs.substituteDegree(util_utiljs.substituteFraction(_.trim(util_utiljs.fulltext(summary))));
    log_logjs.ok(index + 1 + '- ' + text);
    obj.summaries.push(text);
  });
};

var addIngredients = function(parser, $, obj) {
  obj.ingredients || (obj.ingredients = []);
  obj.saveIngredients || (obj.saveIngredients = []);
  obj.categories || (obj.categories = []);
  log_logjs.writelns('Adding Ingredients');
  var ingredients = $('.ingredients > ul li'),
      top = obj.ingredients,
      list = obj.ingredients,
      descriptions = [],
      saveInbObj,
      retval,
      output,
      text;

  listHelper($, '.ingredients > ul li', function(index, ingredient) {
    if (this.attr('itemprop') === 'ingredients') {
      text = _.trim(util_utiljs.fulltext(ingredient));
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
          log_logjs.ok(util_utiljs.substituteDegree(util_utiljs.substituteFraction(output)));
        }
      })(retval);

      list.push(retval);
    } else {
      listHelper($, 'h5', this, function() {
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

var removeLeadingDigitPeriodRe = /(?:^\d+\.\s+)(.*)$/;
var removeEndingColonRe = /([^:]*):$/;
var addProcedures = function($, obj) {
  log_logjs.writelns('Adding Procedures');
  obj.procedures || (obj.procedures = []);
  var header,
      match,
      text;

  listHelper($, '.instructions ol li[itemprop="recipeInstructions"] div', function(index, procedure) {
    header = undefined;

    listHelper($, 'b', this, function() {
      header = _.trim(util_utiljs.text(this));
    });

    text = util_utiljs.substituteDegree(util_utiljs.substituteFraction(_.trim(util_utiljs.fulltext(procedure))));
    match = text.match(removeLeadingDigitPeriodRe);
    if (match) {
      text = match[1];
    }
    if (header) {
      text = _.trim(text.replace(header, ''));
      match = header.match(removeEndingColonRe);
      if (match) {
        header = changeCase.titleCase(match[1]);
      }
    }

    obj.procedures.push({
      header: header,
      text: text
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
  var text;

  listHelper($, '.serves > p', function(index, note) {
    text = util_utiljs.substituteDegree(util_utiljs.substituteFraction(_.trim(util_utiljs.fulltext(note))));

    obj.notes.push({
      text: text
    });
    log_logjs.oklns(index + 1 + '- ' + text);
  });
};

var addTimes = function($, obj) {
  log_logjs.writelns('Adding Times');
  var text;

  listHelper($, '.other-attributes meta[itemprop="totalTime"]', function(index, meta) {
    text = _.trim(this.attr('content'));
    //PT0H0M  - 0 hours, 0 mins
    //PT1H20M - 1 hour, 20 mins
    obj.totalTime = text; // TODO - parse
    log_logjs.oklns(text);
  });
};

var addCourse = function($, obj) {
  obj.categories || (obj.categories = []);
  log_logjs.writelns('Adding Course');
  var name, val, cat;

  listHelper($, '.other-attributes meta[itemprop="recipeCategory"]', function(index, meta) {
    name = _.trim(this.attr('content'));
    if (name) {
      log_logjs.oklns(name);

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
      log_logjs.oklns(obj.course.id + ' - ' + obj.course.name);
    }
  });
};

var addAsideNotes = function($, obj) {
  log_logjs.writelns('Adding Aside Notes');
  obj.asideNotes || (obj.asideNotes = []);
  var match, text, note, img, h4, h3;

  listHelper($, '.asides > .aside', function(i, aside) {
    listHelper($, 'h4', this, function() {
      h4 = _.trim(util_utiljs.text(this));
    });
    listHelper($, 'h3', this, function() {
      h3 = _.trim(util_utiljs.text(this));
    });

    note = {
      h4: h4,
      h3: h3,
      intros: [],
      notes: []
    };

    $(this).children('p').each(function(index, element) {
      text = util_utiljs.substituteDegree(util_utiljs.substituteFraction(_.trim(util_utiljs.text(this))));
      if (text) {
        note.intros.push(text);
      }
    });

    listHelper($, '.page-item', this, function() {
      listHelper($, 'figure > img', this, function() {
        img = this.attr('src');
      });
      listHelper($, 'figure > figcaption', this, function() {
        text = util_utiljs.substituteDegree(util_utiljs.substituteFraction(_.trim(util_utiljs.fulltext(this))));
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

    log_logjs.ok(note.h4 + ' : ' + note.h3);
    _.each(note.notes, function(note, i) {
      log_logjs.ok(i + 1 + '- ' + note.text);
      log_logjs.ok(i + 1 + '- ' + note.image.src);
    });
  });
};

var combineNotes = function(obj) {
  var asideNotes = obj.asideNotes,
      notes = obj.notes,
      dest = [];

  delete obj.asideNotes;
  delete obj.notes;

  // Combine Notes and Aside Notes (with pictures)
  // into new destination of notes (flattened).
  var i = 0, noteObj, title;
  _.each(notes, function(note) {
    noteObj = {};
    dest.push({
      text: note.text,
      order: i++,
      kind: 10
    });
  });
  _.each(asideNotes, function(asideNote) {
    title = [
        '<h4>' + asideNote.h4 + '</h4>',
        '<h3>' + asideNote.h3 + '</h3>' ];

    var intros = _.map(asideNote.intros, function(intro) {
      return '<p>' + intro + '</p>';
    }).join(util_utiljs.linefeed);

    if (intros && intros.length) {
      dest.push({
        text: title.concat(intros).join(util_utiljs.linefeed),
        order: i++,
        kind: 10
      });
      title = []; // reset the <h4> and <h3>
    }

    _.each(asideNote.notes, function(note) {
      noteObj = {
        text: title.concat(['<p>' + note.text + '</p>']).join(util_utiljs.linefeed),
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
    combineNotes(obj);

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
