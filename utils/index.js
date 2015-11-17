'use strict';

module.exports = {
  parseTicketKeyFromTitle: function(string) {
    var matches = /^([A-Z]{3}-\d+)/.exec(string);

    if (matches === null) {
      return null;
    }

    return matches.length > 0 ? matches[0] : null;
  }
};
