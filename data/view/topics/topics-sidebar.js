/** @brief  The item currently being dragged
 *              (if initiated by a view in *this* script).
 */
var gDragging   = null;

/** @brief  A Backbone View for a list of Topics.  This is the primary view.
 */
var TopicsView  = Backbone.View.extend({
    events:     {
        'keydown input.new-topic':      'topicAddKey',

        'click a':                      'openInTab',

        'render':                       'render',

        // Drag-and-drop
        'dragstart li':                 'dragStart',
        'dragend   li':                 'dragEnd'
    },

    /** @brief  Initialize a new instances.
     */
    initialize: function() {
        var self    = this;

        self.$el.data('view', self);

        // Cache element references
        self.$topicInput = self.$el.find('.new-topic');
        self.$topics     = self.$el.find('.curation-topics');

        // Listen for 'message' events from the addon.
        addon.on('message', self.addonMessage.bind(self));

        if (self.options.model)
        {
            // We've been given data directly, render immediately.
            self.render();
        }
        else
        {
            /* We've not been given any data to render.
             *
             * Notify the addon that we're ready and wait for data to render.
             */
            addon.postMessage({
                src:    'sidebar-content',
                action: 'loaded',
                url:    'js/topics-sidebar.js'
            });
        }
    },

    /** @brief  Handle an incoming message from the addon.
     *  @param  msg     The message data:
     *                      {action: *action*, action-secific-data}
     *                          Valid actions:
     *                              'load',         topics:[]
     *                              'currentUrl',   url:'...'
     */
    addonMessage: function(msg) {
        var self    = this;

        switch (msg.action)
        {
        case 'load':
            console.log("TopicsView:addonMessage(): "
                        +   "'setModel' from[ %s ], %d topics",
                        msg.src, msg.topics.length);

            self.setModel( msg.topics );
            break;

        case 'currentUrl':
            console.log("TopicsView:addonMessage(): "
                        +   "'currentUrl' from[ %s ], url[ %s ]",
                        msg.src, msg.url);

            self.currentUrl( msg.url );
            break;

        default:
            console.log("TopicsView:addonMessage(): unhandled message %j",
                        msg);
            break;
        }
    },

    /** @brief  Set a new model and trigger a (re)render.
     *  @param  model   An array of Topic records, each of the form:
     *                      {title: topic,
     *                       items: []}
     */
    setModel: function(model) {
        var self    = this;

        self.options.model = model;

        self.render();

        return self;
    },

    /** @brief  Used by main to communicate the URL of the currently active
     *          tab.
     *  @param  url     The url;
     */
    currentUrl: function(url) {
        var self    = this;

        //console.log("TopicsView::currentUrl(): url[ %s ]", url);

        self._currentUrl = url;

        return self;
    },

    /** @brief  Render the given set of topics.
     */
    render: function() {
        var self    = this,
            topics  = self.options.model;
        if (! topics)   { return; }

        console.log("TopicsView::render(): %d topics", topics.length);

        self.$topics.empty();
        topics.forEach(function(topic) {
            var view    = new TopicView({model: topic});

            self.$topics.append( view.$el );
        });

        return self;
    },

    /************************************************************************
     * Event handlers
     *
     */
    topicAddKey: function(e) {
        var self    = this,
            val     = self.$topicInput.val();

        if ((e.which === 13) && (val.length > 0))
        {
            // Add a new topic
            var topic   = {
                    title:  val,
                    items:  []
                },
                view    = new TopicView({model: topic});

            self.$topics.append( view.$el );

            self.$topicInput.val('');
            self.$topicInput.blur();

            e.preventDefault();
            e.stopPropagation();
        }
    },

    openInTab: function(e) {
        var self    = this,
            $a      = $(e.target);

        e.preventDefault();
        e.stopPropagation();

        console.log("TopicsView::openInTab(): "
                    +   "%s, %sshift, %sctrl, %salt, %smeta",
                $a.attr('href'),
                (e.shiftKey ? ' ' : '!'),
                (e.altKey   ? ' ' : '!'),
                (e.ctrlKey  ? ' ' : '!'),
                (e.metaKey  ? ' ' : '!'));

        // Post that we're ready
        addon.postMessage({
            src:    'sidebar-content',
            action: 'visit',
            url:    $a.attr('href'),
            current:(! e.metaKey)
        });
    },

    /**********************
     * Drag-and-drop
     *
     */
    dragStart: function(e) {
        var self            = this,
            dataTransfer    = (e.dataTransfer
                                ? e.dataTransfer
                                : e.originalEvent.dataTransfer);

        if (! dataTransfer) { return; }

        var $src    = $(e.target);
        if (! $src.attr('draggable'))
        {
            // Immediate propagate up to the top-level 'draggable'
            $src = $src.parents('[draggable]:first');
        }

        /*
        var $tags   = $src.parent().find( $src.prop('tagName') );
        console.log("drag start: src[ %s-%d.%s ]",
                    $src.prop('tagName'),
                    $tags.index($src),
                    $src.attr('class'));
        // */

        $src.addClass('dragging');
        gDragging  = $src;

        //dataTransfer.effectAllowed = 'move';
        dataTransfer.setData('text/html', $src.html());
        dataTransfer.setData('application/x-moz-node', $src[0]);
    },
    dragEnd: function(e) {
        var self    = this,
            $src    = (gDragging ? gDragging : $(e.target));

        /*
        var $tags   = $src.parent().find( $src.prop('tagName') );
        console.log("drag end: src[ %s-%d.%s ]",
                    $src.prop('tagName'),
                    $tags.index($src),
                    $src.attr('class'));
        // */

        $src.removeClass('dragging');

        gDragging  = null;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
    }
});

