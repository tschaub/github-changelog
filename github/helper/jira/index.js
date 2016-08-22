'use strict';

module.exports = function(jira) {
  var parseTicketKeyFromTitle = function(string) {
    var matches = /^([A-Z]+-\d+)/.exec(string);

    if (matches === null) {
      return null;
    }

    return matches.length > 0 ? matches[0] : null;
  };

  var fetch = function(commit) {
    var key = parseTicketKeyFromTitle(commit.title);

    if (key !== null) {
      return Bacon.
        fromPromise(
          jira
            .api
            .findIssue(key)
            .then(function (issue) {
              commit.jira = issue;

              return commit;
            })
            .catch(function (error) {
              console.error('[Jira] API Error : ' + error);
              commit.jira = null;

              return commit;
            })
        );
    } else {
      commit.jira = null;

      return Bacon.fromPromise(when.resolve(commit));
    }
  };

  return {
    fetch: fetch
  };
};
