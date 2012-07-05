exports.main    = function(options) {
    const   ss          = require('simple-storage'),
            tabs        = require('tabs'),
            winUtils    = require('window-utils'),
            data        = require('self').data,
            tbb         = require('toolbarbutton'),
            sidebar     = require('sidebar');

    var self        = this,
        delegate, tracker;

    /* Create our toolbar button
    var toolbarButton = tbb.ToolbarButton({
        id:                 'curation-toolbarbutton',
        label:              'Curation',
        title:              'Collaborative Curation',
        alwaysShowLabel:    false,
        image:              data.url('images/toolbar-icon.png'),
        onCommand:          function() {
            // See if we have a sidebar for the active window
            var sb  = sidebar.get();
            if (! sb)
            {
                console.log("*** No sidebar yet attached to window");
                return;
            }

            sb.toggle();
        }
    });
    // */

    /* A window tracker to attach/detach the curation sidebar to/from windows
     * when they are created/destroyed.
     */
    delegate = {
        onTrack: function(window) {
            // Attach a curation sidebar to this window
            console.log("Tracking window: ", window.location);

            var sb  = sidebar.get(window);
            if (sb) { return; }

            // Attach a curation sidebar to this window
            sb = sidebar.add({
                window:             window,
                id:                 'curation-sidebar',
                //exclude:            [ 'title' ],
                title:              'curation collection',
                contentURL:         data.url('view/topics/index.html'),
                //contentScriptWhen:  'load',
                contentScriptFile:  [
                    data.url('js/jquery.min.js'),
                    data.url('js/underscore.min.js'),
                    data.url('js/backbone.min.js'),
                    data.url('js/backbone-indexeddb.js'),
                    data.url('model/database.js'),
                    data.url('model/user.js'),
                    data.url('model/topic.js'),
                    data.url('model/item.js'),
                    data.url('model/comment.js'),
                    data.url('view/topics/topics-sidebar.js')
                ],
                onMessage:  function(message) {
                    sbMessage.call(this, message);
                }
            });
        },
        onUntrack: function(window) {
            console.log("Untracking window: ", window.location);

            var sb  = sidebar.get(window);
            if (! sb)   { return; }

            // Detach the curation sidebar from this window
            sb.destroy();
        }
    };

    tracker = new winUtils.WindowTracker(delegate);

    if (! ss.collaborativeCuration)
    {
        ss.collaborativeCuration = {};

        /* On first load, force the toolbar button onto the nav-bar
        toolbarButton.moveTo({
            toolbarID:  'nav-bar',
            forceMove:  true
        });
        // */
    }

    // Watch for new tabs to load
    tabs.on('ready', function(tab) {
        console.log("onDOMContentLoaded: "+ tab.url);
    });

    /** @brief  The sidebar message handler.
     *  @param  message     The incoming message;
     *
     *  'this' is the triggering Sidebar instance.
     */
    function sbMessage(message)
    {
        console.log("sbMessage: message[", JSON.stringify(message), "]");
        var name    = message.name;
        if (name !== 'sidebar') { return; }

        switch (message.action)
        {
        case 'loaded':
            var now = new Date();

            try {
            this.postMessage({
                name:   'sidebar',
                action: 'load',
                topics: [
                    {topic: 'Development',
                     items:  [
                        {url:       'https://developer.mozilla.org/en-US/',
                         title:     'Mozilla Developer',
                         timestamp: now.getTime(),
                         content:   '',
                         comments:  []},
                        {url:       'https://developer.mozilla.org/en/JavaScript/Reference',
                         title:     'Javascript',
                         timestamp: now.getTime(),
                         content:   'Nice, exhaustive reference from Mozilla.',
                         comments:  []},
                        {url:       'http://api.jquery.com/',
                         title:     'jQuery',
                         timestamp: now.getTime(),
                         content:   '',
                         comments:  []},
                        {url:       'http://documentcloud.github.com/backbone/#',
                         title:     'Backbone',
                         timestamp: now.getTime(),
                         content:   '',
                         comments:  []},
                        {url:       'http://documentcloud.github.com/underscore/#',
                         title:     'Underscore',
                         timestamp: now.getTime(),
                         content:   '',
                         comments:  []},
                        {url:       'http://nodejs.org/api/',
                         title:     'node.js',
                         timestamp: now.getTime(),
                         content:   '',
                         comments:  []},
                     ]},
                ]
            });
            } catch(e) {
                console.log("main:postMessage FAILED: ", e.message);
            }
            break;

        case 'visit':
            /******************************************************
             * Visit the provided URL.
             *
             * If the URL is already loaded in an existing tab,
             * switch to the tab.
             *
             * Otherwise, open the URL in a new tab.
             *
             */
            var needNew = true;
            for each (var tab in tabs)
            {
                if (tab.url == message.url)
                {
                    // Switch to this tab
                    needNew = false;
                    tab.activate();
                    break;
                }
            }

            if (needNew)
            {
                // Open in a new tab
                tabs.open( message.url );
            }
            break;

        }
    }
};

