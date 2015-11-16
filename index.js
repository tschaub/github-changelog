#!/usr/bin/env node

// core modules
var fs = require('fs');
var path = require('path');

// 3rd party modules
var Client = require('github');
var ejs = require('ejs');
var program = require('commander');
var Bacon = require('baconjs');

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
    .option('-m, --merged', 'List merged pull requests only.')
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

var github = new Client({version: '3.0.0'});

if (program.token) {
  github.authenticate({
    type: 'oauth',
    token: program.token
  });
}
else if (program.username && program.password) {
  github.authenticate({
    type: 'basic',
    username: program.username,
    password: program.password
  });
}

var owner = program.owner || program.username;

function isDate(value) {
  const date = new Date(value);
  return !isNaN(date.valueOf());
}

function transformCommitIdToDate(commitId) {
  var params = {
    user: owner,
    repo: program.repo,
    sha: commitId
  };

  return Bacon
    .fromNodeCallback(github.gitdata.getCommit, params)
    .flatMap(function(commit) {
      return {
        date: commit.author.date,
        commit: commit
      };
    });
}

function getPullRequestClosedSinceFilter(dateString) {
  return function(pullRequest) {
    return new Date(pullRequest.closed_at) > new Date(dateString);
  }
}

function getPullRequestClosedUntilFilter(dateString) {
  return function(pullRequest) {
    return new Date(pullRequest.closed_at) <= new Date(dateString);
  }
}

function paginator(pageStreamCallback, stopCondition) {
  var paginationNeeded = true;

  return Bacon.repeat(function(index) {
    if (!paginationNeeded) {
      return false;
    }

    return pageStreamCallback(index + 1)
      .doAction(function(item) {
        if (stopCondition(item)) {
          paginationNeeded = false;
        }
      });
  });
}

/**
 * @param {Object} params of type:
 * {
 *   since: '2015-09-07T10:16:41Z',
 *   until: '2015-09-10T12:50:09Z'
 * }
 */
function streamAllPullRequestsBetween(params) {

  function pageOfPullRequests(page) {
    var requestParams = {
      user: owner,
      repo: program.repo,
      base: 'master',
      state: 'closed',
      sort: 'updated',
      direction: 'desc',
      per_page: 50,
      page: page
    };

    return Bacon
      .fromNodeCallback(github.pullRequests.getAll, requestParams)
      .flatMap(Bacon.fromArray);
  }

  function stopWhenSinceIsReached(pullRequest) {
    return new Date(pullRequest.updated_at) < new Date(params.since.date);
  }

  var allPullRequests = paginator(pageOfPullRequests, stopWhenSinceIsReached)
    .filter(getPullRequestClosedSinceFilter(params.since.date));

  if (params.until) {
    allPullRequests = allPullRequests.filter(getPullRequestClosedUntilFilter(params.until.date));
  }

  return allPullRequests;
}


function retrieveCommits(params) {

  function pageOfCommits(page) {
    var requestParams = {
      user: owner,
      repo: program.repo,
      per_page: 50,
      page: page
    };

    if (params.until && params.until.commit) {
      requestParams.sha = params.until.commit.sha;
    }

    if (params.since && params.since.date) {
      requestParams.since = params.since.date;
    }

    return Bacon
      .fromNodeCallback(github.repos.getCommits, requestParams)
      .flatMap(Bacon.fromArray);
  }

  var stopWhenSinceIsReached;
  if (params.since.commit) {
    stopWhenSinceIsReached = function(commit) {
      return commit.sha === params.since.commit.sha;
    };
  }
  else {
    stopWhenSinceIsReached = function(commit) {
      return new Date(commit.commit.committer.date) < new Date(params.since.date);
    };
  }

  return paginator(pageOfCommits, stopWhenSinceIsReached);
}

function createGist(changelog) {
  var params = {
    description: 'Release note',
    public: false,
    files: {
      'release note.md': {
        content: changelog.text
      }
    }
  };

  changelog.gist = Bacon
    .fromNodeCallback(github.gists.create, params)
    .map('.html_url');

  return Bacon.combineTemplate(changelog);
}

/**
 * Get a stream providing a single string date,
 * the incoming parameter being either a date string or a commit sha.
 */
function streamDateFromDateStringOrCommitId(dateStringOrCommitId) {
  return Bacon
    .once(dateStringOrCommitId)
    .flatMap(function(value) {
      if (isDate(value)) {
        return {
          date: value
        };
      }
      if (value) {
        return transformCommitIdToDate(value);
      }
      return undefined;
    });
}

function pullRequestIsMerged(pullRequest) {
  return pullRequest.merged_at !== null;
}

function commitIsMergedPullRequest(commit) {
  return commit.parents.length > 1;
}

function getPullRequestIdFromCommit(commit) {
  var matches = /Merge pull request #(\d+) from/.exec(commit.commit.message);
  return matches ? matches[1] : null;
}

function retrievePullRequestById(pullRequestId) {
  var requestParams = {
    user: owner,
    repo: program.repo,
    number: pullRequestId
  };

  return Bacon
    .fromNodeCallback(github.pullRequests.get, requestParams);
}

var sinceDateStream = streamDateFromDateStringOrCommitId(program.since);
var untilDateStream = streamDateFromDateStringOrCommitId(program.until);

var params = Bacon
  .combineTemplate({ since: sinceDateStream, until: untilDateStream });

// Get a stream of pull request ids, based on merged commits between since and until.
var pullRequests = params
  .flatMap(retrieveCommits)
  .filter(commitIsMergedPullRequest)
  .flatMap(getPullRequestIdFromCommit)
  .flatMap(retrievePullRequestById)
  ;

// // Get a stream providing the pull requests.
// var pullRequests = params
//   .flatMap(streamAllPullRequestsBetween);
//
// // Keep only merged pull requests if specified.
// if (program.merged) {
//   pullRequests = pullRequests.filter(pullRequestIsMerged);
// }

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
  changelog = changelog.flatMap(createGist);
}

// Generate a release if specified
if (program.release) {
  // @todo
}

changelog.onValue(function(result) {
  var output;
  if (program.json) {
    output = JSON.stringify(result);
  }
  else if (program.gist) {
    output = result.gist;
  }
  else {
    output = result.text;
  }

  console.log(output);
});