/** @brief  A Backbone View for a single Topic
 */
var TopicView   = Backbone.View.extend({
    tagName:    'li',
    className:  'curation-topic',

    events:     {
        'click .toggle':                'toggle',
        'click header > h1':            'toggle',

        'render':                       'render',

        // Drag-and-drop
        'dragover':                     'dragOver',
        'dragenter':                    'dragEnter',
        'dragleave':                    'dragLeave',

        'drop':                         'dragDrop',

        'dropExternal':                 'dragDropExternal'
    },

    template:   '#curation-topic',

    /** @brief  Initialize a new instances.
     */
    initialize: function() {
        var self    = this;

        self.$el.data('view', self);

        if (_.isString( self.template ))
        {
            // Resolve our template
            var html    = $(self.template).html();
            try {
                //TopicView.prototype.template = _.template( html );
                self.__proto__.template = _.template( html );
            } catch(e) {
                console.log("Template error: %s, html[ %s ]", e.message, html);
            }
        }

        if (self.options.model)
        {
            // Trigger an initial rendering
            self.render();
        }
    },

    /** @brief  Set a new model and trigger a (re)render.
     *  @param  model   A Topic model of the form:
     *                      {id:    uid,
     *                       title: topic,
     *                       order: sort-order,
     *                       items: []}
     */
    setModel: function(model) {
        var self    = this;

        console.log("TopicView::setModel(): topic[ %s ], %d items",
                model.title, model.items.length);

        self.options.model = model;

        self.render();

        return self;
    },

    /** @brief  Render this topic.
     */
    render: function() {
        var self    = this,
            topic   = self.options.model;
        if (! topic)    { return; }

        var $topic  = $( self.template(topic) );

        self.$el.attr('draggable', true);
        self.$el.empty();
        self.$el.append( $topic );

        self.$toggle = self.$el.find('> header .toggle');
        self.$items  = self.$el.find('> .curation-items');

        self.$items.empty();

        /* Create each page and item individually so we can attach data to
         * each.
         */
        topic.items.forEach(function(item) {
            var view    = new ItemView({model: item});
            
            self.$items.append( view.$el );
        });

        return self;
    },

    /************************************************************************
     * Event handlers
     *
     */

    /** @brief  Toggle this topic opened/closed.
     */
    toggle: function(e) {
        var self    = this;

        if (_.isEmpty(self.$toggle))  { return; }

        console.log("TopicView::toggle()");

        var title   = self.$toggle.attr('title');

        if (e)
        {
            e.preventDefault();
            e.stopPropagation();
        }

        if (self.$el.hasClass('collapsed'))
        {
            self.$el.removeClass('collapsed');
            self.$items.slideDown(function() {
                self.$toggle.attr('title', title.replace('expand', 'collapse'));
            });
        }
        else
        {
            self.$items.slideUp(function() {
                self.$el.addClass('collapsed');
                self.$toggle.attr('title', title.replace('collapse', 'expand'));
            });
        }

        return self;
    },

    /**********************
     * Drag-and-drop
     *  .curation-item
     *  or "external" item
     *
     */
    canDrop: function($src) {
        return ((! $src) || $src.hasClass('curation-item')
                         || $src.hasClass('curation-topic'));
    },
    dragOver: function(e) {
        var self            = this,
            dataTransfer    = (e.dataTransfer
                                ? e.dataTransfer
                                : e.originalEvent.dataTransfer),
            $src            = gDragging,
            canDrop         = (dataTransfer && self.canDrop($src));

        console.log("TopicView::dragOver()");

        if (! canDrop)  { return; }

        dataTransfer.dropEffect = (gDragging ? 'move' : 'copy');
        e.preventDefault();
    },
    dragEnter: function(e) {
        var self        = this,
            $src        = gDragging,
            $tgt        = $(e.target).closest(
                            (! $src || $src.hasClass('curation-item')
                                ? '.curation-item,.curation-topic'
                                : '.curation-topic')),
            dragCount   = ($tgt.data('drag-count') || 0) + 1;

        if ($src)
        {
            if (! self.canDrop($src))
            {
                // Propagate this event up to our parent
                return;
            }

            /*
            var $srcTags   = $src.parent().find( '> '+ $src.prop('tagName') );
            console.log("TopicView::dragEnter: src[ %s-%d.%s ]: %d",
                        $src.prop('tagName'),
                        $srcTags.index($src),
                        $src.attr('class'),
                        dragCount);
            // */
        }
        /*
        else
        {
            console.log("TopicView::dragEnter: EXTERNAL item: %s.%s: %d",
                        $tgt.prop('tagName'), $tgt.attr('class'), dragCount);
        }
        // */

        $('.drag-over').removeClass('drag-over')
                       .removeData('drag-count');
        $tgt.addClass('drag-over');
        $tgt.data('drag-count', dragCount);

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
    },
    dragLeave: function(e) {
        var self        = this,
            $src        = gDragging,
            $tgt        = $(e.target).closest(
                            (! $src || $src.hasClass('curation-item')
                                ? '.curation-item,.curation-topic'
                                : '.curation-topic')),
            dragCount   = ($tgt.data('drag-count') || 1) - 1;

        if (dragCount < 1)
        {
            /*
            if ($src)
            {
                var $srcTags   = $src.parent()
                                        .find( '> '+ $src.prop('tagName') );
                console.log("TopicView::dragLeave: src[ %s-%d.%s ]: %d",
                            $src.prop('tagName'),
                            $srcTags.index($src),
                            $src.attr('class'),
                            dragCount);
            }
            // */

            $tgt.removeClass('drag-over')
                .removeData('drag-count');
        }

        $tgt.data('drag-count', (dragCount > 0 ? dragCount : 0));

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
    },

    dragDrop: function(e) {
        var self            = this,
            dataTransfer    = (e.dataTransfer
                                ? e.dataTransfer
                                : e.originalEvent.dataTransfer);
        if (! dataTransfer) { return; }

        if (! self.canDrop( gDragging ))    { return; }

        var $src    = (gDragging || $(dataTransfer.mozSourceNode));
        if (! $src) { return; }

        var $tgt    = $(e.target).closest(
                        (! gDragging || gDragging.hasClass('curation-item')
                            ? '.curation-item,.curation-topic'
                            : '.curation-topic'));

        /*
        var $srcTags   = $src.parent().find( '> '+ $src.prop('tagName') ),
            $tgtTags   = $tgt.parent().find( '> '+ $tgt.prop('tagName') );

        console.log("TopicView::dragDrop: src[ %s-%d.%s ]",
                    $src.prop('tagName'),
                    $srcTags.index($src),
                    $src.attr('class'));
        console.log("TopicView::dragDrop: tgt[ %s-%d.%s ]",
                    $tgt.prop('tagName'),
                    $tgtTags.index($tgt),
                    $tgt.attr('class'));
        // */

        /* :NOTE:
         *  The drop of an external item is now handled by sbDrop() in the main
         *  sidebar view where the dataTransfer object is normalized and
         *  attached to a new, custom 'dropExternal' event.  The original
         *  'drop' event *should have been* canceled and the new 'dropExternal'
         *  event fired.
         *
         *  If that's working correctly, we should *never* reach this point
         *  without a valid in 'gDragging'.
         */
        if (! gDragging)
        {
            console.log("TopicView::dragDrop: *** gDragging shouldn't be null");
            return;
        }

        if ($tgt.get(0) !== $src.get(0))
        {
            if ($tgt.hasClass('curation-item') ||
                $src.hasClass('curation-topic'))
            {
                $src.insertAfter( $tgt );
            }
            else
            {
                self.$items.append( $src );
            }
        }

        /* Directly remove the 'drag-over' class on $tgt since 'dragleave' will
         * NOT be triggerd on the target element.
         */
        $('.drag-over').removeClass('drag-over')
                       .removeData('drag-count');

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
    },

    /** @brief  Handle the custom 'dropExternal' event triggered by the main
     *          sidebar view when an external resource is dropped.
     *
     *  This custom event should have a normalized dataTransfer object in
     *  'detail'.
     */
    dragDropExternal: function(e) {
        var self            = this,
            event           = (e.detail
                                ? e
                                : e.originalEvent),
            dataTransfer    = event.detail;
        if (! dataTransfer) { return; }

        console.log("TopicView::dragDropExternal: dataTransfer: %j",
                    dataTransfer);

        var $tgt    = $(e.target).closest(
                        (! gDragging || gDragging.hasClass('curation-item')
                            ? '.curation-item,.curation-topic'
                            : '.curation-topic'));

        /*
        var $tgtTags   = $tgt.parent().find( '> '+ $tgt.prop('tagName') );

        console.log("TopicView::dragDrop: tgt[ %s-%d.%s ]",
                    $tgt.prop('tagName'),
                    $tgtTags.index($tgt),
                    $tgt.attr('class'));
        // */

        var $after  = ($tgt.hasClass('curation-item')
                        ? $tgt
                        : self.$items.children().last()),
            items   = dataTransfer2Items(self.options.model, dataTransfer);

        // Create new item(s) add them to the item list.
        _.each(items, function(item) {
            var view    = new ItemView({model:item});
            view.$el.insertAfter( $after );

            $after = view.$el;
        });

        /* Directly remove the 'drag-over' class on $tgt since 'dragleave' will
         * NOT be triggerd on the target element.
         */
        $('.drag-over').removeClass('drag-over')
                       .removeData('drag-count');

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
    }
});

