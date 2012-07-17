const NS_XUL        = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
      NS_HTML       = "http://www.w3.org/1999/xhtml",
      URI_BROWSER   = 'chrome://browser/content/browser.xul',
      BROWSER       = 'navigator:browser';

var { Loader, Symbiont, Worker }
                    = require('api-utils/content'),
    { Trait }       = require('api-utils/traits'),
    { Cc, Ci, Cu }  = require('chrome'),
    data            = require('self').data,
    Mediator        = Cc['@mozilla.org/appshell/window-mediator;1']
                            .getService(Ci.nsIWindowMediator),
    sss             = Cc['@mozilla.org/content/style-sheet-service;1']
                            .getService(Ci.nsIStyleSheetService),
    ios             = Cc['@mozilla.org/network/io-service;1']
                            .getService(Ci.nsIIOService);

// Attempt to load our css
loadCss( data.url('css/chrome-sidebar.css') );

/** @brief  Add a sidebar to the most recent window.
 *  @param  options     Creation options
 *
 *  @return The new sidebar.
 */
exports.add = function(options) {
    return Sidebar(options);
};

/** @brief  See if there is a sidebar already attached to the specified window.
 *  @param  window      The target window [ getMostRecentWIndow() ]
 *
 *  @return The sidebar (undefined if not yet attached);
 */
exports.get = function(window) {
    window = window || getMostRecentWindow();

    return window.__sidebar;
};


/** @brief  A simple Sidebar class that can load the sidebar with HTML content
 *          from files within 'data/'.
 *
 *  :NOTE: Sidebar inherits from Symbiont       (api-utils/content/symbiont)
 *          Symbion inherits from Worker        (api-utils/content/worker)
 *            Worker inherits from EventEmitter (api-utils/events)
 */
