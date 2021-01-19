"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.altMeasurementTerms = exports.regexIndexOf = exports.trimMultipleWhiteSpace = exports.splitCSS = exports.fulltext = exports.text = exports.unescape = exports.expandHomeDir = exports.writePlist = exports.decodeFractions = exports.substituteFraction = exports.substituteDegree = exports.repeat = exports.remove = exports.linefeed = exports._ = exports.util = undefined;

var _async = require("async");

var _async2 = _interopRequireDefault(_async);

var _util = require("util");

var _util2 = _interopRequireDefault(_util);

var _plist = require("plist");

var _plist2 = _interopRequireDefault(_plist);

var _fs = require("fs");

var _fs2 = _interopRequireDefault(_fs);

var _pluralize = require("pluralize");

var _pluralize2 = _interopRequireDefault(_pluralize);

var _path = require("path");

var _path2 = _interopRequireDefault(_path);

var _http = require("http");

var _http2 = _interopRequireDefault(_http);

var _url = require("url");

var _url2 = _interopRequireDefault(_url);

var _entities = require("./entities");

var _underscore = require("underscore");

var _underscore2 = _interopRequireDefault(_underscore);

var _underscore3 = require("underscore.string");

var _underscore4 = _interopRequireDefault(_underscore3);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var mod_util = {};
var savePlistToFile;
var downloadAllImages;
var collateAllImages;
var util_downloadImage;
var saveJustIngredients;
var _saveIngredients;
var altMeasurementTerms;
var regexIndexOf;
var trimMultipleWhiteSpace;
var util_splitCSS;
var util_fulltext;
var util_striptags;
var util_text;
var util_rawtext;
var descSortByStr;
var util_unescape;
var expandHomeDir;
var util_writePlist;
var decodeFractions;
var substituteFraction;
var substituteDegree;
var util_repeat;
var calcPadding;
var util_strcmp;
var remove;
var normalizelf;
var linefeed;
var util__;


// The module to be exported.
var util = exports.util = mod_util = {};

// External libs.
var _ = exports._ = util__ = _underscore2.default;

// Mixin Underscore.string methods.
_underscore2.default.str = _underscore4.default;
_underscore2.default.mixin(_underscore2.default.str.exports());

// The line feed char for the current system.
exports.linefeed = linefeed = process.platform === 'win32' ? '\r\n' : '\n';

// Normalize linefeeds in a string.
normalizelf = function normalizelf(str) {
  return str.replace(/\r\n|\n/g, linefeed);
};

exports.remove = remove = function remove(array, from, to) {
  var rest = array.slice((to || from) + 1 || array.length);
  array.length = from < 0 ? array.length + from : from;
  return array.push.apply(array, rest);
};

var strcmp = util_strcmp = function util_strcmp(str1, str2) {
  // http://kevin.vanzonneveld.net
  // +   original by: Waldo Malqui Silva
  // +      input by: Steve Hilder
  // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  // +    revised by: gorthaur
  // *     example 1: strcmp( 'waldo', 'owald' );
  // *     returns 1: 1
  // *     example 2: strcmp( 'owald', 'waldo' );
  // *     returns 2: -1

  return str1 === str2 ? 0 : str1 > str2 ? 1 : -1;
};

calcPadding = function calcPadding(num, minLen) {
  if (_underscore2.default.isNumber(num)) {
    num = num.toString();
  }
  var minLen = 2,
      padding = '',
      len = num.length;

  if (len > minLen) {
    minLen = len;
  }
  for (var i = 0; i < minLen; i++) {
    padding += '0';
  }
  return {
    len: -1 * minLen,
    padding: padding
  };
};

// Return the string `str` repeated `n` times.
var repeat = exports.repeat = util_repeat = function util_repeat(n, str) {
  return new Array(n + 1).join(str || ' ');
};

