var root        = window || unsafeWindow,
    $           = root.$,
    proxy       = null;
    mainView    = null;

// Ensure that Backbone has a proper reference to jQuery
Backbone.setDomLibrary($);

/****************************************************************************
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
 ****************************************************************************
 * Logging {
 *
 */

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
    if (! _.isArray(args))
    {
        args = Array.prototype.slice.call(arguments).slice(1);
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

/** @brief  Perform printf-like formatting of the provided 'fmt' and 'args' and
 *          write the result to the console.
 *  @param  fmt     The printf format string;
 *  @param  args    Following arguments to fulfill 'fmt';
 */
function log(fmt, args)
{
    args = Array.prototype.slice.call(arguments);

    console.log( sprintf.apply(root, args) );
}
/* Logging }
 ****************************************************************************/

/** @brief  The item currently being dragged (if initiated by our view). */
var gDragging   = null;

/** @brief  A Backbone View for Topics
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

        // Cache element references
        self.$topicInput = self.$el.find('.new-topic');
        self.$topics     = self.$el.find('.curation-topics');

        if (self.options.model)
        {
            // Trigger an initial rendering
            self.render();
        }
    },

    /** @brief  Set a new model and trigger a (re)render.
     *  @param  model   An array of Topic records, each of the form:
     *                      {topic: topic,
     *                       pages: []}
     *
     *                  Each page has the form:
     *                      {url:       url,
     *                       title:     title,
     *                       timestamp: timestamp,
     *                       content:   content,
     *                       items:     []}
     *
     *                  Each item has the form:
     *                      {location:  intra-page location,
     *                       timestamp: timestamp,
     *                       content:   content,
     *                       comments:  [ comments ] or commentCount
     *                      }
     */
    setModel: function(model) {
        var self    = this;

        self.options.model = model;

        self.render();

        return self;
    },

    /** @brief  Render the given set of topics.
     */
    render: function() {
        var self    = this;
        if (! self.options.model)   { return; }

        self.$topics.empty();
        self.options.model.forEach(function(topic) {
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

        log("TopicsView::openInTab(): %s, %sshift, %sctrl, %salt, %smeta",
                $a.attr('href'),
                (e.shiftKey ? ' ' : '!'),
                (e.altKey   ? ' ' : '!'),
                (e.ctrlKey  ? ' ' : '!'),
                (e.metaKey  ? ' ' : '!'));

        // Post that we're ready
        if (proxy)
        {
            proxy.postMessage({
                name:   'sidebar',
                action: 'visit',
                url:    $a.attr('href'),
                current:(! e.metaKey)
            });
        }
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
        log("drag start: src[ %s-%d.%s ]",
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
        log("drag end: src[ %s-%d.%s ]",
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

        'drop':                         'dragDrop'
    },

    template:   '#curation-topic',

    /** @brief  Initialize a new instances.
     */
    initialize: function() {
        var self    = this;

        if (_.isString( self.template ))
        {
            // Resolve our template
            var html    = $(self.template).html();
            try {
                //TopicView.prototype.template = _.template( html );
                self.__proto__.template = _.template( html );
            } catch(e) {
                log("Template error: %s, html[ %s ]", e.message, html);
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

        log("TopicView::toggle()");

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

        if (! canDrop)  { return; }

        dataTransfer.dropEffect = 'move';
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
            log("TopicView::dragEnter: src[ %s-%d.%s ]: %d",
                        $src.prop('tagName'),
                        $srcTags.index($src),
                        $src.attr('class'),
                        dragCount);
            // */
        }
        /*
        else
        {
            log("TopicView::dragEnter: EXTERNAL item: %s.%s: %d",
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
                log("TopicView::dragLeave: src[ %s-%d.%s ]: %d",
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

        // /*
        var $srcTags   = $src.parent().find( '> '+ $src.prop('tagName') );
        log("TopicView::dragDrop: src[ %s-%d.%s ]",
                    $src.prop('tagName'),
                    $srcTags.index($src),
                    $src.attr('class'));
        // */

        var $tgt    = $(e.target).closest(
                        (! gDragging || gDragging.hasClass('curation-item')
                            ? '.curation-item,.curation-topic'
                            : '.curation-topic'));
        if (! gDragging)
        {
            /* Dropping an "External" item.
             *
             * Type-based Heuristic:
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
            log("TopicView::dragDrop: dataTransfer types:");
            _.each(dataTransfer.types, function(type) {
                log("TopicView::dragDrop:   %s: %s",
                            type, dataTransfer.getData(type));
            });

            var types   = [].slice.call(dataTransfer.types, 0),
                items   = [];
            if (dataTransfer.files && (dataTransfer.files.length > 0))
            {
                // Create an entry for each file
                _.each(dataTransfer.files, function(file) {
                    var url         = 'file://'+ file.mozFullPath,
                        title       = file.name,
                        selector    = '';

                    items.push({
                        timestamp:  (new Date()).getTime(),
                        content:    '<a href="'+ url +'">'+ title +'</a>',
                        url:        url,
                        selector:   selector,
                        topicId:    self.options.model.id,
                        order:      '',
                        comments:   []
                    });
                });
            }
            else if (types.indexOf('text/x-moz-place') >= 0)
            {
                // Bookmark entry {title, url} (could also use 'text/html')
                var data        = JSON.parse(
                                    dataTransfer.getData('text/x-moz-place')),
                    url         = data.uri,
                    title       = data.title,
                    selector    = '';

                items.push({
                    timestamp:  (new Date()).getTime(),
                    content:    '<a href="'+ url +'">'+ title +'</a>',
                    url:        url,
                    selector:   selector,
                    topicId:    self.options.model.id,
                    order:      '',
                    comments:   []
                });
            }
            else if ((types.indexOf('text/x-moz-url') >= 0) &&
                     (types.indexOf('text/_moz_htmlcontext') < 0))
            {
                /* URL from address bar
                 *  use 'text/x-moz-url', splitting the URL from the title
                 */
                var data        = dataTransfer.getData('text/x-moz-url'),
                    parts       = data.split("\n");

                for (var idex = 0, len = parts.length; idex < len; idex += 2)
                {
                    var url         = parts[idex],
                        title       = parts[idex+1],
                        selector    = '';

                    items.push({
                        timestamp:  (new Date()).getTime(),
                        content:    '<a href="'+ url +'">'+ title +'</a>',
                        url:        url,
                        selector:   selector,
                        topicId:    self.options.model.id,
                        order:      '',
                        comments:   []
                    });
                }
            }
            else if (types.indexOf('text/html') >= 0)
            {
                /* Use the dropped HTML
                 *
                 *  :TODO: Grab the page URL (via tabs)
                 *         and generate the page selector.
                 */
                var data        = dataTransfer.getData('text/html'),
                    url         = 'url://of.source/page',
                    selector    = '#content > .selector';

                items.push({
                    timestamp:  (new Date()).getTime(),
                    content:    data,
                    url:        url,
                    selector:   selector,
                    topicId:    self.options.model.id,
                    order:      '',
                    comments:   []
                });
            }
            // else, IGNORE (by NOT adding anyting to items)

            // Create new item(s) add them to the item list.
            var $after  = ($tgt.hasClass('curation-item')
                            ? $tgt
                            : self.$items.children().last());
            _.each(items, function(item) {
                var view    = new ItemView({model:item});
                view.$el.insertAfter( $after );

                $after = view.$el;
            });
        }
        else if ($tgt.get(0) !== $src.get(0))
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

        if (_.isString( self.template ))
        {
            // Resolve our template
            var html    = $(self.template).html();
            try {
                //ItemView.prototype.template = _.template( html );
                self.__proto__.template = _.template( html );
            } catch(e) {
                log("Template error: %s, html[ %s ]", e.message, html);
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

if (proxy)
{
    /** @brief  Handle a postMessage()
     *  @param  msg     The message data:
     *                      {action: *action*, action-secific-data}
     *                          Valid actions:
     *                              'load', topics:[]
     */
    proxy.on('message', function(msg) {

        log("js/topics-sidebar.js: message %j", msg);

        switch (msg.action)
        {
        case 'load':

            if (mainView)
            {
                mainView.render(msg.topics);
            }
            break;
        }
    });
}

$(document).ready(function() {
    //log("js/topics-sidebar.js: Document Ready.");

    // Establish our mainView
    var $curation   = $('#collaborative-curation');

    mainView = new TopicsView({el: $curation});
    $curation.data('view', mainView);

    // Post that we're ready
    if (proxy)
    {
        proxy.postMessage({
            name:   'sidebar',
            action: 'loaded',
            url:    'js/topics-sidebar.js'
        });
    }
    else
    {
        $curation.on('load', function(e, msg) {
            mainView.setModel( msg.topics );
        });
    }
});

//log("js/topics-sidebar.js loaded");
