/** @brief  The item currently being dragged
 *              (if initiated by a view in *this* script).
 */
/*jslint nomen:false,laxbreak:true,white:false,onevar:false */
/*global addon:false,_:false,$:false,Backbone:false,console:false,document:false */

var gDragging   = null;

/** @brief  A simple, modal mini-dialog used for confirmations.
 *
 *  Accepts the following options:
 *      question        HTML of the question to present;
 *      confirm         The confirmation text [ 'yes' ];
 *      cancel          The cancellation text [ 'no' ];
 *
 *      primary         Which answer is primary? 'confirm' | [ 'cancel' ]
 *
 *      css             An object of CSS name/value pairs;
 *
 *      confirmed()     A callback to invoke if confirmed;
 *      cancelled()     A callback to invoke if cancelled;
 *
 *  Triggers events:
 *      'confirmed'
 *      'cancelled'
 */
var MiniDialog  = Backbone.View.extend({
    tagName:    'div',
    className:  'ui-confirmation',

    events: {
        'click button':     'clickButton',
        'render':           'render'
    },

    template:    '<div class="ui-question"><%= question %></div>'
               + '<div class="ui-buttons">'
               +  '<button name="yes"><%= confirm %></button>'
               +  '<button name="no" ><%= cancel %></button>'
               + '</div>',

    /** @brief  Initialize a new instances.
     */
    initialize: function() {
        var self    = this;

        if (_.isString( self.template ))
        {
            // Resolve our template
            var html    = self.template;
            try {
                //MiniDialog.prototype.template = _.template( html );
                self.__proto__.template = _.template( html );
            } catch(e) {
                console.log("MiniDialog error: %s, html[ %s ]",
                            e.message, html);
            }
        }

        /* Include a document-level key handler to allow keyboard selection
         * when the dialog is visible.
         */
        $(document).on('keydown.miniDialog', _.bind(self.keyPress, self));

        if (self.options.question)
        {
            // We've been given data directly, render immediately.
            self.render();
        }
    },

    /** @brief  Render the given question.
     */
    render: function() {
        var self        = this;
        if (! self.options.question)    { return; }

        var data    = _.extend({confirm:'yes',cancel:'no'}, self.options),
            $body   = $( self.template( data ) );

        self.$confirm = $body.find('button[name=yes]');
        self.$cancel  = $body.find('button[name=no]');

        if (self.options.primary === 'confirm')
        {
            self.$confirm.addClass('ui-priority-primary');
            self.$cancel.addClass( 'ui-priority-secondary');
        }
        else
        {
            self.$confirm.addClass('ui-priority-secondary');
            self.$cancel.addClass( 'ui-priority-primary');
        }

        self.$el.append( $body );

        if (self.options.css)   { self.$el.css( self.options.css ); }

        return self;
    },

    /** @brief  Remove this view from the DOM.
     */
    remove: function() {
        var self    = this;

        // Remove our document-level key handler
        $(document).off('.miniDialog');

        self.$el.hide('fast', function() {
            self.$el.remove();
        });
        return self;
    },

    /************************************************************************
     * Event handlers
     *
     */
    keyPress: function(e) {
        var self    = this;
        if (! self.$el.is(':visible'))  { return; }

        switch (e.which)
        {
        case 13:    // ENTER
            if (self.options.primary === 'confirm')
            {
                self.$confirm.click();
                return;
            }
            // fall through

        case 27:    // ESC
            self.$cancel.click();
            break;
        }
    },

    clickButton: function(e) {
        var self    = this,
            $button = $(e.target);

        switch ($button.attr('name'))
        {
        case 'yes':
            if (_.isFunction(self.options.confirmed))
            {
                self.options.confirmed();
            }
            self.$el.trigger('confirmed');
            break;

        case 'no':
            if (_.isFunction(self.options.cancelled))
            {
                self.options.cancelled();
            }
            self.$el.trigger('canceled');
            break;
        }

        // And, remove ourselves
        self.remove();
    }
});


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

        /* Add a document-level 'dragover' handler to allow dropping at any
         * location within the sidebar
         */
        $(document).on('dragover', _.bind(self.dragOver, self));

        /* Add a document-level 'drop' handler to take care of 'drop' events
         * that have been proxied to the sidebar document via
         * sbDndProxy()/sbDrop() in the sidebar addon as 'dropExternal' events
         * -- most likely because an item was dropped on the splitter while the
         * sidebar was closed.
         */
        $(document).on('dropExternal', _.bind(self.dragDrop, self));

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

    /** @brief  Add a new topic.
     *  @param  topic   The topic model.
     *
     *  @return The new TopicView
     */
    addTopic: function(topic) {
        var self    = this;
            view    = new TopicView({model: topic});

        self.$topics.append( view.$el );

        return view;
    },

    /************************************************************************
     * Event handlers
     *
     */
    topicAddKey: function(e) {
        var self    = this,
            val     = self.$topicInput.val();

        switch (e.which)
        {
        case 13:    // ENTER
            if (val.length > 0)
            {
                // Add a new topic
                self.addTopic({
                    title:  val,
                    items:  []
                });

                self.$topicInput.val('');
                self.$topicInput.blur();

                e.preventDefault();
                e.stopPropagation();
            }
            break;

        case 27:    // ESC
            self.$topicInput.val('');
            self.$topicInput.blur();
            break;
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

        // Request a visit to the target href.
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
    },

    // Document-level drag-and-drop handlers
    dragOver: function(e) {
        var self            = this,
            dataTransfer    = (e.dataTransfer
                                ? e.dataTransfer
                                : e.originalEvent.dataTransfer);

        dataTransfer.dropEffect = (gDragging ? 'move' : 'copy');
        e.preventDefault();
    },

    dragDrop: function(e) {
        var self    = this;

        console.log("TopicsView::dragDrop:");

        /* Create a new proxied event containing the incoming 'detail'
         * (dataTransfer) data and trigger that event on the first
         * '.curation-topic'.
         */
        var proxied     = $.Event('dropExternal', {
                                    detail: e.originalEvent.detail
                                  }),
            $topic      = self.$el.find('.curation-topic:first');

        console.log("TopicsView::dragDrop: topic[ %s ]", $topic);
        if ($topic.length < 1)
        {
            /* There are NO topics currently defined.
             *
             * Create and add a new one, and use IT as the target.
             */
            var view    = self.addTopic({
                            title:  'New Topic',
                            items:  []
                          });
            $topic = view.$el;
        }

        console.log("TopicsView::dragDrop: topic2[ %s ]", $topic);
        $topic.trigger( proxied );
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

        'click header .control-edit':       'ctrlEdit',
        'click header .control-delete':     'ctrlDelete',
        'click header .control-move-top':   'ctrlMoveTop',

        'blur header > h1 input':           'editComplete',
        'keydown header > h1 input':        'editKey',

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

        self.$header     = self.$el.find('> header');
        self.$title      = self.$header.find('h1');
        self.$titleSpan  = self.$title.find('span');
        self.$titleInput = self.$title.find('input');
        self.$titleInput.parent().hide();

        self.$toggle     = self.$header.find('.toggle');
        self.$controls   = self.$header.find('.curation-controls');
        self.$items      = self.$el.find('> .curation-items');

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

        if (_.isEmpty(self.$toggle) ||
            (self.$titleInput && (self.$titleInput.get(0) == e.target)))
        {
            //console.log("TopicView::toggle(): IGNORE");
            return;
        }

        //console.log("TopicView::toggle()");

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
     * Control handlers
     */
    ctrlEdit: function(e) {
        var self    = this;

        // NOT draggable while editing
        self.$el.attr('draggable', false);

        self.$titleInput.val( self.$titleSpan.text() );
        self.$titleSpan.hide();
        self.$titleInput.parent().show();
        self.$titleInput.focus();
    },
    ctrlDelete: function(e) {
        var self    = this,
            $button = $(e.target),
            pos     = $button.position();

        // Present a confirmation mini-dialog
        var confirm = new MiniDialog({
                        question:   'Delete this topic<br />and all items?',
                        css:        {
                            'z-index':  self.$controls.css('z-index') + 1,
                            'width':    self.$controls.width(),
                            'top':      pos.top,
                            'right':    0
                        },
                        confirmed:  function() {
                            console.log("TopicView::Delete (%s)",
                                        self.options.model.title);
                            self.$el.hide('fast', function() {
                                self.remove();
                            });
                        }
                      });

        self.$header.append( confirm.$el );
    },
    ctrlMoveTop: function(e) {
        var self    = this,
            $top    = self.$el.siblings().first();

        self.$el.insertBefore($top);
    },

    editKey: function(e) {
        var self    = this;

        //console.log("TopicView::editKey(): %s", e.which);
        switch (e.which)
        {
        case 13:    // ENTER
            self.$titleInput.blur();
            break;

        case 27:    // ESC
            self.$titleInput.val( self.$titleSpan.text() );
            self.$titleInput.blur();
            break;
        }
    },
    editComplete: function(e) {
        var self    = this;

        self.$titleSpan.text( self.$titleInput.val() );
        self.$titleInput.parent().hide();
        self.$titleSpan.show();

        // draggable again
        self.$el.attr('draggable', true);
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

        //console.log("TopicView::dragOver()");

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

        // /*
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
            if ($after.length < 1)
            {
                // First child
                self.$items.append( view.$el );
            }
            else
            {
                view.$el.insertAfter( $after );
            }

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
        'render':                   'render',

        'click .control-visit':     'ctrlVisit',
        'click .control-delete':    'ctrlDelete'
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
     *                       location:  inter-page location (id),
     *                       selector:  inter-page selector (starting at id),
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

        self.$controls = self.$el.find('.curation-controls');

        return self;
    },

    /************************************************************************
     * Event handlers
     *
     */
    ctrlVisit: function(e) {
        var self    = this;

        console.log("ItemView::ctrlVisit(): item[ %s ]",
                    JSON.stringify(self.options.model));

        e.preventDefault();
        e.stopPropagation();

        // Request a visit to the target href.
        addon.postMessage({
            src:        'sidebar-content',
            action:     'visit',
            url:        self.options.model['url'],
            location:   self.options.model['location'],
            selector:   '',
            current:    (! e.metaKey)
        });
    },
    ctrlDelete: function(e) {
        var self    = this,
            $button = $(e.target),
            pos     = $button.position();

        // Present a confirmation mini-dialog
        var confirm = new MiniDialog({
                        question:   'Delete this item?',
                        css:        {
                            'z-index':  10,
                            'top':      pos.top,
                            'left':     0
                        },
                        confirmed:  function() {
                            console.log("ItemView::Delete (%s)",
                                        self.options.model.id);
                            self.$el.hide('fast', function() {
                                self.remove();
                            });
                        }
                      });

        self.$el.append( confirm.$el );
    },
});

