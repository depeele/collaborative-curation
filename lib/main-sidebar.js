exports.main    = function(options) {
    const   ss          = require('simple-storage'),
            tabs        = require('tabs'),
            winUtils    = require('window-utils'),
            data        = require('self').data,
            tbb         = require('toolbarbutton'),
            sidebar     = require('sidebar');

    var self        = this,
        delegate, toolbarButton, tracker;

    // Create our toolbar button
    toolbarButton = tbb.ToolbarButton({
        id:                 'curation-toolbarbutton',
        label:              'Curation',
        title:              'Collaborative Curation',
        alwaysShowLabel:    false,
        image:              data.url('img/toolbar-icon.png'),
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
                title:              'curation collection',
                contentURL:         data.url('view/topics/index.html'),
                //contentScriptWhen:  'load',
                contentScriptFile:  [
                    data.url('js/jquery.min.js'),
                    data.url('js/underscore.min.js'),
                    data.url('js/backbone.min.js'),
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

    // On first load, force the toolbar button onto the nav-bar
    if (! ss.collaborativeCuration)
    {
        ss.collaborativeCuration = {};

        toolbarButton.moveTo({
            toolbarID:  'nav-bar',
            forceMove:  true
        });
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
                    {topic: 'Topic 1',
                     items:  [
                        {url:       'http://www.google.com/',
                         title:     'Google',
                         timestamp: now.getTime(),
                         content:   'This is a test',
                         comments:  []},
                        {url:       'https://developer.mozilla.org/',
                         title:     'Mozilla Developer',
                         timestamp: now.getTime(),
                         content:   'This is another test',
                         comments:  []}
                     ]},
                ]
            });
            } catch(e) {
                console.log("main:postMessage FAILED: ", e.message);
            }
            break;
        }
    }
};

