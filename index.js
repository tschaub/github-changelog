#!/usr/bin/env node

// core modules
var fs = require('fs');
var path = require('path');

// 3rd party modules
var ejs = require('ejs');
var program = require('commander');
var not = require('not');

program
  .option('-o, --owner <name>', 'Repository owner name.  If not provided, ' +
          'the "username" option will be used.')
  .option('-r, --repo <repo>', 'Repository name (required).')
  .option('-u, --username <name>', 'Your GitHub username (only required ' +
          'for private repos).')
  .option('-p, --password <pass>', 'Your GitHub password (only required ' +
          'for private repos).')
  .option('-t, --token <token>', 'Your GitHub token (only required ' +
          'for private repos or if you want to bypass the Github API limit rate).')
  .option('-s, --since <iso-date>', 'Initial date or commit sha (required).')
  .option('--until <iso-date>', 'Limit date or commit sha.')
  .option('-t, --template <path>', 'EJS template to format data.' +
          'The default bundled template generates a list of issues in Markdown')
  .option('-g, --gist', 'Publish output to a Github gist.')
  .option('-d, --data <data>', 'Set arbitrary JSON data available in the template.')
  .option('-j, --json', 'Get output in JSON.')
  .parse(process.argv);

if (!program.repo) {
  program.help();
  process.exit(1);
}

if (!program.username && !program.owner && !program.token) {
  console.error('\nOne of "username" or "owner" or "token" options must be provided');
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
var createChangelog = ejs.compile(template);

var owner = program.owner || program.username;

var github = require('./github')(
  {
    token: program.token,
    username: program.username,
    password: program.password
  },
  owner,
  program.repo
);

var sinceDateStream = github.api.streamDateFromDateStringOrCommitId(program.since);
var untilDateStream = github.api.streamDateFromDateStringOrCommitId(program.until);

var params = Bacon
    .combineTemplate({ since: sinceDateStream, until: untilDateStream });

var commits = params
    .flatMap(github.api.retrieveCommits);

// If first commit is not a merge commit, go get its associated open Pull Request, if any.
var potentialOpenPullRequest = commits
    .first()
    .filter(not(github.api.commitIsMergedPullRequest))
    .flatMap(github.api.searchPullRequestByCommit);

// Get a stream of pull request ids, based on merged commits between since and until.
var closedPullRequests = commits
    .filter(github.api.commitIsMergedPullRequest)
    .flatMap(github.api.getPullRequestIdFromCommit)
    .flatMap(github.api.retrievePullRequestById)
;

var pullRequests = potentialOpenPullRequest.merge(closedPullRequests);

// // Get a stream providing the pull requests.
// var pullRequests = params
//   .flatMap(streamAllPullRequestsBetween);

// Generate changelog text.
var changelog = Bacon
    .combineTemplate({
      since: sinceDateStream,
      until: untilDateStream,
      pullRequests: pullRequests.reduce([], '.concat'),
      data: program.data ? JSON.parse(program.data) : {}
    })
    .map(createChangelog)
    .map(function(text) {
      return {
        text: text
      };
    });

// Generate a gist if specified.
if (program.gist) {
  changelog = changelog.flatMap(github.api.createGist);
}

// Generate a release if specified
if (program.release) {
  // @todo
}

changelog.onValue(function(result) {
  var output;
  if (program.json) {
    output = JSON.stringify(result);
  } else if (program.gist) {
    output = result.gist;
  } else {
    output = result.text;
  }

  console.log(output);
});
