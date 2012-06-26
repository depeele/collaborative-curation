exports.main    = function(options) {
    const   ss              = require('simple-storage'),
            tabs            = require('tabs'),
            data            = require('self').data,
            tbb             = require('toolbarbutton'),
            sidebar         = require('sidebar');

    // Create our toolbar button
    var self            = this,
        sbWorker        = null,
        toolbarButton   = tbb.ToolbarButton({
        id:                 'curation-toolbarbutton',
        label:              'Curation',
        title:              'Collaborative Curation',
        alwaysShowLabel:    false,
        image:              data.url('img/toolbar-icon.png'),
        onCommand:          function() {
            //console.log("Toolbar Button clicked");

            var sb  = sidebar.get();

            if (! sb)
            {
                //console.log("Add a sidebar to this window...");
                sb = sidebar.add({
                        title:              'curation collection',
                        contentURL:         data.url('view/topics/index.html'),
                        contentScriptFile:  [
                            data.url('js/jquery.min.js'),
                            data.url('view/topics/topics.js')
                        ],
                        onMessage:  function(message) {
                            sbMessage(message);
                        }
                     });
            }

            if (sb.isHidden())
            {
                // Load page-specific information into the sidebar
                sb.show();
            }
            else
            {
                sb.hide();
            }
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
    tabs.on('ready', onDOMContentLoaded);

    function onDOMContentLoaded(tab)
    {
        console.log("onDOMContentLoaded: "+ tab.url);
    }

    /** @brief  The sidebar message handler.
     *  @param  message     The incoming message;
     */
    function sbMessage(message)
    {
        console.log("sbMessage: message[", message, "]");
        var name    = message.name;
        if (name !== 'sidebar') { return; }

        switch (message.action)
        {
        }
    }
};

