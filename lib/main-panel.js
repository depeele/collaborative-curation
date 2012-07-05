exports.main    = function(options) {
    const   ss              = require('simple-storage'),
            tabs            = require('tabs'),
            data            = require('self').data,
            panelFactory    = require('panel'),
            tbb             = require('toolbarbutton'),
            {Cc,Ci,Cu}      = require("chrome");

    /* Load our stylesheet
    var sss             = Cc['@mozilla.org/content/style-sheet-service;1']
                            .getService(Ci.nsIStyleSheetService),
        ios             = Cc['@mozilla.org/network/io-service;1']
                            .getService(Ci.nsIIOService),
        chromeCss       = data.url('chrome.css'),
        chromeCssUri    = ios.newURI(chromeCss, null, null);
    sss.loadAndRegisterSheet(chromeCssUri, sss.AGENT_SHEET);
    // */

    // Create our panel
    var panel   = require('panel').Panel({
            width:  400,
            height: 500,
            contentURL:         data.url('view/topics/index.html'),
            contentScriptFile:  [
                data.url('js/jquery.min.js'),
                data.url('js/underscore.min.js'),
                data.url('js/backbone.min.js'),
                data.url('view/topics/topics-panel.js')
            ],
            onShow: function() {
                //console.log("onShow()");

                /*
                var now = new Date();
                panel.postMessage({
                    name:   'panel',
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
                // */
                panel.postMessage({name:'panel', action:'show'});

            },
            onHide: function() {
                panel.postMessage({name:'panel', action:'hide'});
            },
            // Handle a postMessage() from the topics view
            onMessage:  function(msg) {
                console.log("onMessage from view/topics: msg[",
                                JSON.stringify(msg), "]");

                if (msg.action === 'loaded')
                {
                    // Perform an initial load of our panel
                    var now = new Date();
                    panel.postMessage({
                        name:   'panel',
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
                }
            }
        }),
        // Create our toolbar button
        toolbarButton   = tbb.ToolbarButton({
        id:     'curation-toolbarbutton',
        label:  'Curation',
        image:  data.url('images/toolbar-icon.png'),
        panel:  panel
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
    tabs.on('ready', onDOMContentLoaded);

    function onDOMContentLoaded(tab)
    {
        console.log("onDOMContentLoaded: "+ tab.url);
    }
};
