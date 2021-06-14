"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CategoryClassifier = undefined;

var _util = require("util");

var _util2 = _interopRequireDefault(_util);

var _pluralize = require("pluralize");

var _pluralize2 = _interopRequireDefault(_pluralize);

var _backbone = require("backbone");

var _backbone2 = _interopRequireDefault(_backbone);

var _natural = require("natural");

var _natural2 = _interopRequireDefault(_natural);

var _goodEats = require("../test/data/good-eats");

var _util3 = require("./util");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Nodejs libs.
var _ = _util3._;

// code for guessing categories...
var commonWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us'];

var buildStems = function buildStems(data) {
  var stemmer = _natural2.default.PorterStemmer,
      stemmedData = stemmer.tokenizeAndStem(data);

  stemmedData = _.difference(stemmedData, commonWords);
  stemmedData = _.filter(stemmedData, function (stem) {
    return stem.length > 1;
  });
  return stemmedData;
};

var buildTopIngredients = function buildTopIngredients(records) {
  var obj = {},
      allIngs;

  _.each(records, function (record) {
    allIngs = _.compact(_.map(record.ingredients, function (ing) {
      return buildStems(ing).join(' ');
    }));

    _.each(allIngs, function (ing) {
      if (obj[ing]) {
        obj[ing]++;
      } else {
        obj[ing] = 1;
      }
    });
  });
  return obj;
};

var buildTopIngredientList = function buildTopIngredientList(records, count) {
  var list = _.map(records, function (t1, t2) {
    return {
      label: t2,
      value: t1
    };
  });
  list = _.sortBy(list, function (item) {
    return -1 * item.value;
  });
  if (count) {
    list = list.splice(0, count);
  }
  return _.pluck(list, 'label');
};

var buildClassifierDocuments = function buildClassifierDocuments(records, classifier, topHash, topList) {
  var allIngs;
  _.each(records, function (record) {
    allIngs = stemIngredients(record.ingredients, topList, topHash);
    _.each(record.categories, function (cat) {
      if (cat) {
        classifier.addDocument(allIngs.join(' '), cat);
      }
    });
  });
  classifier.train();
};

var stemIngredients = function stemIngredients(ingredients, topList, topHash) {
  var allIngs = _.compact(_.map(ingredients, function (ing) {
    return buildStems(ing).join(' ');
  }));

  // remove very common top x ingredients
  allIngs = _.difference(allIngs, topList);

  // remove ingredients with only 1 occurrence
  return _.compact(_.map(allIngs, function (ing) {
    if (topHash[ing] > 1) {
      return ing;
    }
  }));
};

var getClassifications = function getClassifications(ingredients, classifier, count) {
  if (!_.isArray(ingredients)) {
    ingredients = [ingredients];
  }

  var classHash = {},
      valInt;

  _.each(ingredients, function (ingr) {
    var classifications = classifier.getClassifications(ingr);
    //console.log(ingr);
    classifications = _.sortBy(classifications, function (item) {
      return -1 * item.value;
    });
    classifications = classifications.splice(0, count);
    classifications = _.map(classifications, function (item) {
      valInt = parseInt(item.value * 10000000);
      if (classHash[item.label]) {
        classHash[item.label].push(valInt);
      } else {
        classHash[item.label] = [valInt];
      }
      return {
        label: item.label,
        value: valInt
      };
    });
    //console.log(classifications);
  });
  return classHash;
};

var bayesianAverage = function bayesianAverage(avgNumVotes, avgRating, numVotes, rating) {
  return (avgNumVotes * avgRating + numVotes * rating) / (avgNumVotes + numVotes);
};

var calcAvgNumVotes = function calcAvgNumVotes(minCount, classifications) {
  // The average number of votes of all items that have numVotes > minCount
  var avgNumVotes = _.compact(_.map(classifications, function (vals, id) {
    if (vals.length > minCount) {
      return vals.length;
    }
  }));
  var length = avgNumVotes.length;
  avgNumVotes = _.reduce(avgNumVotes, function (memo, num) {
    return memo + num;
  }, 0);
  return avgNumVotes / length;
};

var calcAvgRating = function calcAvgRating(minCount, classifications) {
  // The average rating of each item (again, of those that have numVotes > minCount)
  var avgRating = _.compact(_.map(classifications, function (vals, id) {
    if (vals.length > minCount) {
      return _.reduce(vals, function (memo, num) {
        return memo + num;
      }, 0) / vals.length;
    }
  }));
  var length = avgRating.length;
  avgRating = _.reduce(avgRating, function (memo, num) {
    return memo + num;
  }, 0);
  return avgRating / length;
};

var buildBayesianAvgs = function buildBayesianAvgs(minCount, classifications, avgRating, avgNumVotes) {
  var classList = _.compact(_.map(classifications, function (vals, id) {
    if (vals.length > minCount) {
      //console.log(id + '-' + JSON.stringify(vals));
      var sum = _.reduce(vals, function (memo, num) {
        return memo + num;
      }, 0);
      var rating = sum / vals.length;

      return {
        id: id,
        avg: bayesianAverage(avgNumVotes, avgRating, vals.length, rating)
      };
    }
  }));

  classList = _.sortBy(classList, function (item) {
    return -1 * item.avg;
  });
  return _.map(classList, function (item) {
    return {
      id: item.id,
      avg: parseInt(item.avg)
    };
  });
};

var mod_CategoryClassifier;

var CategoryClassifier = _backbone2.default.Model.extend({
  initialize: function initialize() {},
  guessCategories: function guessCategories(ingredients) {
    var classifier = new _natural2.default.BayesClassifier();

    var topHash = buildTopIngredients(_goodEats.goodeatsjs);
    // now we have list of common ingredients to ignore
    var topList = buildTopIngredientList(topHash, 30);

    ingredients = stemIngredients(ingredients, topList, topHash);

    buildClassifierDocuments(_goodEats.goodeatsjs, classifier, topHash, topList);

    var classifications = getClassifications(ingredients, classifier, 10);

    var minCount = 1,
        avgNumVotes = calcAvgNumVotes(minCount, classifications),
        avgRating = calcAvgRating(minCount, classifications);

    return buildBayesianAvgs(minCount, classifications, avgRating, avgNumVotes);
  }
});

exports.CategoryClassifier = mod_CategoryClassifier = CategoryClassifier;
exports.CategoryClassifier = mod_CategoryClassifier;