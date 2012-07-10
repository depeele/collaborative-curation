exports.main    = function(options) {
    const   URI_BROWSER = 'chrome://browser/content/browser.xul',
            ss          = require('simple-storage'),
            tabs        = require('tabs'),
            winUtils    = require('window-utils'),
            data        = require('self').data,
            tbb         = require('toolbarbutton'),
            sidebar     = require('sidebar');

    var self        = this;

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

    if (! ss.collaborativeCuration)
    {
        // First load -- create our property store
        ss.collaborativeCuration = {};

        /* On first load, force the toolbar button onto the nav-bar
        toolbarButton.moveTo({
            toolbarID:  'nav-bar',
            forceMove:  true
        });
        // */
    }

    /* A window tracker to attach/detach the curation sidebar to/from windows
     * when they are created/destroyed.
     */
    var tracker = new winUtils.WindowTracker({
            onTrack: function(window) {
                if (window.location.href !== URI_BROWSER)   { return; }

                // Attach a curation sidebar to this window
                console.log("Tracking window: ", window.location);

                var sb  = sidebar.get(window);
                if (sb) { return; }

                // Attach a curation sidebar to this window
                sb = sidebar.add({
                    window:     window,
                    id:         'curation-sidebar',
                    title:      'curation collection',
                    contentURL: data.url('view/topics/index.html'),
                    onMessage:  sbMessage
                });

                // Watch for new tabs to load
                window._tabWatchers = {
                    ready:  function(tab) {
                        console.log("tab.ready: "+ tab.url);

                        sb.postMessage({
                            src:    'sidebar-addon',
                            action: 'currentUrl',
                            url:    tab.url});
                    },
                    activate:  function(tab) {
                        console.log("tab.activate: "+ tab.url);

                        sb.postMessage({
                            src:    'sidebar-addon',
                            action: 'currentUrl',
                            url:    tab.url});
                    }
                };

                tabs.on('ready',    window._tabWatchers.ready);
                tabs.on('activate', window._tabWatchers.activate);
            },
            onUntrack: function(window) {
                if (window.location.href !== URI_BROWSER)   { return; }

                console.log("Untracking window: ", window.location);

                tabs.removeListener('ready',    window._tabWatchers.ready);
                tabs.removeListener('activate', window._tabWatchers.activate);

                var sb  = sidebar.get(window);
                if (! sb)   { return; }

                // Detach the curation sidebar from this window
                sb.destroy();
            }
        });

    /** @brief  The sidebar message handler.
     *  @param  message     The incoming message;
     *
     *  'this' is the triggering Sidebar instance.
     */
    function sbMessage(message)
    {
        //console.log("sbMessage: message[", JSON.stringify(message), "]");
        var src     = message.src;
        if (src !== 'sidebar-content')  { return; }

        switch (message.action)
        {
        case 'console':
            console.log( message.str );
            break;

        case 'loaded':
            var now = new Date();

            this.postMessage({
                src:    'sidebar-addon',
                action: 'load',
                topics: [
                    {"id":"topic-1",
                     "order":0,
                     "title":"Development",
                     "items":   [
                        {"id":"item-1",
                         "timestamp":1341225011904,
                         "content":"<a href='https://developer.mozilla.org/en-US/'>Mozilla Developer</a>",
                         "url":"https://developer.mozilla.org/en-US/",
                         "selector":"",
                         "topicId":"topic-1",
                         "order":0,
                         "comments":[]},
                        {"id":"item-2",
                         "timestamp":1341225011904,
                         "content":"<a href='https://developer.mozilla.org/en/JavaScript/Reference'>Javascript</a>",
                         "url":"https://developer.mozilla.org/en/JavaScript/Reference",
                         "selector":"",
                         "topicId":"topic-1",
                         "order":1,
                         "comments":[]},
                        {"id":"item-3",
                         "timestamp":1341226022904,
                         "content":"Other object in the global scope are either created by the user script or provided by the host application",
                         "url":"https://developer.mozilla.org/en/JavaScript/Reference",
                         "selector":"#section_2 > p:first",
                         "topicId":"topic-1",
                         "order":2,
                         "comments":[]},
                        {"id":"item-4",
                         "timestamp":1341228022904,
                         "content":"Operator precedence defines the order in which operators are evaluated.",
                         "url":"https://developer.mozilla.org/en/JavaScript/Reference",
                         "selector":"#section_5 > dl > dd.8",
                         "topicId":"topic-1",
                         "order":3,
                         "comments":[]},
                        {"id":"item-5",
                         "timestamp":1341225011904,
                         "content":"<a href='http://api.jquery.com/'>jQuery</a>",
                         "url":"http://api.jquery.com/",
                         "selector":"",
                         "topicId":"topic-1",
                         "order":4,
                         "comments":[]},
                        {"id":"item-6",
                         "timestamp":1341225011904,
                         "content":"<a href='http://documentcloud.github.com/backbone/#'>Backbone</a>",
                         "url":"http://documentcloud.github.com/backbone/#",
                         "selector":"",
                         "topicId":"topic-1",
                         "order":5,
                         "comments":[]},
                        {"id":"item-7",
                         "timestamp":1341225011904,
                         "content":"<a href='http://documentcloud.github.com/underscore/#'>Underscore</a>",
                         "url":"http://documentcloud.github.com/underscore/#",
                         "selector":"",
                         "topicId":"topic-1",
                         "order":6,
                         "comments":[]},
                        {"id":"item-8",
                         "timestamp":1341225011904,
                         "content":"<a href='http://nodejs.org/api/'>node.js</a>",
                         "url":"http://nodejs.org/api/",
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
                         "selector":"",
                         "topicId":"topic-2",
                         "order":0,
                         "comments":[]}
                     ]
                    },
                ]
            });
            break;

        case 'visit':
            /******************************************************
             * Visit the provided URL.
             *
             * If the URL is already loaded in an existing tab,
             * switch to the tab.
             *
             * Otherwise, open the URL in a (new) tab.
             *
             */
            var found   = false;
            for each (var tab in tabs)
            {
                if (tab.url == message.url)
                {
                    // Switch to this tab
                    found = true;
                    tab.activate();
                    break;
                }
            }

            if (! found)
            {
                // Not found -- need to open the page
                if (message.current === true)
                {
                    // Open in the *current* tab
                    tabs.activeTab.url = message.url;
                }
                else
                {
                    // Open in a new tab
                    tabs.open( message.url );
                }
            }
            break;

        }
    }
};
