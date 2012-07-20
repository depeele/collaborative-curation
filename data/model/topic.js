/** @file
 *
 *  A topic and topic collection.
 *
 *  Requires:
 *      app.js
 *      backbone.js
 *      model/database.js
 *      model/item.js
 */
(function() {
var root        = this,
    app         = root.app,
    Backbone    = root.Backbone,
    storeName   = 'topics';

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

                store.createIndex('nameIndex', 'name', {unique: false});

                next();
            }
        }]
    };

app.Model.Topic  = Backbone.Model.extend({
    database:   db,
    storeName:  storeName,
    defaults:   {
        id:         null,
        name:       'Topic'
    },

    /** @brief  Asynchronously retrieve all items associated with this topic.
     *  @param  options     Fetch options, including 'success' and 'error'
     *                      completion callbacks;
     */
    items:  function(options) {
        options = options || {};

        var self    = this,
            success = options.success,
            items   = new app.Model.Items();

        options.conditions = {
            topicId:    self.id
        };
        options.success = function(items, resp) {
            // Order 'items' according to 'topicIndex'
            items = items.sortBy( 'topicIndex' );

            if (success)    { success(items, resp); }
        };

        return items.fetch( options );
    }
});

app.Model.Topics = Backbone.Collection.extend({
    database:   db,
    storeName:  storeName,
    model:      app.Model.Topic
});

}).call(this);
