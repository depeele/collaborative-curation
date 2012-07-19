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

var db          = {
        id:             app.Database.id,
        description:    app.Database.description,
        migrations:     [{
            version:    1,
            migrate:    function(transaction, next) {
                var store   = transaction.db.createObjectStore( storeName );
                next();
            }
        } /*, {
            version:    2,
            migrate:    function(transaction, next) {
                var store;
                if (! transaction.db.objectStoreNames.contains( storeName ))
                {
                    store = transaction.db.createObjectStore( storeName );
                }
                store = transaction.objectStore( storeName );

                store.createIndex('titleIndex', 'title', {
                    unique: false
                });
                store.createIndex('formatIndex', 'format', {
                    unique: false
                });
                next();
            }
        }
        */
        ]
    };

app.Model.User  = Backbone.Model.extend({
    database:   db,
    storeName:  storeName,
    default:    {
        id:         null,
        name:       'anonymous',
        fullName:   'Anonymous',
        avatarUrl:  'images/avatar.jpg'
    }
});

app.Model.Users = Backbone.Collection.extend({
    database:   db,
    storeName:  storeName,
    model:      app.Model.User
});

}).call(this);