var degreeRe = /(\d+\s)degree(?:s)?(?:\sf)?/gi; // 160 degrees F -> 160°F
exports.substituteDegree = substituteDegree = function substituteDegree(str) {
  if (!str) {
    return '';
  }
  return str.replace(degreeRe, function (str, p1, offset, s) {
    // '350 degree F for 30 minutes' -->
    // ["350 degree F", "350 ", 0, "350 degree F for 30 minutes"]
    //if (!p1) { console.log(arguments); exit(1);}
    return p1.trim() + '°F';
  });
};

var _fractions = {
  '1/4': '¼',
  '1/2': '½',
  '3/4': '¾',
  '1/3': '⅓',
  '2/3': '⅔',
  '1/5': '⅕',
  '2/5': '⅖',
  '3/5': '⅗',
  '4/5': '⅘',
  '1/6': '⅙',
  '5/6': '⅚',
  '1/8': '⅛',
  '3/8': '⅜',
  '5/8': '⅝',
  '7/8': '⅞'
};

var fractionRe = /((?:\d+) )?((?:\d)\/(?:\d))/g;
exports.substituteFraction = substituteFraction = function substituteFraction(str) {
  if (!str) {
    return '';
  }
  var findFraction = function findFraction(str) {
    if (_fractions[str]) {
      return _fractions[str];
    } else {
      return str;
    }
  };
  return str.replace(fractionRe, function (str, p1, p2, offset, s) {
    // '15 1/2, 6 3/4 1/2 andrew' -->
    // ["15 1/2", "15 ", "1/2", 0, "15 1/2, 6 3/4 1/2 andrew"]
    // ["6 3/4", "6 ", "3/4", 8, "15 1/2, 6 3/4 1/2 andrew"]
    // ["1/2", undefined, "1/2", 14, "15 1/2, 6 3/4 1/2 andrew"]

    var fraction = findFraction(p2);
    if (p1) {
      return p1.trim() + fraction;
    }
    return fraction;
  });
};

exports.decodeFractions = decodeFractions = function decodeFractions(str) {
  // Decode literal fractions
  for (var i in _fractions) {
    str = str.replace(new RegExp(_fractions[i], 'g'), i);
  }

  return str;
};

var writePlist = exports.writePlist = util_writePlist = function util_writePlist(callback, obj, output) {
  var data = exportToPlist(obj);
  _fs2.default.writeFile(output, data, function (err) {
    if (err) {
      callback(err);
    }
    callback(null, 'successfully saved file to ' + output);
  });
};

var exportToPlist = function exportToPlist(obj) {
  var headers = ['<?xml version="1.0" encoding="UTF-8"?>', '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">', '<plist version="1.0">'];

  var data = headers.join('\n') + _plist2.default.stringify(obj) + '\n</plist>';

  return data;
};

exports.expandHomeDir = expandHomeDir = function expandHomeDir(dir) {
  dir = dir || '';
  if (dir.indexOf('~') === 0) {
    var home = process.env.HOME;
    var splits = dir.split('~');

    if (splits.length > 0) {
      dir = home + splits[1];
    } else {
      dir = home;
    }
  }
  return dir;
};

// unescape regex cache
var unescapeRegexCache = {};

exports.unescape = util_unescape = function util_unescape(str) {
  str = str || '';
  var mapping = {
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#x27;': "'",
    '&#x60;': '`',
    '&amp;': '&',
    '&frasl;': '/',
    '&mdash;': '—'
  };
  _underscore2.default.each(mapping, function (value, key) {
    var re;
    if (!unescapeRegexCache[key]) {
      re = new RegExp(key, 'gi');
      unescapeRegexCache[key] = re;
    } else {
      re = unescapeRegexCache[key];
    }
    str = str.replace(re, value);
  });
  return str;
};

descSortByStr = function descSortByStr(obj, val, context) {
  // http://stackoverflow.com/questions/5013819/reverse-sort-order-with-backbone-js
  //
  // The Underscore.js method _.sortBy ends up "wrapping" up javascript
  // .sort() in a way that makes sorting strings in reverse difficult. Simple
  // negation of the string ends up returning NaN and breaks the sort.
  //
  // If you need to perform a reverse sort with Strings, such as reverse
  // alphabetical sort, here's a really hackish way of doing it:
  var iterator = _underscore2.default.isFunction(val) ? val : function (obj) {
    return obj[val];
  };
  return _underscore2.default.sortBy(obj, function (item) {
    var str = iterator.call(context, item);
    str = str.toLowerCase();
    str = str.split('');
    str = _underscore2.default.map(str, function (letter) {
      return String.fromCharCode(-letter.charCodeAt(0));
    });
    return str;
  });
};

