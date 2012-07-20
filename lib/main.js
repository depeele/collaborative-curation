const   URI_BROWSER     = 'chrome://browser/content/browser.xul',
        ss              = require('simple-storage'),
        tabs            = require('tabs'),
        winUtils        = require('window-utils'),
        timers          = require('timers'),
        notifications   = require('notifications'),
        addon           = require('self'),
        sidebar         = require('sidebar'),
        sidebarUrl      = addon.data.url('sidebar.html'),
        { Cc, Ci, Cu }  = require('chrome');

/*************************************************************
 * Helpers {
 *
 */
/** @brief  Return a new FileReader instance
 *          (similar to that available in client scripts).
 *
 *  @return A new FileReader instance.
 */
function FileReader()
{
    return Cc['@mozilla.org/files/filereader;1']
            .createInstance(Ci.nsIDOMFileReader);
}

/** @brief  Given a nsIFile instance, retrieve its mime-type.
 *  @param  file    The nsIFile instance;
 *
 *  @return The mime-type ('unknown' if the type cannot be determined).
function MimeType(file)
{
    const   MimeService = Cc['@mozilla.org/mime;1']
                            .getService(Ci.nsIMIMEService);
    var     mime        = 'unknown';
    
    try {
        mime = MimeService.getTypeFromFile(file);
    } catch(e) {}

    return mime;
}
// */

/** @brief  Given an nsIDOMFile/File instance, retrieve its content as a
 *          data URL (e.g. data:image/png;base64,Base64-encoded-data).
 *  @param  file    The nsIDOMFile/File instance;
 *  @param  cb      The callback to invoke upon success:
 *                      cb(data)
 */
function FileAsDataUrl(file, cb)
{
    try {
        //var reader  = new FileReader();
        var reader  = FileReader();
        reader.onload = function(e) {
            cb(e.target.result);
        };
        reader.readAsDataURL(file);
    } catch(e) {
        log("*** Cannot retrieve file '%s' as data URL: %s",
            file.name || file.leafName, e.message);
    }
}

/**************************
 * Privilege Granting
 *
 * Borrowed from:
 *  https://github.com/mozilla/deuxdrop/blob/develop/clients/addon/lib/main.js
 */
function makeURI(url, charset, baseUri)
{
    var ioService   = Cc['@mozilla.org/network/io-service;1']
                            .getService(Ci.nsIIOService);
    return ioService.newURI(url, charset, baseUri);
}

/** @brief  Forcibly provide the indexedDB permission for the given URL.  If we
 *          don't do this, any use of indexedDB in add-on content scripts will
 *          hang while it tries to display a notification prompt that no one
 *          will ever see.
 *  @param  url     The content URL.
 */
function authIndexedDBForUrl(url)
{
    // forcibly provide the indexedDB permission
    let permMgr = Cc['@mozilla.org/permissionmanager;1']
                        .getService(Ci.nsIPermissionManager),
        uri     = makeURI(url, null, null);

    permMgr.add(uri, 'indexedDB', Ci.nsIPermissionManager.ALLOW_ACTION,
                                  Ci.nsIPermissionManager.EXPIRE_NEVER);
}

/* Helpers }
 *************************************************************/

/** @brief  A new window has been created.  If it is a browser window, add a
 *          sidebar.
 *  @param  window      The new window;
 */
function trackWindow(window)
{
    if (window.location.href !== URI_BROWSER)   { return; }

    // Attach a curation sidebar to this window
    log("Tracking window: %s", window.location);

    var sb  = sidebar.get(window);
    if (sb) { return; }

    // Attach a curation sidebar to this window
    sb = sidebar.add({
        window:     window,
        id:         'curation-sidebar',
        title:      'curation collection',
        contentURL: sidebarUrl,
        onMessage:  sbMessage,
        onDrop:     sbDrop,
        dndProxy:  sbDndProxy
    });

    // Watch for new tabs to load
    window._tabWatchers = {
        ready:  function(tab) {
            log("tab.ready: %s", tab.url);

            sb.postMessage({
                src:    'sidebar-addon',
                action: 'currentUrl',
                url:    tab.url});
        },
        activate:  function(tab) {
            log("tab.activate: %s", tab.url);

            sb.postMessage({
                src:    'sidebar-addon',
                action: 'currentUrl',
                url:    tab.url});
        }
    };

    tabs.on('ready',    window._tabWatchers.ready);
    tabs.on('activate', window._tabWatchers.activate);
}

