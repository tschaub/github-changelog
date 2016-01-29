'use strict';

module.exports = function(config) {
  return {
    api: require('./api')(config)
  };
};