var Sidebar = Trait.compose(
    Symbiont.resolve({
        constructor:    '_symbiontInit',
        _onInit:        '_symbiontOnInit',
        postMessage:    '_symbiontPostMessage',
        destroy:        '_symbiontDestroy'
    }), {
    _emit:              Symbiont.required,

    on:                 Symbiont.required,

    constructor: function(options) {
        var self    = this;

        self.on('error',    self._onUncaughtError.bind(self));

        //console.log("Sidebar:constructor: window:", self.window);

        self.options = options || {};
        self.options.id         = self.options.id         || 'aux';
        self.options.title      = self.options.title      || 'sidebar';
        self.options.exclude    = self.options.exclude    || [];
        self.options.contentURL = self.options.contentURL || 'about:blank';

        if (! self.options.allow)        { self.options.allow = {}; }
        if (! self.options.allow.script) { self.options.allow.script = true; }

        self.window           = options.window || getMostRecentWindow();
        self.window.__sidebar = self;

        self.hidden    = false;
        self.destroyed = false;

        self._render();

        /* Initialize the Symbiont.  This will take care of loading the content
         * frame (identified in _render()) and attaching a content Worker.
         */
        self._symbiontInit( self.options );

        // Initially hidden
        self.hide();

        return self;
    },

    destroy: function() {
        var self    = this;

        if (self.sbGrippy)
        {
            self.sbGrippy.removeEventListener('click',
                                                self._grippyToggle, true);
        }

        if (self.sbClose)
        {
            self.sbClose.removeEventListener('click',
                                                self._closeToggle, true);
        }

        self._symbiontDestroy();
    },

    isHidden: function() {
        return (this.hidden);
    },

    toggle: function() {
        if (this.hidden)    { this.show(); }
        else                { this.hide(); }
    },

    hide: function() {
        var self    = this;

        if (self.hidden)    { return self; }

        addClass(self.sbBox,      'state-hidden');
        if (self.sbSplitter)
        {
            addClass(self.sbSplitter, 'state-hidden');
        }

        var tip     = 'open sidebar';
        if (self.sbGrippy)
        {
            self.sbGrippy.setAttribute('tooltiptext', tip);
        }

        if (self.sbClose)
        {
            self.sbClose.setAttribute('tooltiptext', tip);
        }

        self.hidden = true;

        self.postMessage({src:'sidebar', action:'hide'});

        return self;
    },

    show: function(data) {
        var self    = this;

        if (! self.hidden)  { return self; }
        if (! self._contentWorker)
        {
            return self.once('sbInited', self.show.bind(self));
        }

        if (self.sbTitle)
        {
            self.sbTitle.setAttribute('value', self.options.title);
        }

        removeClass(self.sbBox,      'state-hidden');
        if (self.sbSplitter)
        {
            removeClass(self.sbSplitter, 'state-hidden');
        }

        var tip     = 'close sidebar';
        if (self.sbGrippy)
        {
            self.sbGrippy.setAttribute('tooltiptext', tip);
        }

        if (self.sbClose)
        {
            self.sbClose.setAttribute('tooltiptext', tip);
        }

        self.hidden  = false;

        self.postMessage({src:'sidebar', action:'show'});

        return self;
    },

    /** @brief  Does the sidebar (document) contain the given DOM node?
     *  @param  node    The DOM node in questions;
     *
     *  @return true | false
     */
    contains: function(node) {
        var self        = this,
            contained   = false;

        try {
            if (self.sbBrowser) 
            {
                //contained = self.sbBrowser.contains( node );
                var relation    = self.sbBrowser.contentDocument
                                        .compareDocumentPosition( node );

                /* The relationship (a.contains(b)) is a bitmask where:
                 *        ( 0): identical
                 *  bit 0 ( 1): disconnected (different documents or outside)
                 *  bit 1 ( 2): Node B precedes Node A
                 *  bit 2 ( 4):        follows
                 *  bit 3 ( 8):        contains
                 *  bit 4 (16):        contained-by
                 *  bit 5 (32): Private use by the browser
                 *
                 * 37 == disconnected , follows, private-use
                 *
                 * console.log("Sidebar::contains(): node[", node, "]:",
                 *             relation);
                 */
                contained = (relation & 16 ? true : false);
            }
        } catch(e) {}

        /*
        console.log("Sidebar::contains(): node[", node, "]:",
                    (contained ? 'true' : 'false'));
        // */

        return contained;
    },

    /**************************************************************************
     * "Private" methods
     *
     */
    _render: function() {
        var self        = this,
            document    = self.window.document;

        function $(id)      document.getElementById(id);
        function xul(type)  document.createElementNS(NS_XUL, type);
        function html(type) document.createElementNS(NS_HTML, type);

        /* We cannot simply access the sidebar elements of the existing browser
         * since the addon-sdk cannot handle events from pre-existing XUL
         * elements so, we need to duplicate the XUL elements, injecting them
         * into the browser.
         *
         * Access the sidebar elements of the existing browser.
         *
         * The primary firefox elements (browser/base/content/browser.xul):
         *  <deck id="tab-view-deck" flex="1">
         *   <vbox id="browser-panel" flex="1">
         *
         *    <toolbox id="navigator-toolbox"> ... </toolbox>
         *
         *    <hbox flex="1" id="browser">                      browser {
         *     <vbox id="browser-border-start" hidden="true layer="true"/>
         *
         **    <vbox id="sidebar-box" hidden="true"
         *                    class="chromeclass-extrachrome">  left-sidebar {
         *      <sidebarheader id="sidebar-header" align="center">
         **      <label id="sidebar-title" persist="value" flex="1"
         *                    crop="end" control="sidebar" />
         *       <image id="sidebar-throbber" />
         *       <toolbarbutton class="tabs-closebutton"
         *                    tooltiptext="&sidebarCloseButton.tooltip;"
         *                    oncommand="toggleSidebar();" />
         *      </sidebarheader>
         *
         **     <browser id="sidebar" flex="1" autoscroll="false"
         *                    disablehistory="true"
         *                    style="min-width:14em; width:18em; 
         *                           max-width:36em;" />
         *     </vbox>                                          left-sidebar }
         *
         **    <splitter id="sidebar-splitter"
         *                    class="chromeclass-extrachrome"
         *                    hidden="true" />
         *
         *     <vbox id="appcontent" flex="1">
         *      <tabbrowser id="content" disablehistory="true"
         *                    flex="1" contenttooltip="aHTMLTooltip"
         *                    tabcontainer="tabbrowser-tabs"
         *                    contentcontextmenu="contentAreaContextMenu"
         *                    autocompletepopup="PopupAutoComplete"
         *                    onclick="contentAreaClick(event, false);" />
         *      <statuspanel id="statusbar-display" inactive="true"/>
         *     </vbox>
         *
         *     <splitter id="devtools-sidebar-splitter"
         *                    hidden="true" />
         *
         *     <vbox id="devtools-sidebar-box" hidden="true"
         *                    style="min-width:18em;width:22em;max-width:42em;"
         *                    persist="width">                  right-sidebar {
         *      <toolbar id="devtools-sidebar-toolbar"
         *                    class="devtools-toolbar"
         *                    nowindowdrag="true" />
         *      <deck id="devtools-sidebar-deck" flex="1" />
         *     </vbox>                                          right-sidebar }
         *
         *     <vbox id="browser-border-end" hidden="true" layer="true" />
         *    </hbox>                                               browser }
         *   </vbox>
         *  </deck>
         *
         */
        var id          = self.options.id,
            mainBrowser = $('browser'),
            end         = $('browser-border-end'),
            vbox        = xul('vbox'),
            browser     = xul('browser');

        if (! mainBrowser)  { return; }

        /* :NOTE: No docShell will be attached UNLESS we create these elements
         *        as NOT hidden.
         */
        if (self.options.exclude.indexOf('splitter') < 0)
        {
            self.sbSplitter = xul('splitter');
            self.sbSplitter.setAttribute('id',          id +'-splitter');
            self.sbSplitter.setAttribute('hidden',      false);
            mainBrowser.insertBefore(self.sbSplitter, end);

            if (self.options.exclude.indexOf('grippy') < 0)
            {
                self.sbGrippy = xul('grippy');
                self.sbGrippy.setAttribute('id',          id +'-grippy');
                self.sbGrippy.setAttribute('hidden',      false);
                self.sbGrippy.setAttribute('tooltiptext', 'open sidebar');
                self.sbSplitter.appendChild(self.sbGrippy);

                self._grippyToggle = function() { self.toggle(); };
                self.sbGrippy.addEventListener('click',
                                                 self._grippyToggle, true);
            }
        }

        vbox.setAttribute(    'id',         id +'-box');
        vbox.setAttribute(    'hidden',     false);
        vbox.setAttribute(    'persist',    'width');
        vbox.setAttribute(    'class',      'chromeclass-extrachrome');
        vbox.setAttribute(    'style',      'width:20em;');
        vbox.setAttribute(    'src',        self.options.contentURL);
        mainBrowser.insertBefore(vbox,     end);

        if (self.options.exclude.indexOf('header') < 0)
        {
            var header      = xul('sidebarheader');

            header.setAttribute(  'id',         id +'-header');
            header.setAttribute(  'align',      'center');
            vbox.appendChild( header );

            if (self.options.exclude.indexOf('title') < 0)
            {
                self.sbTitle = xul('label');

                self.sbTitle.setAttribute(   'id',         id +'-title');
                self.sbTitle.setAttribute(   'persist',    'value');
                self.sbTitle.setAttribute(   'crop',       'end');
                self.sbTitle.setAttribute(   'flex',       1);
                header.appendChild( self.sbTitle );
            }

            if (self.options.exclude.indexOf('close') < 0)
            {
                self.sbClose = xul('toolbarbutton');

                self.sbClose.setAttribute('id',          id +'-close');
                self.sbClose.setAttribute('tooltiptext', 'close');
                self.sbClose.setAttribute('tooltiptext', 'open sidebar');
                header.appendChild( self.sbClose );

                self._closeToggle = function() { self.toggle(); };
                self.sbClose.addEventListener('click',
                                              self._closeToggle, true);
            }
        }

        browser.setAttribute( 'id',         id);
        browser.setAttribute( 'type',       'content');
        browser.setAttribute( 'autoscroll', false);
        browser.setAttribute( 'disablehistory', true);
        browser.setAttribute( 'flex',       1);
        browser.setAttribute( 'src',        self.options.contentURL);
        vbox.appendChild( browser );

        self.sbBox      = vbox;
        self.sbBrowser  = browser;

        self.options.frame = self.sbBrowser;

        if (self.options.onDrop)
        {
            // Attach a listener for 'drop'
            var drop    = function(e) {
                    if (self.options.onDrop.call(self, e) === false)
                    {
                        /* If the handler returns 'false', stop event
                         * propagation
                         */
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                    }
                };

            self.sbBrowser.addEventListener('drop', drop, true, true);

            if (self.sbSplitter && self.options.dndProxy)
            {
                var proxy   = function(e) {
                        self.options.dndProxy.call(self, e);
                    };

                self.sbSplitter.addEventListener('dragover',  proxy, true,true);
                self.sbSplitter.addEventListener('dragenter', proxy, true,true);
                self.sbSplitter.addEventListener('dragleave', proxy, true,true);
                self.sbSplitter.addEventListener('drop',      proxy, true,true);
            }
        }

        /*
        console.log("Sidebar::_render(): sbBox[", self.sbBox, "]");
        console.log("Sidebar::_render(): sbBrowser[", self.sbBrowser, "].",
                                "docShell[",  self.sbBrowser.docShell, "]");
        // */
    },

    postMessage: function(message) {
        var self    = this,
            ret;

        /*
        console.log("Sidebar::postMessage(): message[",
                                        JSON.stringify(message), "]");
        // */

        try {
            ret = self._symbiontPostMessage(message);
        } catch(e) {
            console.log("Sidebar::postMessage() FAILED: ", e.message);
        }

        return ret;
    },

    /** @brief  Invoked by Symbiont when the frame is ready to load.
     */
    _onInit: function() {
        var self    = this;

        self._symbiontOnInit();

        self._emit('sbInited');
    },

    _onUncaughtError: function(e) {
        console.exception(e);
    }
});

