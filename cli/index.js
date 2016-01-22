'use strict';

var path = require('path');
var program = require('commander');
var fs = require('fs');

program
  .option('-o, --owner <name>', 'Repository owner name (required).')
  .option('-r, --repo <repo>', 'Repository name (required).')
  .option('-t, --token <token>', 'Your GitHub token (required).')
  .option('-s, --since <iso-date-or-sha>', 'Initial date or commit sha (required).')
  .option('-u, --until <iso-date-or-sha>', 'Limit date or commit sha.')
  .option('-p, --template <path>', 'EJS template to format data.' +
          'The default bundled template generates a list of issues in Markdown')
  .option('-g, --gist', 'Publish output to a Github gist.')
  .option('-d, --data <data>', 'Set arbitrary JSON data available in the template.')
  .option('-j, --json', 'Get output in JSON.');

var checkOptions = function(options) {
  _.forEach(options, function(value, key) {
    if (!value) {
      console.error('\n"%s" options must be provided', key);
      program.help();
      process.exit(1);
    }
  });
};

var parse = function(argv) {
  var args = program.parse(argv);

  checkOptions({
    repo: args.repo,
    owner: args.owner,
    token: args.token,
    since: args.since
  });

  args.template = args.template || path.join(__dirname, '../changelog.ejs');

  if (!fs.existsSync(args.template)) {
    console.error('\n"template" options is not an existing filename');
    program.help();
    process.exit(1);
  }

  return args;
};

module.exports = {
  parse: parse
};
