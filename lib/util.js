import async from "async";
import nodeUtil from "util";
import plist from "plist";
import fs from "fs";
import pluralize from "pluralize";
import path from "path";
import http from "http";
import URL from "url";
import * as entities from "./entities";
import underscorejs from "underscore";
import underscorestringjs from "underscore.string";

// External libs.
var _;

// Mixin Underscore.string methods.
_.str = underscorestringjs;
_.mixin(_.str.exports());

var strcmp;

// Return the string `str` repeated `n` times.
var repeat;

var degreeRe = /(\d+\s)degree(?:s)?(?:\sf)?/gi; // 160 degrees F -> 160°F

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
  '7/8': '⅞',
};

var fractionRe = /((?:\d+) )?((?:\d)\/(?:\d))/g;

var writePlist;

var exportToPlist = function(obj) {
  var headers = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">'
  ];

  var data =
    headers.join('\n') +
    plist.stringify(obj) +
    '\n</plist>';

  return data;
};

// unescape regex cache
var unescapeRegexCache = {};


// returns text immediately inside the selected element
var rawtext;

//
// <a href="hello.htm">Hello <b>World!</b></a>
//
// text($('a'))
//   => outputs 'Hello'
//
// outputs the text DIRECTLY inside the tag. like rawtext but BR's
// replaced with \n, and entities decoded
var text;

// same as rawtext, but also includes text inside nested elems
var striptags;

//
// <a href="hello.htm">Hello <b>World!</b></a>
//
// fulltext($('a'))
//   => outputs 'Hello World!'
//
// outputs the text inside the tag including the text inside of each nested
// tag. BR's replaced with \n, and entities decoded;
var fulltext;

