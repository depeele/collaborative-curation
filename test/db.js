/** @file
 *
 *  A simple mock-adapter for Backbone.
 *
 */
var Backbone    = require('backbone'),
    id          = 0;

Backbone.ajaxSync = Backbone.sync;
Backbone.sync     = function(method, model, options) {
    console.log("sync: %s %j %j", method, model, options);

    if (options.success)
    {
        if (! model.attributes.id)  { model.attributes.id = ++id; }
        options.success(model.attributes);
    }
};

/*
exports = {
    sync:       Backbone.sync,
    ajaxSync:   Backbone.ajaxSync
};
// */