// returns text immediately inside the selected element
var rawtext = util_rawtext = function util_rawtext(elem) {
  var text = '',
      child,
      children;

  if (_underscore2.default.isFunction(elem.children)) {
    children = elem[0].children;
  } else {
    children = elem.children;
  }

  if (children.length) {
    for (var x = 0, last = children.length; x < last; x++) {
      child = children[x];
      if (child.type === 'text') {
        text += child.data;
      }
    }
  }
  return text;
};

//
// <a href="hello.htm">Hello <b>World!</b></a>
//
// text($('a'))
//   => outputs 'Hello'
//
// outputs the text DIRECTLY inside the tag. like rawtext but BR's
// replaced with \n, and entities decoded
var text = exports.text = util_text = function util_text(elem) {
  var text = '',
      child,
      children;

  if (_underscore2.default.isFunction(elem.children)) {
    children = elem[0].children;
  } else {
    children = elem.children;
  }

  if (children.length) {
    for (var x = 0, last = children.length; x < last; x++) {
      child = children[x];
      if (child.type === 'text') {
        text += child.data;
      } else if (child.name === 'br') {
        text += linefeed;
      }
    }
  }
  return (0, _entities.entitiesjs)(text);
};

// same as rawtext, but also includes text inside nested elems
var striptags = util_striptags = function util_striptags(elem) {
  var text = '',
      child,
      children;

  if (_underscore2.default.isFunction(elem.children)) {
    //children = elem.children();
    children = elem[0].children;
  } else {
    children = elem.children;
  }

  if (children && children.length > 0) {
    for (var i = 0, l = children.length; i < l; i++) {
      child = children[i];
      if (child.type === 'text') {
        text += child.data;
      } else if (child.type === 'tag') {
        text += striptags(child);
      }
    }
  }
  return text;
};

//
// <a href="hello.htm">Hello <b>World!</b></a>
//
// fulltext($('a'))
//   => outputs 'Hello World!'
//
// outputs the text inside the tag including the text inside of each nested
// tag. BR's replaced with \n, and entities decoded;
var fulltext = exports.fulltext = util_fulltext = function util_fulltext(elem) {
  var text = '',
      child,
      children;

  if (_underscore2.default.isFunction(elem.children)) {
    //children = elem.children();
    children = elem[0].children;
  } else {
    children = elem.children;
  }

  if (children && children.length > 0) {
    for (var i = 0, l = children.length; i < l; i++) {
      child = children[i];
      if (child.type === 'text') {
        text += child.data;
      } else if (child.name === 'br') {
        text += linefeed;
      } else if (child.type === 'tag') {
        text += fulltext(child);
      }
    }
  }

  return (0, _entities.entitiesjs)(text);
};

