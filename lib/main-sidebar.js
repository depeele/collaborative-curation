exports.main    = function(options) {
    const   ss          = require('simple-storage'),
            tabs        = require('tabs'),
            data        = require('self').data,
            tbb         = require('toolbarbutton'),
            sidebar     = require('sidebar');

    // Create our toolbar button
    var self            = this,
        sb              = null,
        toolbarButton   = tbb.ToolbarButton({
        id:                 'curation-toolbarbutton',
        label:              'Curation',
        title:              'Collaborative Curation',
        alwaysShowLabel:    false,
        image:              data.url('img/toolbar-icon.png'),
        onCommand:          function() {
            // See if we have a sidebar for the active window
            sb = sidebar.get();
            if (! sb)
            {
                // Create a curation sidebar for this window
                sb = sidebar.add({
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
                            sbMessage(message);
                        }
                     });
            }

            sb.toggle();
        }
    });

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
            sb.postMessage({
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

