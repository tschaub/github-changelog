'use strict';

module.exports = function(config, credentials, owner, repo) {
  return {
    api: require('./api')(config, credentials, owner, repo)
  };
};
