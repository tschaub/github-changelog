#!/usr/bin/env node

// core modules
var fs = require('fs');
var path = require('path');

// 3rd party modules
var Client = require('github');
var async = require('async');
var handlebars = require('handlebars');
var program = require('commander');

program
    .option('-o, --owner <name>', 'Repository owner name.  If not provided, ' +
        'the "username" option will be used.')
    .option('-r, --repo <repo>', 'Repository name (required).')
    .option('-u, --username <name>', 'Your GitHub username (only required ' +
        'for private repos).')
    .option('-p, --password <pass>', 'Your GitHub password (only required ' +
        'for private repos).')
    .option('-f, --file <filename>', 'Output file.  If the file exists, ' +
        'log will be prepended to it.  Default is to write to stdout.')
    .option('-s, --since <iso-date>', 'Last changelog date.  If the "file" ' +
        'option is used and "since" is not provided, the mtime of the output ' +
        'file will be used.')
    .option('-m, --merged', 'List merged pull requests only.')
    .option('-e, --header <header>', 'Header text.  Default is "Changes ' +
        'since <since>".')
    .option('-t, --template <path>', 'Handlebar template to format data.' +
        'The default bundled template generates a list of issues in Markdown')
    .parse(process.argv);

if (!program.repo) {
  program.help();
  process.exit(1);
}

if (!program.username && !program.owner) {
  console.error('\nOne of "username" or "owner" options must be provided');
  program.help();
  process.exit(1);
}

if (!(program.since || program.file)) {
  console.error('\nOne of "since" or "file" options must be provided');
  program.help();
  process.exit(1);
}

if (program.file && !fs.existsSync(program.file)) {
  console.error('\nFile not found: %s', program.file);
  program.help();
  process.exit(1);
}

var templatePath = program.template || path.join(__dirname, 'changelog.hbs');
var template = fs.readFileSync(templatePath, 'utf8');
var changelog = handlebars.compile(template, {noEscape: true});


var since = program.since || fs.statSync(program.file).mtime.toISOString();
var header = program.header || 'Changes since ' + since;
var owner = program.owner || program.username;

var github = new Client({version: '3.0.0'});

if (program.username && program.password) {
  github.authenticate({
    type: 'basic',
    username: program.username,
    password: program.password
  });
}

function fetchIssues(callback) {
  var page = 1;
  var limit = 100;
  var issues = [];
  function fetch() {
    github.issues.repoIssues({
      user: owner,
      repo: program.repo,
      state: 'closed',
      sort: 'created',
      since: since,
      per_page: limit,
      page: page
    }, function(err, batch) {
      if (err) {
        return callback(err);
      }
      issues = issues.concat(batch);
      if (batch.length === limit) {
        ++page;
        fetch();
      } else {
        callback(null, issues);
      }
    });
  }
  fetch();
}

function filterIssues(issues, callback) {
  if (!program.merged) {
    process.nextTick(function() {
      callback(null, issues);
    });
  } else {
    async.filter(issues, function(issue, isMerged) {
      github.pullRequests.getMerged({
        user: owner,
        repo: program.repo,
        number: issue.number
      }, function(err, result) {
        isMerged(!err);
      });
    }, function(filtered) {
      callback(null, filtered);
    });
  }
}

function formatChangelog(issues, callback) {
  process.nextTick(function() {
    callback(null, changelog({header: header, issues: issues}));
  });
}

function writeChangelog(text, callback) {
  if (program.file) {
    var existing;
    async.waterfall([
      function(next) {
        fs.readFile(program.file, next);
      }, function(data, next) {
        existing = data;
        fs.writeFile(program.file, text, next);
      }, function(next) {
        fs.appendFile(program.file, existing, next);
      }
    ], callback);
  } else {
    process.nextTick(function() {
      console.log(text);
      callback(null);
    });
  }
}

async.waterfall([
  fetchIssues,
  filterIssues,
  formatChangelog,
  writeChangelog
], function(err) {
  if (err) {
    console.error(err.message);
    process.exit(1);
  } else {
    process.exit(0);
  }
});
