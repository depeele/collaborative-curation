/** @file
 *
 *  The connection between our Backbone models and Database
 *
 */
(function() {
var root        = this,
    Database    = {
        id:             'collaborative-curation',
        description:    'The database for collaborative curation.'
    };

if (exports)    { exports.Database = Database; }
else            { root.Database    = Database; }

}).call(this);
