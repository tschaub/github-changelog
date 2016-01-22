'use strict';

var ejs = require('ejs');

module.exports = function(api) {
  function build(args, config, template, since, until, pullRequests, data) {
    var createChangelog = ejs.compile(template);

    // Generate changelog text.
    var changelog = Bacon
        .combineTemplate({
          since: since,
          until: until,
          config: config,
          pullRequests: pullRequests.reduce([], '.concat'),
          data: data ? JSON.parse(data) : {}
        })
        .map(createChangelog)
        .map(function(text) {
          return {
            text: text
          };
        });

    // Generate a gist if specified.
    if (args.gist) {
      changelog = changelog.flatMap(api.createGist);
    }

    // Generate a release if specified
    if (args.release) {
      // @todo
    }

    changelog.onValue(function(result) {
      var output;
      if (args.json) {
        output = JSON.stringify(result);
      } else if (args.gist) {
        output = result.gist;
      } else {
        output = result.text;
      }

      console.log(output);

      process.exit();
    });
  }

  return {
    build: build
  };
};