/******************************************************************************
 * "Private" helpers
 *
 */

/** @brief  Retrieve the most recent browser window.
 *
 *  @return The most recent browser window.
 */
function getMostRecentWindow()
{
    var window = Mediator.getMostRecentWindow( BROWSER );

    /*
    console.log("Sidebar:getMostRecentWindow(): window[",
                                        ''+window, "]");
    console.log("Sidebar:getMostRecentWindow(): window.ownerDocument[",
                                        ''+window.ownerDocument, "]");
    console.log("Sidebar:getMostRecentWindow(): window.defaultView[",
                                        ''+window.defaultView, "]");
    console.log("Sidebar:getMostRecentWindow(): window.content[",
                                        ''+window.content, "]");

    window = (window.content
                ? window.content
                : (window.ownerDocument
                    ? window.ownerDocument.defaultView
                    : (window.defaultView
                        ? window.defaultView
                        : window)));
    // */

    return window;
}

/** @brief  Attempt to load the CSS referenced by the provided URL.
 *  @param  url     The URL of the CSS to load;
 */
function loadCss(url)
{
    var cssUri  = ios.newURI(url, null, null);

    // Attempt to load our sidebar CSS
    try {
        sss.loadAndRegisterSheet(cssUri, sss.AGENT_SHEET);
    } catch(e) {
        console.log("Sidebar::loadCss(): Error loading CSS[", url, "]:", e);
    }
}


var rspace  = /\s+/,
    rclass  = /[\n\t\r]/g;

/** @brief  jQuery-like function to add CSS class(es) to a DOM element.
 *  @param  el      The DOM element;
 *  @param  css     The CSS class(es);
 */
function addClass(el, css)
{
    if ((! el) || (el.nodeType !== 1))  { return; }

    var names   = css.split( rspace );

    if ( (! el.className) && (names.length === 1) )
    {
        el.className = css;
    }
    else
    {
        var newCss = ' '+ el.className +' ';

        names.forEach(function(name) {
            if ( !~newCss.indexOf(' '+ name +' '))
            {
                newCss += name +' ';
            }
        });

        el.className = newCss.trim();
    }
}

/** @brief  jQuery-like function to remove CSS class(es) from a DOM element.
 *  @param  el      The DOM element;
 *  @param  css     The CSS class(es);
 */
function removeClass(el, css)
{
    if ((el.nodeType !== 1) || (! el.className))    { return; }

    var names   = (css || '').split( rspace ),
        newCss  = (' '+ el.className +' ').replace(rclass, ' ');

    names.forEach(function(name) {
        newCss = newCss.replace(' '+ name +' ', ' ');
    });

    el.className = newCss.trim();
}