/** @brief  A Backbone View for a single Item
 */
var ItemView    = Backbone.View.extend({
    tagName:    'li',
    className:  'curation-item',

    events:     {
        'render':                       'render'
    },

    template:   '#curation-item',

    /** @brief  Initialize a new instances.
     */
    initialize: function() {
        var self    = this;

        self.$el.data('view', self);

        if (_.isString( self.template ))
        {
            // Resolve our template
            var html    = $(self.template).html();
            try {
                //ItemView.prototype.template = _.template( html );
                self.__proto__.template = _.template( html );
            } catch(e) {
                console.log("Template error: %s, html[ %s ]", e.message, html);
            }
        }

        if (self.options.model)
        {
            // Trigger an initial rendering
            self.render();
        }
    },

    /** @brief  Set a new model and trigger a (re)render.
     *  @param  model   An Item model of the form:
     *                      {id:        uid,
     *                       timestamp: timestamp,
     *                       content:   content,
     *                       url:       source-page url,
     *                       selector:  inter-page selector,
     *                       topicId:   id of containing topic,
     *                       order:     sort order,
     *                       comments:  []}
     */
    setModel: function(model) {
        var self    = this;

        console.log("ItemView::setModel(): id[ %s ]", model.id);

        self.options.model = model;

        self.render();

        return self;
    },

    /** @brief  Render this item.
     */
    render: function() {
        var self    = this,
            item    = self.options.model;
        if (! item) { return; }

        self.$el.attr('draggable', true);
        self.$el.html( self.template(item) );

        return self;
    }

    /************************************************************************
     * Event handlers
     *
     */
});