$(document).ready(function() {
    //console.log("js/topics-sidebar.js: Document Ready.");

    // Establish our primary view
    var $curation   = $('#collaborative-curation'),
        view        = new TopicsView({el: $curation});
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
                    formatted = (arg ? arg : '');
                    break;

                // Integer
                case 'd':
                    formatted = (arg ? parseInt(arg, 10) : formatted);
                    break;

                case 'x':
                    formatted = (arg ? parseInt(arg, 16) : formatted);
                    break;

                case 'o':
                    formatted = (arg ? parseInt(arg, 8) : formatted);
                    break;

                // Floating point
                case 'f':
                case 'g':
                    formatted = (arg ? parseFloat(arg) : formatted);
                    break;

                // JSON
                case 'j':
                    formatted = (arg ? JSON.stringify(arg) : formatted);
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
     *  - one or more 'files'
     *      dropping an external/system file
     *          generate a URL to the target file and, if the dataTransfer item
     *          includes a 'dataUrl' item, include an img using the dataUrl as
     *          the source;
     *  - 'text/x-moz-url' but no 'text/_moz_htmlcontext'
     *      dropping a URL from the address bar
     *          use 'text/x-moz-url', splitting the URL from the title
     *  - 'text/x-moz-place'
     *      dropping a bookmark entry {title, uri}
     *          use 'text/html'
     *  - 'text/html'
     *      dropping pre-formated HTML
     *          if the data is an object with an 'html' member, assume sbDrop()
     *          has converted it to an item of the form:
     *              {html:, srcUrl}
     *          otherwise, use it directly as raw html;
     *  - 'text/plain'
     *      dropping plain-text -- ignore??;
     */
    var items   = [],
        hasType = function(val) {
            return (dataTransfer.types.indexOf(val) >= 0);
        };

    if (dataTransfer.files && (dataTransfer.files.length > 0))
    {
        // Create an entry for each file

        /*
        console.log("dataTransfer2Items:   %d: file entries:",
            dataTransfer.files.length);
        // */

        _.each(dataTransfer.files, function(file, idex) {
            //console.log("dataTransfer2Items:    %d: %j", idex, file);

            /* If this item has a 'dataUrl', use it in an enclosed <img>
             * element to provide a file-independent view of the file contents
             * that were in place when the file was dropped.
             */
            var url     = 'file://'+ file.path,
                content = '<a href="'+ url +'">'
                        +   (file.dataUrl
                                ? '<img src="'+ file.dataUrl +'" />'
                                : file.name)
                        + '</a>';

            items.push({
                timestamp:  (new Date()).getTime(),
                content:    content,
                url:        url,
                location:   '',
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
            fullUrl     = data.uri,
            url         = fullUrl,
            title       = data.title,
            hashStart   = url.lastIndexOf('#'),
            hashEnd     = url.indexOf(' ', start),
            location    = (hashEnd > hashStart
                            ? url.substring(hashStart, hashEnd)
                            : (hashStart >= 0
                                ? url.substr(hashStart)
                                : ''));
        if (hashStart > 0)
        {
            url = url.substr(0, hashStart);
        }

        /*
        console.log("dataTransfer2Items:   text/x-moz-place: data[ %j ]",
                    data);
        // */

        items.push({
            timestamp:  (new Date()).getTime(),
            content:    '<a href="'+ fullUrl +'">'+ title +'</a>',
            url:        url,
            location:   location,
            selector:   '',
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

        /*
        console.log("dataTransfer2Items:   %d: text-x-moz-urls "
                    +   "without _moz_htmlcontext",
                    data.length);
        // */

        _.each(data, function(entry, idex) {
            //console.log("dataTransfer2Items:      %d: %j", idex, entry);

            items.push({
                timestamp:  (new Date()).getTime(),
                content:    '<a href="'+ entry.url +'">'+ entry.title +'</a>',
                url:        entry.url,
                location:   location,
                selector:   '',
                topicId:    topic.id,
                order:      '',
                comments:   []
            });
        });
    }
    else if (hasType('text/html'))
    {
        // Use the dropped HTML (or sbDrop() constructed item).
        var item        = dataTransfer['text/html'],
            html        = (item && item.html
                            ? item.html
                            : item),
            $html       = $('<div>'+ html +'</div>'),
            fullUrl     = (item && item.srcUrl
                            ? item.srcUrl
                            : 'url://of.source/page'),
            url         = fullUrl,
            location    = '';

        /*
        console.log("dataTransfer2Items:   text/html: item[ %s ]",
                    JSON.stringify(item));
        // */

        var $id = $html.find('[id]').first();
        if ($id && ($id.length > 0))
        {
            /* Use the id of the *last* element in the incoming HTML that has
             * an id
             */
            location = '#'+ $id.attr('id');
        }
        else if ( hasType('text/_moz_htmlcontext'))
        {
            // Use _moz_htmlcontext to construct a location
            var context     = dataTransfer['text/_moz_htmlcontext'],
                $context    = $(context),
                $inner      = $context.find(':not(:has(*))').last(),
                path        = [];

            /* Use the id of the *nearest* element in our context that has an
             * id
             */
            $id = $inner.closest('[id]');
            if ($id && ($id.length > 0))
            {
                location = '#'+ $id.attr('id');
            }
        }

        /* Remove any in-line styling and event handlers from the incoming HTML
         * elements
         */
        $html.find('*').each(function() {
            var el  = this,
                $el = $(el);

            /* Walk through the properties and remove any in-line styling and
             * event handlers
             */
            var toRemove    = [];
            for (var prop in el)
            {
                if ((! $el.attr(prop)) && (! $el.prop(prop)))   { continue; }

                if (prop.match(/^(style$|on|height|width)/i))
                {
                    toRemove.push(prop);
                }
            }

            toRemove.forEach(function(name) {
                $el.removeProp(name);
                $el.removeAttr(name);
            });
        });

        if (location.length > 0)
        {
            // Remove any '#' from the url
            var hashStart   = url.lastIndexOf('#');
            if (hashStart > 0)
            {
                url = url.substr(0, hashStart);
            }
        }

        /*
        console.log("dataTransfer2Items:   text/html: html[ %s ]", html);
        console.log("dataTransfer2Items:   text/html: $html[ %s ]",
                        $html.html());
        // */

        var item    = {
            timestamp:  (new Date()).getTime(),
            content:    $html.html().trim(),
            url:        url,
            location:   location,
            selector:   '',
            topicId:    topic.id,
            order:      '',
            comments:   []
        };

        // /*
        console.log("dataTransfer2Items:   text/html: item[ %s ]",
                    JSON.stringify(item));
        // */

        items.push( item );
    }
    // else, IGNORE (by NOT adding anyting to items)

    /* 'x-moz-file' ends up having *less* information than simple File (no
     * 'type' and no possibility of 'dataUrl'), so we ignore it here ...
     *
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
