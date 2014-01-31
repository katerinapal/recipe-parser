// The module to be exported.
var main = module.exports = {};

// Expose internal libs.
function mRequire(name, file) {
  return main[name] = require('./lib/' + file);
}

main.option = {
  debug: false,
  verbose: false
};

var util = mRequire('util', 'util');
var log = mRequire('log', 'log');
var verbose = main.verbose = log.verbose;

// Expose some metadata.
main.package = require('./package.json');
main.version = main.package.version;
