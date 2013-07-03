#!/usr/bin/env node

// core modules
var fs = require('fs');
var path = require('path');

// 3rd party modules
var Client = require('github');
var async = require('async');
var handlebars = require('handlebars');
var program = require('commander');
var temp = require('temp');

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
    .option('-e, --header <header>', 'Header text.  Default is "Changes ' +
        'since <since>".')
    .option('-t, --template <template>', 'Handlebar template to format data')
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

github.issues.repoIssues({
  user: owner,
  repo: program.repo,
  state: 'closed',
  sort: 'created',
  since: since,
  per_page: 100
}, function(err, data) {
  if (err) {
    console.log('\nGitHub API error');
    console.error(err.message);
    process.exit(1);
  }
  var text = changelog({
    header: header,
    issues: data
  });

  if (program.file) {
    prepend(program.file, text, function(err) {
      if (err) {
        console.error(err.message);
        process.exit(1);
      }
      process.exit(0);
    });
  } else {
    console.log(text);
    process.exit(0);
  }
});

function prepend(file, text, done) {
  var path;
  async.waterfall([
    function(cb) {
      temp.open('gh-changelog', cb);
    },
    function(info, cb) {
      path = info.path;
      fs.writeFile(path, text, cb);
    },
    function(cb) {
      fs.readFile(program.file, cb);
    },
    function(data, cb) {
      fs.appendFile(path, data, cb);
    },
    function(cb) {
      fs.readFile(path, cb);
    },
    function(data, cb) {
      fs.writeFile(program.file, data, cb);
    }
  ], done);
}