function untrackWindow(window)
{
    if (window.location.href !== URI_BROWSER)   { return; }

    log("Untracking window: %s", window.location);

    tabs.removeListener('ready',    window._tabWatchers.ready);
    tabs.removeListener('activate', window._tabWatchers.activate);

    var sb  = sidebar.get(window);
    if (! sb)   { return; }

    // Detach the curation sidebar from this window
    sb.destroy();
}

/** @brief  Handle a drag-and-drop 'drop' event, converting items that
 *          would be completely inaccessible from the client into
 *          accessible, JSON data.
 *  @param  e       The drop event;
 *  @param  target  If provided, the target of the newly generated
 *                  'dropExternal' event;
 *
 *
 *  'this' is the triggering Sidebar instance.
 */
function sbDrop(e, target)
{
    //log("main-sidebar::sbDrop(): e.dataTransfer[ %j ]...",e.dataTransfer);

    var sb                  = this,
        dataTransfer        = e.dataTransfer,
        imageType           = /image.*/,
        accessible          = {
            types:  (dataTransfer ? Array.slice(dataTransfer.types) : [])
        },
        pendingRetrievals   = 0;

    //log("main-sidebar::sbDrop(): types[ %j ]", accessible.types);

    /*********************************************************************
     * If this is NOT the drop of an external source
     *  (i.e. is 'dataTransfer.mozSourceNode' an empty object)
     * return and allow the event to propagate.
     *
     * Otherwise, normalize the dataTransfer object and create and trigger
     * a new, custom event (dropExternal) with the normalized data.
     *
     */
    if (dataTransfer.mozSourceNode)
    {
        var contains    = this.contains(dataTransfer.mozSourceNode);

        /*
        log("main-sidebar::sbDrop(): sidebar %s mozSourceNode [ %s ]",
                (contains ? 'contains' : 'DOES NOT contain'),
                dataTransfer.mozSourceNode);
        // */

        if (contains === true)
        {
            /* The user has performed drag-and-drop on a node internal to
             * the sidebar.  Allow this internal drop event to propagate
             */
            //log("main-sidebar::sbDrop(): IGNORE");
            return;
        }
    }
    //log("main-sidebar::sbDrop(): normalize dataTransfer...");

    /*********************************************************************
     * This is a drop of an *external* source.  Normalize the dataTransfer
     * object and create and trigger a new, custom event (dropExternal)
     * with the normalized data.
     *
     */
    for (var idex = 0; idex < dataTransfer.types.length; idex++)
    {
        var type    = dataTransfer.types.item(idex);

        switch (type)
        {
        /* 'x-moz-file' doesn't provide much more useful information than
         * 'files', particularly since FileDataAsUrl()/FileReader() cannot
         * handle an nsIFile AND, if we want mime-type information, we are
         * forced to use manually identify the mime-type of the target file
         * (via MimeType() / nsIMIMEService).
         *
         * For these reasons, do minimal work converting 'x-moz-file'
         */
        case 'application/x-moz-file':
            var items   = [];

            for (var jdex = 0; jdex < dataTransfer.mozItemCount; jdex++)
            {
                var file    = dataTransfer.mozGetDataAt(type, jdex);
                if (! (file instanceof Ci.nsIFile)) { continue; }
                file = file.QueryInterface(Ci.nsIFile);

                var item    = {
                        name:               file.leafName,
                        path:               file.path,
                        size:               file.fileSize,
                        //type:               MimeType(file),

                        lastModifiedTime:   file.lastModifiedTime,
                        permissions:        file.permissions
                    };

                items.push( item );
            }
            accessible[type] = items;
            break;

        case 'Files':
            var files   = dataTransfer.files,
                items   = [];
            for (var jdex = 0; jdex < files.length; jdex++)
            {
                let file    = files[jdex],
                    item    = {
                        name:               file.name,
                        path:               ( file.mozFullPath
                                                ? file.mozFullPath
                                                : undefined),
                        size:               file.size,
                        type:               file.type,
                        lastModifiedDate:   file.lastModifiedDate
                    };

                if (file.type.match( imageType ))
                {
                    /* For images, retrieve a data URL version of the file
                     * content.
                     */
                    pendingRetrievals++;
                    FileAsDataUrl(file, function(data) {
                        item.dataUrl = data;

                        pendingRetrievals--;
                    });
                }

                items.push( item );
            }
            accessible.files = items;
            break;

        case 'text/x-moz-place':
            accessible[type] = JSON.parse( dataTransfer.getData( type ) );
            break;

        case 'text/x-moz-url':
            var data    = dataTransfer.getData( type ),
                parts   = data.split("\n"),
                items   = [];

            for (var idex = 0, len = parts.length; idex < len; idex += 2)
            {
                items.push({
                    url:    parts[idex],
                    title:  parts[idex+1]
                });
            }
            accessible[type] = items;

            //log("main-sidebar::sbDrop():       : %j", accessible[type]);
            break;

        case 'text/html':
            accessible[type] = {
                html:   dataTransfer.getData( type ),
                srcUrl: tabs.activeTab.url
            };
            break;

        default:
            var item    = dataTransfer.getData( type );

            // Ensure it is a string
            item = ''+item;

            //log("main-sidebar::sbDrop():       : %j", item);

            accessible[type] = item;
            break;
        }
    }
    //log("main-sidebar::sbDrop(): accessible %j", accessible);

    /* Trigger a new, custom 'dropExternal' event on the original target
     * element with our normalized dataTransfer object.
     */
    var eventTgt    = (target || e.target);

    /*
    log("main-sidebar::sbDrop(): target[ %s ]", eventTgt);
    for (var prop in eventTgt)
    {
        log("main-sidebar::sbDndProxy():  eventTgt.%s [ %s ]",
                prop, eventTgt[prop]);
    }
    // */

    /* :NOTE: If proxied via sbDndProxy(), 'target' is the 'document'
     *        element of the sidebar browser that should have a
     *        createEvent() method.  If so, use it, otherwise, retrieve the
     *        target element's ownerDocument in order to access the
     *        createEvent() method.
     */
    var newEvent    = (target && eventTgt.createEvent
                        ? eventTgt
                        : eventTgt.ownerDocument)
                                        .createEvent('CustomEvent');

    /****************************************************
     * :NOTE: Before firing the new event, wait for
     *        any pending retrievals to complete.
     */
    function dispatchNewEvent()
    {
        /* Initialize the new 'dropExternal' custom event with a 'detail'
         * of the new, "accessible" dataTransfer information.
         */
        newEvent.initCustomEvent('dropExternal',
                                 true,          // canBubble
                                 true,          // cancelable,
                                 accessible);   // dataTransfer

        /*
        log("main-sidebar::sbDndProxy()/dispatchNewEvent:  detail: %j",
                newEvent.detail);
        // */

        // Dispatch the 'dropExternal' event to the new target
        eventTgt.dispatchEvent( newEvent );

        /* IF the sidebar is currently closed, trigger a notification
         * so the user knows something useful has happened.
         */
        if (sb.hidden)
        {
            notifications.notify({
                title:  'Stored',
                text:   'The dropped item has been stored in the '
                        +   'collaborative collection sidebar.',
                iconURL:addon.data.url('images/sidebar-icon.png')
            });
        }
    }

    function waitForRetrievals()
    {
        /*
        log("main-sidebar::sbDndProxy()/waitForRetrievals:  %d pending",
                pendingRetrievals);
        // */

        if (pendingRetrievals > 0)
        {
            timers.setTimeout(function() { waitForRetrievals(); }, 50);
            return;
        }

        // All pending retrievals have completed, dispatch the new event
        dispatchNewEvent();
    }

    /* wait for all pending retrievals to complete BEFORE we initialize and
     * dispatch the new event.
     */
    waitForRetrievals();

    // Stop the original event
    return false;
}

