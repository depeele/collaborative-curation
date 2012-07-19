/** @file
 *
 *  A simple mock-adapter for Backbone.
 *
 */
var Backbone    = require('backbone');

Backbone.ajaxSync = Backbone.sync;
Backbone.sync     = function(method, model, options) {
    console.log("sync: %s %j %j", method, model, options);
};

/*
exports = {
    sync:       Backbone.sync,
    ajaxSync:   Backbone.ajaxSync
};
// */
