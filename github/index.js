'use strict';

module.exports = function(config, credentials, owner, repo) {
  var api = require('./api')(config, credentials, owner, repo);
  var helper = require('./helper')(api);

  return {
    api: api,
    helper: helper
  };
};
