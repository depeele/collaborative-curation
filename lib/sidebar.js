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
                            .getService(Ci.nsIIOService),
    chromeCss       = data.url('css/chrome-sidebar.css'),
    chromeCssUri    = ios.newURI(chromeCss, null, null);

// Attempt to load our sidebar CSS
try {
    sss.loadAndRegisterSheet(chromeCssUri, sss.AGENT_SHEET);
} catch(e) {
    console.log("Sidebar::_render(): Error loading CSS:", e);
}

/** @brief  Retrieve the most recent browser window.
 *
 *  @return The most recent browser window.
 */
function getMostRecentWindow()
{
    var window = Mediator.getMostRecentWindow( BROWSER );

    /*
console.log("Sidebar:getMostRecentWindow(): window[", ''+window, "]");
console.log("Sidebar:getMostRecentWindow(): window.ownerDocument[", ''+window.ownerDocument, "]");
console.log("Sidebar:getMostRecentWindow(): window.defaultView[", ''+window.defaultView, "]");
console.log("Sidebar:getMostRecentWindow(): window.content[", ''+window.content, "]");

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

/** @brief  Add a curation sidebar to the most recent window.
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
        postMessage:    '_symbiontPostMessage'
    }), {
    _emit:              Symbiont.required,

    on:                 Symbiont.required,
    destroy:            Symbiont.required,

    constructor: function(options) {
        var self    = this;

        self.on('error',    self._onUncaughtError.bind(self));

        self.window           = getMostRecentWindow();
        self.window.__sidebar = self;

        //console.log("Sidebar:constructor: window:", self.window);

        self.options = options || {};
        self.options.title      = self.options.title      || 'sidebar';
        self.options.contentURL = self.options.contentURL || 'about:blank';

        if (! self.options.allow)        { self.options.allow = {}; }
        if (! self.options.allow.script) { self.options.allow.script = true; }

        self.hidden    = true;
        self.destroyed = false;

        self._render();

        /* Initialize the Symbiont.  This will take care of loading the content
         * frame (identified in _render()) and attaching a content Worker.
         */
        self._symbiontInit( self.options );

        return self;
    },

    toggle: function() {
        if (this.hidden)    { this.show(); }
        else                { this.hide(); }
    },

    isHidden: function() {
        return (this.hidden);
    },

    hide: function() {
        var self    = this;

        if (self.hidden)    { return self; }

        self.sbBox.setAttribute(     'hidden', true);
        self.sbSplitter.setAttribute('hidden', true);

        self.hidden = true;

        self.postMessage({name:'sidebar', action:'hide'});

        return self;
    },

    show: function(data) {
        var self    = this;

        if (! self.hidden)  { return self; }
        if (! self._contentWorker)
        {
            return self.once('sbInited', self.show.bind(self));
        }

        self.sbTitle.setAttribute('value', self.options.title);

        self.sbBox.setAttribute(     'hidden', false);
        self.sbSplitter.setAttribute('hidden', false);

        self.hidden  = false;

        self.postMessage({name:'sidebar', action:'show'});

        return self;
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
        var mainBrowser = $('browser'),
            end         = $('browser-border-end'),
            splitter    = xul('splitter'),
            vbox        = xul('vbox'),
            header      = xul('sidebarheader'),
            title       = xul('label'),
            close       = xul('toolbarbutton'),
            browser     = xul('browser');

        /* :NOTE: No docShell will be attached UNLESS we create these elements
         *        as NOT hidden.
         */
        splitter.setAttribute('id',         'curation-sidebar-splitter');
        splitter.setAttribute('class',      'chromeclass-extrachrome');
        splitter.setAttribute('hidden',     false);
        mainBrowser.insertBefore(splitter, end);

        vbox.setAttribute(    'id',         'curation-sidebar-box');
        vbox.setAttribute(    'hidden',     false);
        vbox.setAttribute(    'persist',    'width');
        vbox.setAttribute(    'class',      'chromeclass-extrachrome');
        vbox.setAttribute(    'style',      'width:20em;');
        vbox.setAttribute(    'src',        self.options.contentURL);
        mainBrowser.insertBefore(vbox,     end);

        header.setAttribute(  'id',         'curation-sidebar-header');
        header.setAttribute(  'align',      'center');
        vbox.appendChild( header );

        title.setAttribute(   'id',         'curation-sidebar-title');
        title.setAttribute(   'persist',    'value');
        title.setAttribute(   'crop',       'end');
        title.setAttribute(   'flex',       1);
        header.appendChild( title );

        /*
        close.setAttribute(   'class',      'tabs-closebutton');
        close.setAttribute(   'tooltiptext','close');
        header.appendChild( close );
        // */

        browser.setAttribute( 'id',         'curation-sidebar');
        browser.setAttribute( 'type',       'content');
        browser.setAttribute( 'autoscroll', false);
        browser.setAttribute( 'disablehistory', true);
        browser.setAttribute( 'flex',       1);
        browser.setAttribute( 'src',        self.options.contentURL);
        vbox.appendChild( browser );

        self.sbSplitter = splitter;
        self.sbBox      = vbox;
        self.sbTitle    = title;
        self.sbBrowser  = browser;

        self.options.frame = self.sbBrowser;

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
