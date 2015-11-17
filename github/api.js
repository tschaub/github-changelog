'use strict';

var Client = require('github');

module.exports = function(credentials, owner, repo) {
  var github = new Client({version: '3.0.0'});

  if (credentials.token) {
    github.authenticate({
      type: 'oauth',
      token: credentials.token
    });
  } else if (credentials.username && credentials.password) {
    github.authenticate({
      type: 'basic',
      username: credentials.username,
      password: credentials.password
    });
  } else {
    throw new Exception('No credentials given for github');
  }

  function isDate(value) {
    var date = new Date(value);
    return !isNaN(date.valueOf());
  }

  function transformCommitIdToDate(commitId) {
    var params = {
      user: owner,
      repo: repo,
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
    };
  }

  function getPullRequestClosedUntilFilter(dateString) {
    return function(pullRequest) {
      return new Date(pullRequest.closed_at) <= new Date(dateString);
    };
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
        repo: repo,
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
    } else {
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

  function commitIsPullRequestMergeCommit(commit) {
    return commit.parents.length > 1;
  }

  function getPullRequestIdFromCommit(commit) {
    var matches = /Merge pull request #(\d+) from/.exec(commit.commit.message);
    return matches ? matches[1] : null;
  }

  function retrievePullRequestById(pullRequestId) {
    var requestParams = {
      user: owner,
      repo: repo,
      number: pullRequestId
    };

    return Bacon
      .fromNodeCallback(github.pullRequests.get, requestParams);
  }

  function commitIsMergedPullRequest(commit) {
    return commit.parents.length > 1;
  }

  function searchPullRequestByCommit(commit) {
    return Bacon
      .fromNodeCallback(github.search.issues, {q: commit.sha})
      .flatMap(function(search) {
        return search.items && search.items.length ? search.items[0] : undefined;
      });
  }

  return {
    streamDateFromDateStringOrCommitId: streamDateFromDateStringOrCommitId,
    createGist: createGist,
    retrieveCommits: retrieveCommits,
    getPullRequestIdFromCommit: getPullRequestIdFromCommit,
    retrievePullRequestById: retrievePullRequestById,
    commitIsPullRequestMergeCommit: commitIsPullRequestMergeCommit,
    searchPullRequestByCommit: searchPullRequestByCommit,
    commitIsMergedPullRequest: commitIsMergedPullRequest
  };
};
