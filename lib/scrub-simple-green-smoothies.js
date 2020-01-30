var _util = require("util");

var _util2 = _interopRequireDefault(_util);

var _async = require("async");

var _async2 = _interopRequireDefault(_async);

var _node = require("node.io");

var _node2 = _interopRequireDefault(_node);

var _commander = require("commander");

var _commander2 = _interopRequireDefault(_commander);

var _http = require("http");

var _http2 = _interopRequireDefault(_http);

var _url = require("url");

var _url2 = _interopRequireDefault(_url);

var _2 = require("../");

var _util3 = require("./util");

var util = _interopRequireWildcard(_util3);

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

/* jshint indent: false */
var _ = util._;

_commander2.default.version('0.1').description('Scrub a recipe from seriouseats.com').option('-u, --url <string>', 'url of recipe to scrub').option('-d, --debug', 'output extra debug information').parse(process.argv);

var verbose = function verbose() {
  if (_commander2.default.debug) {
    console.log.apply(null, arguments);
  }
};

var listHelper = function listHelper($, selector, chooseFirst, helper) {
  var elements;
  try {
    var elements = $(selector);
    if (elements.length) {
      verbose('  count: ' + elements.length);
      if (chooseFirst) {
        helper(_.first(elements));
      } else {
        elements.each(function (ele) {
          helper(ele);
        });
      }
    } else if (elements.children && elements.children.length) {
      verbose('  count: ' + elements.children.length);
      if (chooseFirst) {
        helper(elements.children.first());
      } else {
        elements.children.each(function (ele) {
          helper(ele);
        });
      }
    } else {
      verbose('  count: 1');
      helper(elements);
    }
  } catch (e) {
    verbose(e);
    helper();
  }
};

var addSummary = function addSummary($, obj) {
  verbose('## Adding Summary');
  obj.summaries || (obj.summaries = []);

  var summary;

  function summaryHelper(ele) {
    if (!summary) {
      summary = ele.striptags || ele.innerHTML;
      //console.log(summary);
    }
  }

  listHelper($, '.entry span[itemprop="description"]', false, function (ele) {
    if (!ele) {
      try {
        var elements = $('.entry p em');

        if (elements.length) {
          elements.each(summaryHelper);
        } else if (elements.children && elements.children.length) {
          elements.children.each(summaryHelper);
        }
      } catch (e) {
        verbose(e);
      }
    } else {
      summary = ele.striptags || ele.innerHTML;
    }

    if (summary) {
      obj.summaries.push(util.substituteFraction(util.trim(summary)));
    }
  });
};

var addProcedure = function addProcedure($, obj) {
  verbose('## Adding Procedures');
  obj.procedures || (obj.procedures = []);
  listHelper($, '.entry span[itemprop="recipeInstructions"]', true, function (procedure) {
    if (!procedure) {
      return;
    }
    obj.procedures.push(util.substituteDegree(util.substituteFraction(util.trim(procedure.striptags || procedure.innerHTML))));
  });
};

var addImage = function addImage($, obj) {
  verbose('## Adding Image');

  listHelper($, '.portfolio-item.single-portfolio-image img', true, function (img) {
    if (!img) {
      return;
    }
    obj.image = {
      src: img.attribs.src,
      alt: img.attribs.alt
    };
  });
};

var addIngredients = function addIngredients($, obj) {
  verbose('## Adding Ingredients');
  obj.ingredients || (obj.ingredients = []);
  var ingredients, text, matches, breakdown, description;

  try {
    ingredients = $('.ingredients li');
  } catch (e) {
    verbose(e);
  }

  function ingredientHelper(ele) {
    if (!ingredients) {
      ingredients = (ele.striptags || '').split('\n');
      //console.log(ingredients);
      if (ingredients.length === 1) {
        ingredients = undefined;
      }
    }
  }

  if (!ingredients) {
    try {
      var elements = $('.entry p');
      if (elements.length) {
        elements.each(ingredientHelper);
      } else if (elements.children && elements.children.length) {
        elements.children.each(ingredientHelper);
      }
    } catch (e) {
      verbose(e);
    }
  } else {
    var temp = [];
    ingredients.each(function (ingredient) {
      // move from elements to array of strings
      temp.push(ingredient.striptags || ingredient.innerHTML);
    });
    ingredients = temp;
  }

  _.each(ingredients, function (ingredient) {
    breakdown = {};
    text = util.unescape(ingredient);
    if (text) {
      matches = text.match(/^([-\d\/ ]+(?:\s+to\s+)?(?:[\d\/ ]+)?)?\s*(\w+)\s+(.*)/i);
      //console.log('match: ' + matches);

      if (matches && matches.length) {
        breakdown.quantity = matches[1];
        breakdown.measurement = matches[2];

        if (matches[3].indexOf(',') > 0) {
          text = matches[3];
          matches = text.match(/(.*), ([^,]*$)/i);

          breakdown.product = util.substituteFraction(util.trim(matches[1]));
          breakdown.direction = util.substituteFraction(util.trim(matches[2]));
        } else {
          breakdown.product = util.substituteFraction(util.trim(matches[3]));
        }

        obj.ingredients.push(breakdown);
      }
    }
  });
};