// http://stackoverflow.com/questions/6970221/parsing-css-background-image
var token = /((?:[^"']|".*?"|'.*?')*?)([(,)]|$)/g;
var splitCSS;

var whiteSpaceRe = /\s{2,}/g;

var _altMeasurementTerms = [
  'bag',
  'can'
];

var downloadImage;

var objectLiteral__ = underscorejs;
var objectLiteral_linefeed = process.platform === "win32" ? "\r\n" : "\n";

var objectLiteral_normalizelf = function(str) {
  return str.replace(/\r\n|\n/g, objectLiteral_linefeed);
};

var objectLiteral_remove = function(array, from, to) {
  var rest = array.slice((to || from) + 1 || array.length);
  array.length = from < 0 ? array.length + from : from;
  return array.push.apply(array, rest);
};

var objectLiteral_strcmp = function(str1, str2) {
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

var objectLiteral_calcPadding = function(num, minLen) {
  if (_.isNumber(num)) {
    num = num.toString();
  }
  var minLen = 2, padding = "", len = num.length;

  if (len > minLen) {
    minLen = len;
  }
  for (var i = 0; i < minLen; i++) {
    padding += "0";
  }
  return {
    len: -1 * minLen,
    padding: padding
  };
};

var objectLiteral_repeat = function(n, str) {
  return new Array(n + 1).join(str || " ");
};

var objectLiteral_substituteDegree = function(str) {
  if (!str) {
    return "";
  }
  return str.replace(degreeRe, function(str, p1, offset, s) {
    // '350 degree F for 30 minutes' -->
    // ["350 degree F", "350 ", 0, "350 degree F for 30 minutes"]
    //if (!p1) { console.log(arguments); exit(1);}
    return p1.trim() + "°F";
  });
};

var objectLiteral_substituteFraction = function(str) {
  if (!str) {
    return "";
  }
  var findFraction = function(str) {
    if (_fractions[str]) {
      return _fractions[str];
    } else {
      return str;
    }
  };
  return str.replace(fractionRe, function(str, p1, p2, offset, s) {
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

var objectLiteral_decodeFractions = function(str) {
  // Decode literal fractions
  for (var i in _fractions) {
    str = str.replace(new RegExp(_fractions[i], "g"), i);
  }

  return str;
};

var objectLiteral_writePlist = function(callback, obj, output) {
  var data = exportToPlist(obj);
  fs.writeFile(output, data, function(err) {
    if (err) {
      callback(err);
    }
    callback(null, "successfully saved file to " + output);
  });
};

var objectLiteral_expandHomeDir = function(dir) {
  dir = dir || "";
  if (dir.indexOf("~") === 0) {
    var home = process.env.HOME;
    var splits = dir.split("~");

    if (splits.length > 0) {
      dir = home + splits[1];
    } else {
      dir = home;
    }
  }
  return dir;
};

var objectLiteral_unescape = function(str) {
  str = str || "";
  var mapping = {
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": "\"",
    "&#x27;": "'",
    "&#x60;": "`",
    "&amp;": "&",
    "&frasl;": "/",
    "&mdash;": "—"
  };
  _.each(mapping, function(value, key) {
    var re;
    if (!unescapeRegexCache[key]) {
      re = new RegExp(key, "gi");
      unescapeRegexCache[key] = re;
    } else {
      re = unescapeRegexCache[key];
    }
    str = str.replace(re, value);
  });
  return str;
};

var objectLiteral_descSortByStr = function(obj, val, context) {
  // http://stackoverflow.com/questions/5013819/reverse-sort-order-with-backbone-js
  //
  // The Underscore.js method _.sortBy ends up "wrapping" up javascript
  // .sort() in a way that makes sorting strings in reverse difficult. Simple
  // negation of the string ends up returning NaN and breaks the sort.
  //
  // If you need to perform a reverse sort with Strings, such as reverse
  // alphabetical sort, here's a really hackish way of doing it:
  var iterator = _.isFunction(val) ? val : function(obj) {
    return obj[val];
  };
  return _.sortBy(obj, function(item) {
    var str = iterator.call(context, item);
    str = str.toLowerCase();
    str = str.split("");
    str = _.map(str, function(letter) {
      return String.fromCharCode(-letter.charCodeAt(0));
    });
    return str;
  });
};

var objectLiteral_rawtext = function(elem) {
  var text = "", child, children;

  if (_.isFunction(elem.children)) {
    children = elem[0].children;
  } else {
    children = elem.children;
  }

  if (children.length) {
    for (var x = 0, last = children.length; x < last; x++) {
      child = children[x];
      if (child.type === "text") {
        text += child.data;
      }
    }
  }
  return text;
};

var objectLiteral_text = function(elem) {
  var text = "", child, children;

  if (_.isFunction(elem.children)) {
    children = elem[0].children;
  } else {
    children = elem.children;
  }

  if (children.length) {
    for (var x = 0, last = children.length; x < last; x++) {
      child = children[x];
      if (child.type === "text") {
        text += child.data;
      } else if (child.name === "br") {
        text += objectLiteral_linefeed;
      }
    }
  }
  return entities.decode(text);
};

var objectLiteral_striptags = function(elem) {
  var text = "", child, children;

  if (_.isFunction(elem.children)) {
    //children = elem.children();
    children = elem[0].children;
  } else {
    children = elem.children;
  }

  if (children && children.length > 0) {
    for (var i = 0, l = children.length; i < l; i++) {
      child = children[i];
      if (child.type === "text") {
        text += child.data;
      } else if (child.type === "tag") {
        text += striptags(child);
      }
    }
  }
  return text;
};

var objectLiteral_fulltext = function(elem) {
  var text = "", child, children;

  if (_.isFunction(elem.children)) {
    //children = elem.children();
    children = elem[0].children;
  } else {
    children = elem.children;
  }

  if (children && children.length > 0) {
    for (var i = 0, l = children.length; i < l; i++) {
      child = children[i];
      if (child.type === "text") {
        text += child.data;
      } else if (child.name === "br") {
        text += objectLiteral_linefeed;
      } else if (child.type === "tag") {
        text += fulltext(child);
      }
    }
  }

  return entities.decode(text);
};

var objectLiteral_splitCSS = function(string) {
  var recurse = function(str) {
    for (var array = []; ; ) {
      var result = token.exec(string);
      if (result[2] === "(") {
        array.push(result[1].trim() + "(" + recurse(str).join(",") + ")");
        result = token.exec(string);
      } else {
        array.push(result[1].trim());
      }
      if (result[2] !== ",") {
        return array;
      }
    }
  };

  var retval = recurse(string);
  token.lastIndex = 0;
  return retval;
};

var objectLiteral_trimMultipleWhiteSpace = function(text) {
  return text.replace(whiteSpaceRe, " "); // replace extra spaces with one
};

var objectLiteral_regexIndexOf = function(str, regex, startpos) {
  var indexOf = str.substring(startpos || 0).search(regex);
  return indexOf >= 0 ? indexOf + (startpos || 0) : indexOf;
};

var objectLiteral_altMeasurementTerms = _.union(_altMeasurementTerms, _.map(_altMeasurementTerms, function(term) {
  return pluralize.plural(term);
})).sort();

var objectLiteral_saveIngredients = function(items, fileName) {
  var data = require(fileName);
  _.each(items, function(item) {
    _.each(objectLiteral_saveIngredients, function(ingredient) {
      data.push(ingredient);
    });
    fs.writeFileSync(fileName, "module.exports = " + JSON.stringify(data, null, 2) + ";");
  });
};

var objectLiteral_saveJustIngredients = function(ingredients, fileName, callback) {
  var data = require(fileName);
  _.each(ingredients, function(ingredient) {
    data.push(ingredient);
  });
  var data = "module.exports = " + JSON.stringify(data, null, 2) + ";";
  fs.writeFile(fileName, data, callback);
};

var objectLiteral_downloadImage = function(src, callback) {
  if (src.indexOf("//") === 0) {
    src = src.replace("//", "http://");
  }
  var oURL = URL.parse(src);
  var request = http.request({
    port: 80,
    host: oURL.hostname,
    method: "GET",
    path: oURL.pathname
  });

  request.end();
  request.on("response", function(response) {
    var type = response.headers["content-type"], prefix = "data:" + type + ";base64,", body = "";

    response.setEncoding("binary");
    response.on("end", function() {
      var base64 = new Buffer(body, "binary").toString("base64");
      callback(null, base64);
    });
    response.on("data", function(chunk) {
      if (response.statusCode === 200) {
        body += chunk;
      }
    });
  });
};

var objectLiteral_collateAllImages = function(items) {
  var images = [];
  _.each(items, function(item) {
    if (item.image && item.image.src) {
      images.push(item.image);
    }
    if (item.notes && item.notes.length) {
      _.each(item.notes, function(note) {
        if (note.image && note.image.src) {
          images.push(note.image);
        }
      });
    }
    if (item.procedures && item.procedures.length) {
      _.each(item.procedures, function(procedure) {
        if (procedure.image && procedure.image.src) {
          images.push(procedure.image);
        }
      });
    }
  });
  return images;
};

var objectLiteral_downloadAllImages = function(images, callback) {
  async.forEach(images, function(image, done) {
    if (image.src) {
      downloadImage(image.src, function(err, base64) {
        if (!err) {
          console.log("Downloaded: " + image.src);
        }
        image.data = base64;
        done();
      });
    } else {
      done();
    }
  }, callback);
};

var objectLiteral_savePlistToFile = function(obj) {
  var plistFile = objectLiteral_expandHomeDir("~/Desktop/recipe.mgourmet4");
  writePlist(function(err, obj) {
    if (err) {
      console.error(err);
    }
  }, [obj], plistFile);
};

export { objectLiteral__ as _, objectLiteral_linefeed as linefeed, objectLiteral_remove as remove, objectLiteral_repeat as repeat, objectLiteral_substituteDegree as substituteDegree, objectLiteral_substituteFraction as substituteFraction, objectLiteral_decodeFractions as decodeFractions, objectLiteral_writePlist as writePlist, objectLiteral_expandHomeDir as expandHomeDir, objectLiteral_unescape as unescape, objectLiteral_text as text, objectLiteral_fulltext as fulltext, objectLiteral_splitCSS as splitCSS, objectLiteral_trimMultipleWhiteSpace as trimMultipleWhiteSpace, objectLiteral_regexIndexOf as regexIndexOf, objectLiteral_altMeasurementTerms as altMeasurementTerms };

