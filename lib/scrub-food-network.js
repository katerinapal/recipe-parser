import request from "request";
import cheerio from "cheerio";
import changeCase from "change-case";
import URL from "url";
import * as macgourmetconstants_constantsjs from "./mac-gourmet-constants";
import { CategoryClassifier as categoryclassifier_CategoryClassifierjs } from "./category-classifier";
import { util as util_utiljs } from "./util";
import { log as log_logjs } from "./log";

var classifier = new categoryclassifier_CategoryClassifierjs(), _ = util_utiljs._;

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

  listHelper($, '.section.title > .title > h1[itemprop="name"]', function(index, title) {
    //console.log(this);  // refers to the $ wrapped title element
    //console.log(title); //refers to the plain title element
    obj.title = _.trim(util_utiljs.text(this));
    log_logjs.oklns(obj.title);
  });
};

var addServings = function($, obj) {
  log_logjs.writelns('Adding Servings');
  listHelper($, 'dd[itemprop="recipeYield"]', function() {
    obj.servings = util_utiljs.substituteFraction(_.trim(util_utiljs.text(this)));
    log_logjs.oklns(obj.servings);
    return false; // stop iterating
  });
};

var addImage = function($, obj) {
  obj.image || (obj.image = {});
  log_logjs.writelns('Adding Image');

  listHelper($, '#photo img', function() {
    obj.image = {
      src: this.attr('src'),
      alt: this.attr('alt')
    };
    return false; // stop iterating
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
      var group = _.trim(util_utiljs.text(this));
      if (group) {
        var match = group.match(removeEndingColonRe);
        if (match) {
          group = changeCase.titleCase(match[1]);
        } else {
          group = changeCase.titleCase(group);
        }
      }
      log_logjs.ok('Group: ' + group);

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

// http://www.foodnetwork.com/recipes/alton-brown/pumpkin-pie-recipe.html
var removeEndingColonRe = /([^:]*):$/;
var addProcedures = function($, obj) {
  log_logjs.writelns('Adding Procedures');
  obj.procedures || (obj.procedures = []);
  var header,
      match,
      text;

  listHelper($, '.directions[itemprop="recipeInstructions"] > *', function(index, procedure) {
    if (this.is('span.subtitle')) {
      header = _.trim(util_utiljs.text(this));
    } else if (this.is('p')) {
      text = util_utiljs.substituteDegree(util_utiljs.substituteFraction(_.trim(util_utiljs.fulltext(procedure))));
      if (header) {
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

      header = undefined;

    } else {
      return true; // keep iterating
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

  //addTime(9, item.prepTime); // prep
  //addTime(5, item.cookTime); // cook
  //addTime(30, item.totalTime); // total
  //addTime(28, item.inactiveTime); // inactive
  //matches = time.match(/(\d+)H(\d+)M/i); // PT1H0M
  //if (matches) {
    //hours = parseInt(matches[1], 10);
    //minutes = parseInt(matches[2], 10);
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

var addTags = function($, obj) {
  //verbose('## Adding Tags');
  obj.tags || (obj.tags = []);
  listHelper($, '.article-info li.tags span', false, function(tag) {
    if (!tag) { return; }
    obj.tags.push(util_utiljs.trim(tag.striptags));
  });
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

    addServings($, obj);
    addImage($, obj);
    addIngredients(parser, $, obj);
    //addProcedures($, obj);
    //addNotes($, obj);
    //addTimes($, obj);
    //addCourse($, obj);
    //addTags($, obj);

    obj.parsedUrl = URL.parse(url, true);
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
export { scrape_scrape as scrape };
