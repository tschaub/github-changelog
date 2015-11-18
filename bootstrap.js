'use strict';

require('http').globalAgent.maxSockets = Infinity;

global.assert = require('assert');
global.when = require('when');
global._ = require('lodash');
global.Bacon = require('baconjs');
global.not = require('not');
