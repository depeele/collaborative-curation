var $           = window.$ || unsafeWindow.$,
    proxy       = self;
    mainView    = null;

// Ensure that Backbone has a proper reference to jQuery
Backbone.setDomLibrary($);

/** @brief  A Backbone View for Topics
 */
var TopicsView  = Backbone.View.extend({
    templates:  {
        topic:  '#curation-topic'
    },

    /** @brief  Initialize a new instances.
     */
    initialize: function() {
        var self    = this;

        // Resolve templates
        _.each(self.templates, function(selector, key) {
            var html    = $(selector).html();
            try {
                self.templates[key] = _.template( html );
            } catch(e) {
                console.log("Template '", key, "' error:", e.message,
                            ", html[", html, "]");
            }
        });
    },

    /** @brief  Render the given set of topics.
     *  @param  topics  An array of Topic records, each of the form:
     *                      {topic: topic,
     *                       items: []}
     *
     *                  Each item has the form:
     *                      {url:       url,
     *                       title:     title,
     *                       timestamp: timestamp,
     *                       content:   content,
     *                       comments:  [ comments ] or commentCount
     *                      }
     */
    render: function(topics) {
        var self        = this;
    
        self.$el.empty();
        topics.forEach(function(topic) {
            var html    = self.templates.topic(topic);
            self.$el.append( html );
        });

        return self;
    }
});

/** @brief  Handle a postMessage()
 *  @param  msg     The message data:
 *                      {action: *action*, action-secific-data}
 *                          Valid actions:
 *                              'load', topics:[]
 */
proxy.on('message', function(msg) {

    console.log("js/topics-sidebar.js: message ", JSON.stringify(msg));

    switch (msg.action)
    {
    case 'load':

        if (mainView)
        {
            mainView.render(msg.topics);
        }
        break;
    }
});

$(document).ready(function() {
    //console.log("js/topics-sidebar.js: Document Ready.");

    // Establish our mainView
    var $topics = $('#curation-topics');

    mainView = new TopicsView({el: $topics});

    $topics.data('view', mainView);

    // Post that we're ready
    proxy.postMessage({
        name:   'sidebar',
        action: 'loaded',
        url:    'js/topics-sidebar.js'
    });
});

//console.log("js/topics-sidebar.js loaded");
