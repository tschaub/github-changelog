'use strict';

module.exports = function(api) {
  return {
    range: require('./range')(api)
  };
};
