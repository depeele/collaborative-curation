/** @file
 *
 *  Define the sidebar-content app context.
 */
(function() {
var root   = this;
    app    = {
        View:       {},
        Model:      {},
        Database:   {},

        /** @brief  Initialize the database (override in database.js) */
        Database_init:  function()  {},

        /** @brief  The item currently being dragged
         *              (if initiated by a view in *this* app).
         */
        dragging:   null
    };

/** @brief  Called when the content document is ready for use.
 */
app.ready = function() {
    //console.log("app.js: Ready.");

    // Initialize our database connection
    app.Database_init();

    // Establish our primary view
    var $curation   = $('#collaborative-curation'),
        view        = new app.View.TopicsView({el: $curation});

    // Generate / Retrieve topic data
    console.log("app: Ready -- retrieve topics...");
    try {
    var topics  = new app.Model.Topics();
    topics.fetch({
        success: function(topics, response) {
            console.log("app: Retrieved %d topics", topics.length);
            view.setModel( topics );
        },
        error:   function(topics, response) {
            console.log("app: Fetch ERROR: %s", response);
        }
    });
    } catch(e) {
        console.log("app: Fetch exception: %s", e.message);
    }

    /* Generate pseudo topic data
    var now     = new Date(),
        topics  = [
            {"id":"topic-1",
             "order":0,
             "title":"Development",
             "items":   [
                {"id":"item-1",
                 "timestamp":1341225011904,
                 "content":"<a href='https://developer.mozilla.org/en-US/'>Mozilla Developer</a>",
                 "url":"https://developer.mozilla.org/en-US/",
                 "location":"",
                 "selector":"",
                 "topicId":"topic-1",
                 "order":0,
                 "comments":[]},
                {"id":"item-2",
                 "timestamp":1341225011904,
                 "content":"<a href='https://developer.mozilla.org/en/JavaScript/Reference'>Javascript</a>",
                 "url":"https://developer.mozilla.org/en/JavaScript/Reference",
                 "location":"",
                 "selector":"",
                 "topicId":"topic-1",
                 "order":1,
                 "comments":[]},
                {"id":"item-3",
                 "timestamp":1341226022904,
                 "content":"Other object in the global scope are either created by the user script or provided by the host application",
                 "url":"https://developer.mozilla.org/en/JavaScript/Reference",
                 "location":"#section_2",
                 "selector":"> p:first",
                 "topicId":"topic-1",
                 "order":2,
                 "comments":[]},
                {"id":"item-4",
                 "timestamp":1341228022904,
                 "content":"Operator precedence defines the order in which operators are evaluated.",
                 "url":"https://developer.mozilla.org/en/JavaScript/Reference",
                 "location":"#section_5",
                 "selector":"> dl > dd.8",
                 "topicId":"topic-1",
                 "order":3,
                 "comments":[]},
                {"id":"item-5",
                 "timestamp":1341225011904,
                 "content":"<a href='http://api.jquery.com/'>jQuery</a>",
                 "url":"http://api.jquery.com/",
                 "location":"",
                 "selector":"",
                 "topicId":"topic-1",
                 "order":4,
                 "comments":[]},
                {"id":"item-6",
                 "timestamp":1341225011904,
                 "content":"<a href='http://documentcloud.github.com/backbone/#'>Backbone</a>",
                 "url":"http://documentcloud.github.com/backbone/",
                 "location":"#",
                 "selector":"",
                 "topicId":"topic-1",
                 "order":5,
                 "comments":[]},
                {"id":"item-7",
                 "timestamp":1341225011904,
                 "content":"<a href='http://documentcloud.github.com/underscore/#'>Underscore</a>",
                 "url":"http://documentcloud.github.com/underscore/",
                 "location":"#",
                 "selector":"",
                 "topicId":"topic-1",
                 "order":6,
                 "comments":[]},
                {"id":"item-8",
                 "timestamp":1341225011904,
                 "content":"<a href='http://nodejs.org/api/'>node.js</a>",
                 "url":"http://nodejs.org/api/",
                 "location":"",
                 "selector":"",
                 "topicId":"topic-1",
                 "order":7,
                 "comments":[]}
             ]
            },
            {"id":"topic-2",
             "order":1,
             "title":"Misc",
             "items":   [
                {"id":"item-9",
                 "timestamp":1341225011904,
                 "content":"<a href='https://google.com/'>google</a>",
                 "url":"https://google.com/",
                 "location":"",
                 "selector":"",
                 "topicId":"topic-2",
                 "order":0,
                 "comments":[]}
             ]
            }
        ];

    console.log("app: app.View.TopicsView() with %d topics", topics.length);
    view.setModel( topics );
    // */
};

/****************************************************************************
 * Date Formatting utilities {
 *
 *  Called from the '#curation-topic' template applied in render().
 *  The template itself is defined in data/view/topics/index.html
 *
 */
function padNum(num, len)
{
    len = len || 2;
    num = ''+ num;

    return '00000000'.substr(0, len - num.length) + num;
}

// app-level utilities
app.ts2timeStr = function(ts) {
    var date        = new Date(ts),
        hour        = date.getHours(),
        meridian    = 'a';

    if      (hour >   12)   { meridian = 'p'; hour -= 12; }
    else if (hour === 12)   { meridian = 'p'; }

    return hour +':'+ padNum(date.getMinutes()) + meridian;
};
app.ts2dateStr = function(ts) {
    var date    = new Date(ts),
        dateStr = date.getFullYear()            +'.'
                + padNum(date.getMonth() + 1)   +'.'
                + padNum(date.getDate());

    return dateStr;
};
/* Date formatting utilities }
 ****************************************************************************/

// Allow use with CommonJS / node.js {
if (typeof exports !== 'undefined')
{
    if (typeof module !== 'undefined' && module.exports)
    {
        exports = module.exports;
    }
    exports.app = app;
}
else
// Allow use in with CommonJS /.js }
{
    // Simiply attach to the incoming 'root', most likely window.
    root.app = app;
}

}.call(this));