// http://stackoverflow.com/questions/6970221/parsing-css-background-image
var token = /((?:[^"']|".*?"|'.*?')*?)([(,)]|$)/g;
var splitCSS = exports.splitCSS = util_splitCSS = function util_splitCSS(string) {
  var recurse = function recurse(str) {
    for (var array = [];;) {
      var result = token.exec(string);
      if (result[2] === '(') {
        array.push(result[1].trim() + '(' + recurse(str).join(',') + ')');
        result = token.exec(string);
      } else {
        array.push(result[1].trim());
      }
      if (result[2] !== ',') {
        return array;
      }
    }
  };

  var retval = recurse(string);
  token.lastIndex = 0;
  return retval;
};

var whiteSpaceRe = /\s{2,}/g;
exports.trimMultipleWhiteSpace = trimMultipleWhiteSpace = function trimMultipleWhiteSpace(text) {
  return text.replace(whiteSpaceRe, ' '); // replace extra spaces with one
};

// http://stackoverflow.com/questions/273789
exports.regexIndexOf = regexIndexOf = function regexIndexOf(str, regex, startpos) {
  var indexOf = str.substring(startpos || 0).search(regex);
  return indexOf >= 0 ? indexOf + (startpos || 0) : indexOf;
};

var _altMeasurementTerms = ['bag', 'can'];

exports.altMeasurementTerms = altMeasurementTerms = _underscore2.default.union(_altMeasurementTerms, _underscore2.default.map(_altMeasurementTerms, function (term) {
  return _pluralize2.default.plural(term);
})).sort();

_saveIngredients = function saveIngredients(items, fileName) {
  var data = require(fileName);
  _underscore2.default.each(items, function (item) {
    _underscore2.default.each(_saveIngredients, function (ingredient) {
      data.push(ingredient);
    });
    _fs2.default.writeFileSync(fileName, 'module.exports = ' + JSON.stringify(data, null, 2) + ';');
  });
};

saveJustIngredients = function saveJustIngredients(ingredients, fileName, callback) {
  var data = require(fileName);
  _underscore2.default.each(ingredients, function (ingredient) {
    data.push(ingredient);
  });
  var data = 'module.exports = ' + JSON.stringify(data, null, 2) + ';';
  _fs2.default.writeFile(fileName, data, callback);
};

var downloadImage = util_downloadImage = function util_downloadImage(src, callback) {
  if (src.indexOf('//') === 0) {
    src = src.replace('//', 'http://');
  }
  var oURL = _url2.default.parse(src);
  var request = _http2.default.request({
    port: 80,
    host: oURL.hostname,
    method: 'GET',
    path: oURL.pathname
  });

  request.end();
  request.on('response', function (response) {
    var type = response.headers['content-type'],
        prefix = 'data:' + type + ';base64,',
        body = '';

    response.setEncoding('binary');
    response.on('end', function () {
      var base64 = new Buffer(body, 'binary').toString('base64');
      callback(null, base64);
    });
    response.on('data', function (chunk) {
      if (response.statusCode === 200) {
        body += chunk;
      }
    });
  });
};

// collate all images
collateAllImages = function collateAllImages(items) {
  var images = [];
  _underscore2.default.each(items, function (item) {
    if (item.image && item.image.src) {
      images.push(item.image);
    }
    if (item.notes && item.notes.length) {
      _underscore2.default.each(item.notes, function (note) {
        if (note.image && note.image.src) {
          images.push(note.image);
        }
      });
    }
    if (item.procedures && item.procedures.length) {
      _underscore2.default.each(item.procedures, function (procedure) {
        if (procedure.image && procedure.image.src) {
          images.push(procedure.image);
        }
      });
    }
  });
  return images;
};

// download all images
downloadAllImages = function downloadAllImages(images, callback) {
  _async2.default.forEach(images, function (image, done) {
    if (image.src) {
      downloadImage(image.src, function (err, base64) {
        if (!err) {
          console.log('Downloaded: ' + image.src);
        }
        image.data = base64;
        done();
      });
    } else {
      done();
    }
  }, callback);
};

savePlistToFile = function savePlistToFile(obj) {
  var plistFile = expandHomeDir('~/Desktop/recipe.mgourmet4');
  writePlist(function (err, obj) {
    if (err) {
      console.error(err);
    }
  }, [obj], plistFile);
};

exports.util = mod_util;
exports._ = util__;
exports.linefeed = linefeed;
exports.remove = remove;
exports.repeat = util_repeat;
exports.substituteDegree = substituteDegree;
exports.substituteFraction = substituteFraction;
exports.decodeFractions = decodeFractions;
exports.writePlist = util_writePlist;
exports.expandHomeDir = expandHomeDir;
exports.unescape = util_unescape;
exports.text = util_text;
exports.fulltext = util_fulltext;
exports.splitCSS = util_splitCSS;
exports.trimMultipleWhiteSpace = trimMultipleWhiteSpace;
exports.regexIndexOf = regexIndexOf;
exports.altMeasurementTerms = altMeasurementTerms;