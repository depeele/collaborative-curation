/** @file
 *
 *  A user and user collection.
 *
 *  Requires:
 *      app.js
 *      backbone.js
 *      model/database.js
 */
(function() {
var root        = this,
    app         = root.app,
    Backbone    = root.Backbone,
    storeName   = 'users';

// Allow use with CommonJS / node.js {
if (typeof require !== 'undefined')
{
    if (! app)      { app      = require('../app').app;}
    if (! Backbone) { Backbone = require('backbone');}
}
// Allow use in with CommonJS /.js }

// Include user-specific data migrations
app.Database.migrations.push({
    version:    1,
    migrate:    function(transaction, next) {
        try {
            transaction.db.createObjectStore( storeName );
        } catch(e) {
            console.log("Model.User:migrate(): FAILED to create '%s': %s",
                        storeName, e.message);
        }

        next();
    }
});

app.Model.User  = Backbone.Model.extend({
    database:   app.Database,
    storeName:  storeName,
    defaults:   {
        id:         null,
        name:       'anonymous',
        fullName:   'Anonymous',
        avatarUrl:  'images/avatar.jpg'
    }
});

app.Model.Users = Backbone.Collection.extend({
    database:   app.Database,
    storeName:  storeName,
    model:      app.Model.User
});

}).call(this);