$(document).ready(function() {
    //console.log("js/topics-sidebar.js: Document Ready.");

    // Establish our primary view
    var $curation   = $('#collaborative-curation'),
        view        = new TopicsView({el: $curation});

    $curation.data('view', view);

    /* Include a document-level 'drop' handler to take care of 'drop' events
     * that have been proxied to the sidebar document via sbDndProxy()/sbDrop()
     * in the sidebar addon as 'dropExternal' events -- most likely because an
     * item was dropped on the splitter while the sidebar was closed.
     */
    $(document).on('dropExternal', function(e) {

        /* Create a new proxied event containing the incoming 'detail'
         * (dataTransfer) data and trigger that event on the first
         * '.curation-topic'.
         */
        var proxied     = $.Event('dropExternal', {
                                    detail: e.originalEvent.detail
                                  });

        $curation.find('.curation-topic:first').trigger( proxied );
    });
});

//console.log("js/topics-sidebar.js loaded");

/****************************************************************************
 * Logging {
 *
 *  Override console.log() to send data for logging to the plugin.
 */

/** @brief  Perform printf-like formatting of the provided 'fmt' and 'args' and
 *          write the result to the console.
 *  @param  fmt     The printf format string;
 *  @param  args    Following arguments to fulfill 'fmt';
 */
