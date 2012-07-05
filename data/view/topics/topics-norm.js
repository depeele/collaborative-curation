var $           = window.$ || unsafeWindow.$,
    proxy       = self;
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
 ****************************************************************************/

/** @brief  The item currently being dragged (if initiated by our view). */
var gDragging   = null;

/** @brief  A Backbone View for Topics
 */
var TopicsView  = Backbone.View.extend({
    events:     {
        'keydown input.new-topic':      'topicAddKey',

        'click a':                      'openInTab',
        'click .toggle':                'toggleItem',
        'click .curation-topic > h1':   'toggleItem',

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
        self.$topicInput = self.$el.find('> input');
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
                    topic:  val,
                    pages:  []
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

        console.log("Visit %s", $a.attr('href'));

        /* Post that we're ready
        proxy.postMessage({
            name:   'sidebar',
            action: 'visit',
            url:    $a.attr('href')
        });
        // */
    },

    toggleItem: function(e) {
        var self    = this,
            $toggle = $(e.target),
            $li     = $toggle.parents('li:first');

        if ($toggle.prop('tagName') == 'H1')
        {
            $toggle = $li.find('.toggle');
        }

        console.log("toggleItem");

        var title   = $toggle.attr('title');

        e.preventDefault();
        e.stopPropagation();

        if ($li.hasClass('collapsed'))
        {
            $li.removeClass('collapsed');
            $li.find('> ul').slideDown(function() {
                $toggle.attr('title', title.replace('expand', 'collapse'));
            });
        }
        else
        {
            $li.find('> ul').slideUp(function() {
                $li.addClass('collapsed');
                $toggle.attr('title', title.replace('collapse', 'expand'));
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
                console.log("Template error:", e.message,
                            ", html[", html, "]");
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

    /** @brief  Render this topic.
     */
    render: function() {
        var self    = this,
            topic   = self.options.model;
        if (! topic)    { return; }

        var $topic  = $( self.template(topic) ),
            $pages  = $topic.find('.curation-pages');

        self.$el.attr('draggable', true);
        self.$el.empty();
        self.$el.append( $topic );

        self.$toggle = self.$el.find('> header .toggle');
        self.$pages  = self.$el.find('> .curation-pages');

        self.$pages.empty();

        /* Create each page and item individually so we can attach data to
         * each.
         */
        topic.pages.forEach(function(page) {
            var view    = new PageView({model: page});
            
            self.$pages.append( view.$el );
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
            self.$pages.slideDown(function() {
                self.$toggle.attr('title', title.replace('expand', 'collapse'));
            });
        }
        else
        {
            self.$pages.slideUp(function() {
                self.$el.addClass('collapsed');
                self.$toggle.attr('title', title.replace('collapse', 'expand'));
            });
        }

        return self;
    },

    /**********************
     * Drag-and-drop
     *
     */
    canDrop: function($src) {
        return ((! $src) || ($src.hasClass('curation-page')));
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
            $tgt        = $(e.target).closest('.curation-topic'+
                                                (gDragging
                                                    ? ',.curation-page'
                                                    : '')),
            dragCount   = ($tgt.data('drag-count') || 0);

        if ($src)
        {
            if (! self.canDrop($src))
            {
                // Propagate this event up to our parent
                return;
            }

            // /*
            var $srcTags   = $src.parent().find( '> '+ $src.prop('tagName') );
            console.log("TopicView::dragEnter: src[ %s-%d.%s ]",
                        $src.prop('tagName'),
                        $srcTags.index($src),
                        $src.attr('class'));
            // */
        }
        else
        {
            console.log("TopicView::dragEnter: EXTERNAL item: %s.%s",
                        $tgt.prop('tagName'), $tgt.attr('class'));
        }

        $('.drag-over').removeClass('drag-over');
        $tgt.addClass('drag-over');
        $tgt.data('drag-count', dragCount+1);

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
    },
    dragLeave: function(e) {
        var self        = this,
            $src        = gDragging,
            $tgt        = $(e.target).closest('.curation-topic'+
                                                (gDragging
                                                    ? ',.curation-page'
                                                    : '')),
            dragCount   = ($tgt.data('drag-count') || 1) - 1;

        if ((dragCount < 1) && self.canDrop($src))
        {
            // /*
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

            $tgt.removeClass('drag-over');

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
        console.log("TopicView::dragDrop: src[ %s-%d.%s ]",
                    $src.prop('tagName'),
                    $srcTags.index($src),
                    $src.attr('class'));
        // */

        var $tgt    = $(e.target).closest('.curation-page,.curation-topic');
        if (! gDragging)
        {
            /* The user is dragging an "external", non-sidebar node.
             *
             * See if there is already a Page entry for the source page.
             *  - no  - create a new page entry
             */
            var srcUrl      = 'url://of.source/page',
                selector    = '.curation-page > header a[href="'
                            +   srcUrl.replace(/([^\\])'/g, '$1\\\'')
                            +                                   '"]',
                $page, view;
            try {
                $page = self.$el.find( selector );
                $page = $page.parents('.curation-page:first');
            } catch(e) {
                console.log("ERROR: ", e);
            }

            if ($page && ($page.length < 1))
            {
                // Create a new page entry
                var page    = {
                        url:        srcUrl,
                        title:      "Page Title",
                        timestamp:  (new Date()).getTime(),
                        comments:   [],
                        items:      []
                    },
                    view    = new PageView({model: page});
            
                self.$pages.append( view.$el );

                $page = view.$el;
            }
            else if ($page)
            {
                view = $page.data('PageView');
            }

            if (view)
            {
                /* Create a new entry based upon this node and add it to the
                 * page entry.
                 */
                var item    = {
                        location:   'inter-page selector',
                        timestamp:  (new Date()).getTime(),
                        content:    dataTransfer.getData('text/html'),
                        comments:   []
                    };

                console.log("TopicView::dragDrop(): Drop new item at %s.%s: %s",
                            $tgt.prop('tagName'), $tgt.attr('class'),
                            JSON.stringify(item));

                // Add a new item.
                view.addItem(item);
            }
        }
        else
        {
            if ($tgt.hasClass('curation-page'))
            {
                $src.insertAfter( $tgt );
            }
            else
            {
                self.$pages.append( $src );
            }
        }

        /* Directly remove the 'drag-over' class on $tgt since 'dragleave' will
         * NOT be triggerd on the target element.
         */
        $('.drag-over').removeClass('drag-over');

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
    }
});

/** @brief  A Backbone View for a single Page
 */
var PageView    = Backbone.View.extend({
    tagName:    'li',
    className:  'curation-page',

    events:     {
        'click .toggle':                'toggle',

        'render':                       'render',

        // Drag-and-drop
        'dragover':                     'dragOver',
        'dragenter':                    'dragEnter',
        'dragleave':                    'dragLeave',

        'drop':                         'dragDrop'
    },

    template:   '#curation-page',

    /** @brief  Initialize a new instances.
     */
    initialize: function() {
        var self    = this;

        if (_.isString( self.template ))
        {
            // Resolve our template
            var html    = $(self.template).html();
            try {
                //PageView.prototype.template = _.template( html );
                self.__proto__.template = _.template( html );
            } catch(e) {
                console.log("Template error:", e.message,
                            ", html[", html, "]");
            }
        }

        self.$el.data('PageView', self);

        if (self.options.model)
        {
            // Trigger an initial rendering
            self.render();
        }
    },

    /** @brief  Set a new model and trigger a (re)render.
     *  @param  model   A Page model of the form:
     *                      {url:       url,
     *                       title:     title,
     *                       timestamp: timestamp,
     *                       content:   content,
     *                       items:     []}
     */
    setModel: function(model) {
        var self    = this;

        self.options.model = model;

        self.render();

        return self;
    },

    /** @brief  Add a new item to this Page entry.
     *  @param  item    An Item model of the form:
     */
    addItem: function(item) {
        var self    = this,
            page    = self.options.model;
        if (! page) { return; }

        page.items.push(item);

        // Create a new ItemView and append it to the list of page items
        var view    = new ItemView({model: item});
        self.$items.append( view.$el );

        if (page.items.length > 0)
        {
            self.$el.addClass('collapsable');
        }

        return self;
    },

    /** @brief  Render this page.
     */
    render: function() {
        var self    = this,
            page    = self.options.model;
        if (! page) { return; }

        var $page   = $( self.template(page) );

        self.$el.attr('draggable', true);
        self.$el.empty();
        self.$el.append( $page );

        self.$toggle = self.$el.find('> header .toggle');
        self.$items  = self.$el.find('> .curation-items');

        self.$items.empty();

        /* Create each item individually so we can attach data to
         * each.
         */
        page.items.forEach(function(item) {
            var view    = new ItemView({model: item});
            
            self.$items.append( view.$el );
        });

        if (page.items.length > 0)
        {
            self.$el.addClass('collapsable');
        }

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

        console.log("PageView::toggle()");

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
     *
     */
    canDrop: function($src) {
        var self    = this;

        return ($src &&
                ($src.hasClass('curation-item') &&
                 ($src.closest('.curation-page').get(0) === self.$el.get(0))) );
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
            $tgt        = $(e.target).closest('.curation-page,.curation-item'),
            dragCount   = ($tgt.data('drag-count') || 0);

        if ($src)
        {
            if (! self.canDrop($src))
            {
                // Propagate this event up to our parent
                return;
            }

            // /*
            var $srcTags   = $src.parent().find( '> '+ $src.prop('tagName') );
            console.log("PageView::dragEnter: src[ %s-%d.%s ]",
                        $src.prop('tagName'),
                        $srcTags.index($src),
                        $src.attr('class'));
            // */
        }
        else
        {
            console.log("PageView::dragEnter: EXTERNAL item: %s.%s",
                        $tgt.prop('tagName'), $tgt.attr('class'));
        }

        $('.drag-over').removeClass('drag-over');
        $tgt.addClass('drag-over');
        $tgt.data('drag-count', dragCount+1);

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
    },
    dragLeave: function(e) {
        var self        = this,
            $src        = gDragging,
            $tgt        = $(e.target).closest('.curation-page,.curation-item'),
            dragCount   = ($tgt.data('drag-count') || 1) - 1;

        if ((dragCount < 1) && self.canDrop($src))
        {
            // /*
            if ($src)
            {
                var $srcTags   = $src.parent()
                                        .find( '> '+ $src.prop('tagName') );
                console.log("PageView::dragLeave: src[ %s-%d.%s ]: %d",
                            $src.prop('tagName'),
                            $srcTags.index($src),
                            $src.attr('class'),
                            dragCount);
            }
            // */

            $tgt.removeClass('drag-over');
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
        console.log("PageView::dragDrop: src[ %s-%d.%s ]",
                    $src.prop('tagName'),
                    $srcTags.index($src),
                    $src.attr('class'));
        // */

        var $tgt    = $(e.target).closest('.curation-page,.curation-item');
        if ($tgt.hasClass('curation-item'))
        {
            $src.insertAfter( $tgt );
        }
        else
        {
            self.$items.append( $src );
        }

        /* Directly remove the 'drag-over' class on $tgt since 'dragleave' will
         * NOT be triggerd on the target element.
         */
        $('.drag-over').removeClass('drag-over');
        self.dragCount = 0;

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
                console.log("Template error:", e.message,
                            ", html[", html, "]");
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
     *                      {location:  inter-page selector,
     *                       timestamp: timestamp,
     *                       content:   content,
     *                       items:     []}
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


/** @brief  Handle a postMessage()
 *  @param  msg     The message data:
 *                      {action: *action*, action-secific-data}
 *                          Valid actions:
 *                              'load', topics:[]
proxy.on('message', function(msg) {

    console.log("js/topics-sidebar.js: message ", JSON.stringify(msg));

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
 */

$(document).ready(function() {
    //console.log("js/topics-sidebar.js: Document Ready.");

    // Establish our mainView
    var $curation   = $('#collaborative-curation');

    mainView = new TopicsView({el: $curation});
    $curation.data('view', mainView);

    /* Post that we're ready
    proxy.postMessage({
        name:   'sidebar',
        action: 'loaded',
        url:    'js/topics-sidebar.js'
    });
    // */

    $curation.on('load', function(e, msg) {
        mainView.setModel( msg.topics );
    });
});

//console.log("js/topics-sidebar.js loaded");
