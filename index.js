#!/usr/bin/env node

require('./bootstrap');
var logger = require('winston');
var config = require('./config')(logger);

// core modules
var fs = require('fs');
var path = require('path');

// 3rd party modules
var program = require('commander');

program
  .option('-o, --owner <name>', 'Repository owner name.')
  .option('-r, --repo <repo>', 'Repository name (required).')
  .option('-t, --token <token>', 'Your GitHub token (only required ' +
          'for private repos or if you want to bypass the Github API limit rate).')
  .option('-s, --since <iso-date>', 'Initial date or commit sha (required).')
  .option('-u, --until <iso-date>', 'Limit date or commit sha.')
  .option('-p, --template <path>', 'EJS template to format data.' +
          'The default bundled template generates a list of issues in Markdown')
  .option('-g, --gist', 'Publish output to a Github gist.')
  .option('-d, --data <data>', 'Set arbitrary JSON data available in the template.')
  .option('-j, --json', 'Get output in JSON.')
  .parse(process.argv);

if (!program.repo) {
  console.error('\n"repo" options must be provided');
  program.help();
  process.exit(1);
}

if (!program.owner) {
  console.error('\n"owner" options must be provided');
  program.help();
  process.exit(1);
}

if (!program.token) {
  console.error('\n"token" options must be provided');
  program.help();
  process.exit(1);
}

if (!program.since) {
  console.error('\n"Since" option must be provided');
  program.help();
  process.exit(1);
}

var templatePath = program.template || path.join(__dirname, 'changelog.ejs');
var template = fs.readFileSync(templatePath, 'utf8');


var jira = require('./jira')(config.jira);

var github = require('./github')(
  {
    token: program.token
  },
  program.owner,
  program.repo
);

var changelog = require('./changelog')(github.api);

var range = github.helper.range(program.since, program.until);

var pullRequests = range
    .getPullRequests
    .flatMap(github.helper.jira(jira).fetch);

changelog.build(
  {
    json: program.json,
    gist: program.gist,
    release: program.release
  },
  template,
  range.sinceDateStream,
  range.untilDateStream,
  pullRequests,
  program.data
);