console.log = function(fmt, args) {
    args = Array.slice(arguments);

    addon.postMessage({src:      'sidebar-content',
                       action:   'log',
                       str:      sprintf.apply(this, args)
                       //args:     args
    });
};

/** @brief  Perform printf-like formatting of the provided 'fmt' and 'args' and
 *          return the resulting string.
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

            str += (formatted ? formatted.toString() : '');
            pos += match.length;
        }
    }

    if (pos < fmt.length)
    {
        str += fmt.slice(pos);
    }

    return str;
}

/* Logging }
 ****************************************************************************
 * drag-and-drop {
 *
 */

/** @brief  Given a drag-and-drop dataTransfer object (that has been made
 *          client-side accessible via our addon's drag-and-drop handler),
 *          generate a matching set of items representing the raw item data.
 *  @param  topic           The topic associated with this drop;
 *  @param  dataTransfer    The dataTransfer object from a drag-and-drop Drop
 *                          request -- possibly "normalized" by the main
 *                          sidebar view and delivered via 'dropExternal'
 *                          custom event;
 *
 *  @return An array of item objects;
 */
function dataTransfer2Items(topic, dataTransfer)
{
    /* Type-based Heuristic:
     *  - 'application/x-moz-file' (or dataTransfer.files.length > 0)
     *      dropping an external file from the system
     *          use dataTransfer.files
     *              {size, type, name, mozFullPath}
     *  - 'text/x-moz-url' but no 'text/_moz_htmlcontext'
     *      dropping a URL from the address bar
     *          use 'text/x-moz-url', splitting the URL from the title
     *  - 'text/x-moz-place'
     *      dropping a bookmark entry {title, uri}
     *          use 'text/html'
     *  - 'text/html'
     *      dropping pre-formated HTML -- use it directly;
     *  - 'text/plain'
     *      dropping plain-text -- ignore??;
     */
    var items   = [],
        hasType = function(val) {
            return (dataTransfer.types.indexOf(val) >= 0);
        };

    /*
    if (hasType('application/x-moz-file'))
    {
        var data    = dataTransfer['application/x-moz-file'];

        // Create an entry for each file
        console.log("dataTransfer2Items:   %d: application/x-moz-file entries:",
                    data.length);

        _.each(data, function(file, idex) {
            console.log("dataTransfer2Items:    %d: %j", idex, file);
        });
    }
    else
    // */

    if (dataTransfer.files && (dataTransfer.files.length > 0))
    {
        // Create an entry for each file
        console.log("dataTransfer2Items:   %d: file entries:",
            dataTransfer.files.length);

        _.each(dataTransfer.files, function(file, idex) {
            console.log("dataTransfer2Items:    %d: %j", idex, file);

            var url     = 'file://'+ file.path,
                title   = file.name;

            items.push({
                timestamp:  (new Date()).getTime(),
                content:    '<a href="'+ url +'">'+ title +'</a>',
                url:        url,
                selector:   '',
                topicId:    topic.id,
                order:      '',
                comments:   []
            });
        });
    }
    else if (hasType('text/x-moz-place'))
    {
        // Bookmark entry {title, url} (could also use 'text/html')
        var data        = dataTransfer['text/x-moz-place'],
            url         = data.uri,
            title       = data.title,
            selector    = '';

        console.log("dataTransfer2Items:   text/x-moz-place: data[ %j ]", data);

        items.push({
            timestamp:  (new Date()).getTime(),
            content:    '<a href="'+ url +'">'+ title +'</a>',
            url:        url,
            selector:   selector,
            topicId:    topic.id,
            order:      '',
            comments:   []
        });
    }
    else if ( hasType('text/x-moz-url') &&
              (! hasType('text/_moz_htmlcontext')) )
    {
        /* URL from address bar
         *  use 'text/x-moz-url', splitting the URL from the title
         */
        var data        = dataTransfer['text/x-moz-url'];

        console.log("dataTransfer2Items:   %d: text-x-moz-urls "
                    +   "without _moz_htmlcontext",
                    data.length);

        _.each(data, function(entry, idex) {
            console.log("dataTransfer2Items:      %d: %j", idex, entry);

            items.push({
                timestamp:  (new Date()).getTime(),
                content:    '<a href="'+ entry.url +'">'+ entry.title +'</a>',
                url:        entry.url,
                selector:   selector,
                topicId:    topic.id,
                order:      '',
                comments:   []
            });
        });
    }
    else if (hasType('text/html'))
    {
        /* Use the dropped HTML
         *
         *  :TODO: Grab the page URL (via tabs)
         *         and generate the page selector.
         */
        var data        = dataTransfer['text/html'],
            url         = 'url://of.source/page',
            selector    = '#content > .selector';

        console.log("dataTransfer2Items:   text/html: data[ %s ]", data);

        items.push({
            timestamp:  (new Date()).getTime(),
            content:    data,
            url:        url,
            selector:   selector,
            topicId:    topic.id,
            order:      '',
            comments:   []
        });
    }
    // else, IGNORE (by NOT adding anyting to items)

    return items;
}
/* drag-and-drop }
 ****************************************************************************
 * Date Formatting utilities {
 *
 *  Called from the '#curation-topic' template applied in render().
 *  The template itself is defined in data/view/topics/index.html
 *
 */
function padNum(num, len)
{
    len = len || 2;
    num = ''+ num;

    return '00000000'.substr(0, len - num.length) + num;
}
function ts2timeStr(ts)
{
    var date        = new Date(ts),
        hour        = date.getHours(),
        meridian    = 'a';

    if      (hour >   12)   { meridian = 'p'; hour -= 12; }
    else if (hour === 12)   { meridian = 'p'; }

    return hour +':'+ padNum(date.getMinutes()) + meridian;
}
function ts2dateStr(ts)
{
    var date    = new Date(ts),
        dateStr = date.getFullYear()            +'.'
                + padNum(date.getMonth() + 1)   +'.'
                + padNum(date.getDate());

    return dateStr;
}
/* Date formatting utilities }
 ****************************************************************************/
