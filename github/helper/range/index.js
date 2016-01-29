'use strict';

module.exports = function(api) {
  return function(since, until) {
    var sinceDateStream = api.streamDateFromDateStringOrCommitId(since);
    var untilDateStream = api.streamDateFromDateStringOrCommitId(until);

    var params = Bacon
        .combineTemplate({ since: sinceDateStream, until: untilDateStream });

    var commits = params
        .flatMap(api.retrieveCommits);

    // If first commit is not a merge commit, go get its associated open Pull Request, if any.
    var potentialOpenPullRequest = commits
        .first()
        .filter(not(api.commitIsMergedPullRequest))
        .flatMap(api.searchPullRequestByCommit);

    // Get a stream of pull request ids, based on merged commits between since and until.
    var closedPullRequests = commits
        .filter(api.commitIsMergedPullRequest)
        .flatMap(api.getPullRequestIdFromCommit)
        .flatMap(api.retrievePullRequestById)
    ;

    var getPullRequests = potentialOpenPullRequest.merge(closedPullRequests);

    return {
      sinceDateStream: sinceDateStream,
      untilDateStream: untilDateStream,
      getPullRequests: getPullRequests
    };
  };
};
