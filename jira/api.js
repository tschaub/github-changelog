'use strict';

var Api = require('jira').JiraApi;

module.exports = function(config) {
  var api = new Api(
    config.apiProtocol,
    config.host,
    config.port,
    config.username,
    config.password,
    config.apiVersion,
    config.verbose,
    config.strictSSL
  );

  var findIssue = function(id) {
    return when.promise(function(resolve, reject) {
      api.findIssue(id, function(error, issue) {
        if (!error) {
          resolve({
            key: issue.key,
            summary: issue.fields.summary,
            type: {
              name: issue.fields.issuetype.name,
              iconUrl: issue.fields.issuetype.iconUrl
            }
          });
        } else {
          reject(error);
        }
      });
    });
  };

  return {
    findIssue: findIssue
  };
};
