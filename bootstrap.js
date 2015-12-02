'use strict';

// Bypass Node by-default output HTTP requests limitation.
require('http').globalAgent.maxSockets = Infinity;

global.assert = require('assert');
global.when = require('when');
global._ = require('lodash');
global.Bacon = require('baconjs');
global.not = require('not');
