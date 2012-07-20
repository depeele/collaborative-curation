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

// Include topic-specific data migrations
app.Database.migrations.push({
    version:    1,
    migrate:    function(transaction, next) {
        var store;
        try {
            var store   = transaction.db.createObjectStore( storeName );
            console.log("Model.Item:migrate(): created '%s'", storeName);

            //store.createIndex('nameIndex', 'name', {unique: false});
            //console.log("Model.Item:migrate(): created 'nameIndex'");
        } catch(e) {
            console.log("Model.Item:migrate(): FAILED to create '%s': %s",
                        storeName, e.message);
        }

        next();
    }
});

app.Model.Topic  = Backbone.Model.extend({
    database:   app.Database,
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
            error   = options.error,
            items   = new app.Model.Items();

        options.conditions = {
            topicId:    self.id
        };
        options.success = function(items, resp) {
            // Order 'items' according to 'topicIndex'
            items = items.sortBy( 'topicIndex' );

            console.log("Model.Topic:items(): fetched %d items[ %j ]",
                        items.length, items);

            if (success)    { success(items, resp); }
        };
        options.error = function(items, resp) {
            console.log("Model.Topic:items(): error in fetch: %j", resp);

            if (error)      { error(items, resp); }
        };

        // Attempt the fetch
        try {
            items.fetch( options );
        } catch(e) {
            options.error(null, e.message);

            //console.log("Model.Topic:items(): FAILED %s", e.message);
        }

        return self;
    }
});

app.Model.Topics = Backbone.Collection.extend({
    database:   app.Database,
    storeName:  storeName,
    model:      app.Model.Topic
});

}).call(this);