var scrape = function scrape(callback, url) {
  var methods = {
    input: false,
    run: function run() {
      var self = this;
      this.getHtml(url, function (err, $) {
        if (err) {
          this.exit(err);
        }
        var obj = {};

        try {
          obj.title = $('h1.title').striptags;

          addImage($, obj);
          addSummary($, obj);
          addIngredients($, obj);
          addProcedure($, obj);

          verbose('## Adding Servings');
          var servings = $('.entry span[itemprop="recipeYield"]');
          if (servings) {
            obj.servings = servings.striptags;
          }
        } catch (e) {
          verbose(e);
        }

        this.emit(obj);
      });
    }
  };

  var job = new _node2.default.Job({
    auto_retry: true,
    timeout: 20,
    retries: 3,
    silent: true
  }, methods);

  _node2.default.start(job, {}, function (err, data) {
    if (err) {
      callback(err);
    }
    callback(null, data);
  }, true);
};

if (_commander2.default.url) {
  var url = _commander2.default.url;

  var exportRecipe = function exportRecipe(item) {
    var obj = {};
    obj['AFFILIATE_ID'] = -1;
    obj['COURSE_ID'] = 2;
    //obj['COURSE_NAME'] = 'Main'
    obj['CUISINE_ID'] = -1;
    obj['DIFFICULTY'] = 0;
    //obj['KEYWORDS'] = item.tags.join(', ');
    obj['MEASUREMENT_SYSTEM'] = 0;
    obj['NAME'] = util.trim(item.title);
    obj['NOTE'] = '';
    obj['NOTES_LIST'] = [];
    obj['NUTRITION'] = '';
    obj['PUBLICATION_PAGE'] = url;
    obj['SERVINGS'] = 1;
    obj['SOURCE'] = 'Simple Green Smoothies';
    obj['SUMMARY'] = item.summaries.join('\n');
    obj['TYPE'] = 102;
    obj['URL'] = url;
    obj['YIELD'] = util.trim(item.servings);

    if (item.image.data) {
      obj['EXPORT_TYPE'] = 'BINARY';
      obj['IMAGE'] = item.image.data;
    }

    var categories = obj['CATEGORIES'] = [];
    var addCategory = function addCategory(id, name, userAdded) {
      categories.push({
        CATEGORY_ID: id,
        ITEM_TYPE_ID: 102,
        NAME: name,
        USER_ADDED: userAdded
      });
    };
    addCategory(206, 'Smoothies', false);

    var directions = obj['DIRECTIONS_LIST'] = [];
    _.each(item.procedures, function (procedure) {
      procedure = util.trim(procedure);
      if (procedure) {
        procedure = procedure.replace(/\s{2,}/g, ' '); // replace extra spaces with one
        directions.push({
          VARIATION_ID: -1,
          LABEL_TEXT: '',
          IS_HIGHLIGHTED: false,
          DIRECTION_TEXT: procedure
        });
      }
    });

    var ingredients = obj['INGREDIENTS_TREE'] = [];
    _.each(item.ingredients, function (ingredient) {
      ingredients.push({
        DESCRIPTION: util.trim(ingredient.product),
        DIRECTION: util.trim(ingredient.direction) || '',
        INCLUDED_RECIPE_ID: -1,
        IS_DIVIDER: false,
        IS_MAIN: false,
        MEASUREMENT: util.trim(ingredient.measurement),
        QUANTITY: util.trim(ingredient.quantity)
      });
    });

    var plist_file = util.expandHomeDir('~/Desktop/recipe.mgourmet4');
    util.writePlist(function (err, obj) {
      if (err) {
        console.error(err);
      }
    }, [obj], plist_file);
  };

  scrape(function (err, items) {
    if (err) {
      console.log(err);
    }

    _async2.default.forEach(items, function (item, done) {
      if (item.image.src) {
        var oURL = _url2.default.parse(item.image.src),
            request = _http2.default.request({
          port: 80,
          host: oURL.hostname,
          method: 'GET',
          path: oURL.pathname
        });

        request.end();
        request.on('response', function (response) {
          var type = response.headers["content-type"],
              prefix = 'data:' + type + ';base64,',
              body = '';

          response.setEncoding('binary');
          response.on('end', function () {
            var base64 = new Buffer(body, 'binary').toString('base64'),
                data = prefix + base64;
            //item.image.data = data;
            item.image.data = base64;
            done();
          });
          response.on('data', function (chunk) {
            if (response.statusCode === 200) {
              body += chunk;
            }
          });
        });
      } else {
        done();
      }
    }, function (err) {
      _.each(items, function (item) {
        exportRecipe(item);
        console.log('Done: ' + item.title);
      });
    });
  }, url);
} else {
  console.log(_commander2.default.description());
  console.log("Version: " + _commander2.default.version());
  console.log(_commander2.default.helpInformation());
}
