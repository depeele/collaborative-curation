/** @file
 *
 *  A comment and comment collection.
 *
 *  Requires:
 *      app.js
 *      backbone.js
 *      model/item.js
 *      model/user.js
 */
(function() {
var root        = this,
    app         = root.app,
    Backbone    = root.Backbone,
    storeName   = 'comments';

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

app.Model.Comment  = Backbone.Model.extend({
    database:   db,
    storeName:  storeName,
    defaults:   {
        id:         null,
        text:       null,   // The comment text/html
        created:    null,   // Time of creation

        authorId:   null,   // The id of the author (Model.User)
        itemId:     null    // The id of the related item (Model.Item)
    },

    /** @brief  Asynchronously retrieve the author.
     *  @param  options     Fetch options, including 'success' and 'error'
     *                      completion callbacks;
     */
    author: function(options) {
        var self    = this,
            author  = new app.Model.User({ id: self.get('authorId') });

        return author.fetch( options );
    },

    /** @brief  Asynchronously retrieve the related Item.
     *  @param  options     Fetch options, including 'success' and 'error'
     *                      completion callbacks;
     */
    item: function(options) {
        var self    = this,
            item    = new app.Model.Item({ id: self.get('itemId') });

        return item.fetch( options );
    }
});

app.Model.Comments = Backbone.Collection.extend({
    database:   db,
    storeName:  storeName,
    model:      app.Model.Comment
});

}.call(this));
