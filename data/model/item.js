/** @file
 *
 *  A collected item and item collection.
 *
 *  Requires:
 *      app.js
 *      backbone.js
 *      model/database.js
 *      model/topic.js
 */
(function() {
var root        = this,
    app         = root.app,
    Backbone    = root.Backbone,
    storeName   = 'items';

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

                store.createIndex('srcUrlIndex', 'srcUrl', {unique: false});

                next();
            }
        }]
    };

app.Model.Item  = Backbone.Model.extend({
    database:   db,
    storeName:  storeName,
    default:    {
        id:         null,
        title:      null,   // Item title
        timestamp:  null,   // Time of collection
        content:    null,   // Collected content / html

        srcUrl:     null,   // URL of the source page
        srcTitle:   null,   // Title of the source page
        srcLocation:null,   // In-page location within the source page

        topicId:    null,   // Reference to the currently assigned Topic
        topicIndex: 0       // Sort order index within the Topic
    },

    /** @brief  Asynchronously retrieve the assigned topic.
     *  @param  options     Fetch options, including 'success' and 'error'
     *                      completion callbacks;
     */
    topic: function(options) {
        var self    = this,
            topic   = new app.Model.Topic({ id: self.get('topicId') });

        return topic.fetch( options );
    },

    /** @brief  Asynchronously retrieve all comments associated with this item.
     *  @param  options     Fetch options, including 'success' and 'error'
     *                      completion callbacks;
     */
    comments:  function(options) {
        options = options || {};

        var self        = this,
            success     = options.success,
            comments    = new app.Model.Comments();

        options.conditions = {
            itemId:     self.id
        };
        options.success = function(comments, resp) {
            // Order comments by the 'created' timestamp
            comments = comments.sortBy( 'created' );

            if (success)    { success(comments, resp); }
        };

        return comments.fetch( options );
    }
});

app.Model.Items = Backbone.Collection.extend({
    database:   db,
    storeName:  storeName,
    model:      app.Model.Item
});

}).call(this);