/** @brief  Proxy a drag-and-drop event, converting items that
 *          would be completely inaccessible from the client into
 *          accessible, JSON data.
 *  @param  e       The drop event;
 *
 *  'this' is the triggering Sidebar instance.
 */
function sbDndProxy(e)
{
    var sb              = this,
        dataTransfer    = e.dataTransfer;

    //log("main-sidebar::sbDndProxy(): e.type[ %s ]...", e.type);

    switch (e.type)
    {
    case 'dragover':
        dataTransfer.dropEffect = 'copy';

        e.preventDefault(); // Allow drop
        break;

    case 'drop':
        /* Redirect this drop event, causing a new 'dropExternal' event
         * targeted at the 'document' element of sidebar.sbBrowser
         */
        var target  = sb.sbBrowser.contentDocument;

        /*
        log("main-sidebar::sbDndProxy(): new target[ %s ]", target);
        for (var prop in target)
        {
            log("main-sidebar::sbDndProxy():  target.%s [ %s ]",
                    prop, target[prop]);
        }
        // */

        sbDrop.call(sb, e, target);
        break;
    }
}

/** @brief  The sidebar message handler.
 *  @param  message     The incoming message;
 *
 *  'this' is the triggering Sidebar instance.
 */
function sbMessage(message)
{
    //log("sbMessage: message %j", message);
    var sidebar = this,
        src     = message.src;
    if (src !== 'sidebar-content')  { return; }

    switch (message.action)
    {
    case 'loaded':
        log("sbMessage: 'loaded' message %j", message);

        /* :XXX: The primary content view has loaded.  This message is
         *       posted by TopicsView:render() when it wasn't provided
         *       model data to render.  If we need to retrieve the data
         *       from non-content-script code, we could do it here and pass
         *       the data to the content-script via:
         *          postmessage({
         *              src:    'sidebar-addon',
         *              action: 'load',
         *              topics: [ topic data ]});
         */
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
         * If the incoming message *also* has a non-empty
         * 'location', include the last '#' item in the
         * url.
         */
        var found   = false,
            url     = message.url;
        log("sbMessage: 'visit' message %j", message);

        if (message.location && (message.location.length > 0))
        {
            // Construct the fully-qualified URL
            var start   = message.location.lastIndexOf('#'),
                end     = message.location.indexOf(' ', start),
                hash    = (end > start
                            ? message.location.substring(start, end)
                            : message.location.substr(start));

            if (hash.length > 0)    { url += hash; }
        }

        log("sbMessage: target[ %s ], full[ %s ], current[ %j ]",
                message.url, url, message.current);

        if (message.current === true)
        {
            // See if we can find a current tab that we can use.
            var baseUrl = url,
                hash;
            if ( (hash = url.lastIndexOf('#')) > 0)
            {
                // Reduce the 'baseUrl' to everything BEFORE any '#'
                baseUrl = url.substr(0, hash);
            }

            log("sbMessage: base[ %s ]", baseUrl);

            for each (var tab in tabs)
            {
                var tabUrl  = tab.url;

                if ( (hash = tabUrl.lastIndexOf('#')) > 0)
                {
                    tabUrl = tabUrl.substr(0, hash);
                }

                if (tabUrl === baseUrl)
                {
                    // Switch to this tab
                    found = tab;
                    tab.activate();
                    if (tab.url !== url)
                    {
                        //tabs.activeTab.url = url;
                        tab.url = url;
                    }
                    break;
                }
            }

            if (! found)
            {
                // Open in the *current* tab
                tabs.activeTab.url = url;   //message.url;
            }
        }
        else
        {
            // Open in a new tab
            tabs.open( url );   //( message.url );
        }
        break;

    case 'log':
        /* Allow either a preformatted 'str' that we will just output OR
         * an 'args' array that will be passed through sprintf() before
         * being output.
         */
        if (message.str)
        {
            console.log( message.str );
            break;
        }
        else if (message.args)
        {
            log.apply( this, message.args );
            break;
        }
        // fall through

    default:
        log("Sidebar::sbMessage(): Unhandled message[ %j ]", message);
        break;
    }
}

