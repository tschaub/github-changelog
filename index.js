'use strict';

require('./bootstrap');

var fs = require('fs');
var path = require('path');

var cli = require('./cli');
var args = cli.parse(process.argv);

var config = require(path.resolve(__dirname, args.config));
var template = fs.readFileSync(args.template, 'utf8');

var jira = require('./jira')(config.jira);

var github = require('./github')({token: args.token}, args.owner, args.repo);
var range = github.helper.range(args.since, args.until);
var pullRequests = range
      .getPullRequests
      .flatMap(github.helper.jira(jira).fetch);

var changelog = require('./changelog')(github.api);
changelog.build(
  {
    json: args.json,
    gist: args.gist,
    release: args.release
  },
  config,
  template,
  range.sinceDateStream,
  range.untilDateStream,
  pullRequests,
  args.data
);