/** @brief  Provide printf-like log functionality.
 *  @param  fmt     The printf format string;
 *  @param  args    Following arguments to fulfill 'fmt';
 */
function log(fmt, args)
{
    args = Array.slice(arguments);

    var str = sprintf.apply(this, args);
    console.log( str );
}

/** @brief  Perform printf-like formatting of the provided 'fmt' and 'args'
 *          and return the resulting string.
 *  @param  fmt     The printf format string;
 *  @param  args    Following arguments to fulfill 'fmt';
 *
 *  @return The generated string.
 */
function sprintf(fmt, args)
{
    var str = '';
    if (! Array.isArray(args))
    {
        args = Array.slice(arguments, 1);
    }

    /********************************************
     * Process the provided 'fmt' and 'args'
     *  %s  = string
     *  %d  = integer (decimal)
     *  %x  = integer (hexadecimal, 0x)
     *  %o  = integer (octal,       0)
     *  %f  = floating point
     *  %g  = floating point
     *  %j  = JSON
     */
    var matches = fmt.match(/(\%[sdxofgj])/g),
        pos     = 0;

    if (matches && (matches.length > 0))
    {
        for (var idex = 0, len = Math.min(matches.length, args.length);
                idex < len;
                    ++idex)
        {
            var match       = matches[idex],
                arg         = args[idex],
                posMatch    = fmt.indexOf(match, pos);
            if (posMatch > pos)
            {
                str += fmt.slice(pos, posMatch);
                pos  = posMatch;
            }

            var formatted   = '?';
            try {
                switch (match[1])
                {
                // String
                case 's':
                    formatted = arg;
                    break;

                // Integer
                case 'd':
                    formatted = parseInt(arg, 10);
                    break;

                case 'x':
                    formatted = parseInt(arg, 16);
                    break;

                case 'o':
                    formatted = parseInt(arg, 8);
                    break;

                // Floating point
                case 'f':
                case 'g':
                    formatted = parseFloat(arg);
                    break;

                // JSON
                case 'j':
                    formatted = JSON.stringify(arg);
                    break;
                }
            } catch(e) {
                formatted = "**Format Error: "+ e.message;
            }

            str += (formatted.toString ? formatted.toString() : '');
            pos += match.length;
        }
    }

    if (pos < fmt.length)
    {
        str += fmt.slice(pos);
    }

    return str;
}

/*****************************************************************************
 * Main add-on routine.
 *
 */
exports.main    = function(options) {
    if (! ss.collaborativeCuration)
    {
        // First load -- create our property store
        ss.collaborativeCuration = {};
    }

    // Explicitly authorize the sidebar content to use indexedDB
    authIndexedDBForUrl(sidebarUrl);

    /* A window tracker to attach/detach the curation sidebar to/from windows
     * when they are created/destroyed.
     */
    var tracker = new winUtils.WindowTracker({
            onTrack:    trackWindow,
            onUntrack:  untrackWindow
        });
};
