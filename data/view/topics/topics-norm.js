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

/** @brief  A Backbone View for Topics
 */
var TopicsView  = Backbone.View.extend({
    events:     {
        'keydown input.new-topic':      'topicAddKey',

        'click a':                      'openInTab',
        'click .toggle':                'toggleItem',
        'click .curation-topic > h1':   'toggleItem',

        // Drag-and-drop
        'dragstart li':                 'dragStart',
        'dragend   li':                 'dragEnd',

        'dragover  li':                 'dragOver',
        'dragenter li':                 'dragEnter',
        'dragleave li':                 'dragLeave',

        'drop      li':                 'dragDrop'
    },

    templates:  {
        topic:  '#curation-topic',
        item:   '#curation-item'
    },

    /** @brief  Initialize a new instances.
     */
    initialize: function() {
        var self    = this;

        // Resolve templates
        _.each(self.templates, function(selector, key) {
            var html    = $(selector).html();
            try {
                self.templates[key] = _.template( html );
            } catch(e) {
                console.log("Template '", key, "' error:", e.message,
                            ", html[", html, "]");
            }
        });
    },

    /** @brief  Render the given set of topics.
     *  @param  topics  An array of Topic records, each of the form:
     *                      {topic: topic,
     *                       items: []}
     *
     *                  Each item has the form:
     *                      {url:       url,
     *                       title:     title,
     *                       timestamp: timestamp,
     *                       content:   content,
     *                       comments:  [ comments ] or commentCount
     *                      }
     */
    render: function(topics) {
        var self    = this;

        self.$topicInput = self.$el.find('> input');
        self.$topics     = self.$el.find('.curation-topics');

        self.$topics.empty();
        topics.forEach(function(topic) {
            var $topic  = $( self.templates.topic(topic) ),
                $ul     = $topic.find('.curation-items');

            $ul.empty();

            // Now, create each item individually so we can attach data to each
            topic.items.forEach(function(item) {
                var $item   = $( self.templates.item(item) );
                $item.data('curation-item', item);

                $ul.append( $item );
            });

            self.$topics.append( $topic );
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
            var topic   = {topic:val},
                $topic  = $( self.templates.topic(topic) );

            self.$topics.append( $topic );

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
            $li.find('.curation-items').slideDown(function() {
                $toggle.attr('title', title.replace('expand', 'collapse'));
            });
        }
        else
        {
            $li.find('.curation-items').slideUp(function() {
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
        self.dragging  = $src;

        //dataTransfer.effectAllowed = 'move';
        dataTransfer.setData('text/html', $src.html());
        dataTransfer.setData('application/x-moz-node', $src[0]);
    },
    dragEnd: function(e) {
        var self    = this,
            $src    = (self.dragging ? self.dragging : $(e.target));

        /*
        var $tags   = $src.parent().find( $src.prop('tagName') );
        console.log("drag end: src[ %s-%d.%s ]",
                    $src.prop('tagName'),
                    $tags.index($src),
                    $src.attr('class'));
        // */

        $src.removeClass('dragging');

        self.dragging  = null;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
    },

    dragOver: function(e) {
        var self            = this,
            dataTransfer    = (e.dataTransfer
                                ? e.dataTransfer
                                : e.originalEvent.dataTransfer),
            $src            = self.dragging,
            $tgt            = $(e.target);

        if ((! dataTransfer) || (! $tgt.attr('droppable')))
        {
            e.preventDefault();
            return;
        }

        /*
        var droppable   = $tgt.attr('droppable').split(/\s+/),
            canDrop     = (($tgt.get(0) !== $src.get(0)) &&
                           _.reduce(droppable, function(res, name) {
                            return (res || $src.hasClass(name));
                           }, false));

        var $tgtTags   = $tgt.parent().find( '> '+ $tgt.prop('tagName') ),
            $srcTags   = $src.parent().find( '> '+ $src.prop('tagName') );
        console.log("drag over: src[ %s-%d.%s ], tgt[ %s-%d.%s ]: "
                    +   "droppable[ %s ]: %sdrop",
                    $src.prop('tagName'),
                    $srcTags.index($src),
                    $src.attr('class'),
                    $tgt.prop('tagName'),
                    $tgtTags.index($tgt),
                    $tgt.attr('class'),
                    droppable.join(', '),
                    (canDrop ? ' ' : '!'));

        if (! canDrop)  { return false; }
        // */

        dataTransfer.dropEffect = 'move';
        e.preventDefault();
    },
    dragEnter: function(e) {
        var self    = this,
            $tgt    = $(e.target),
            $src    = self.dragging;

        if (! $tgt.attr('droppable'))
        {
            // Immediate propagate up to the top-level 'droppable'
            $tgt = $tgt.parents('[droppable]:first');
        }

        if ($src)
        {
            if ($tgt.get(0) === $src.get(0))    { return; }

            // /*
            var droppable   = $tgt.attr('droppable').split(/\s+/),
                canDrop     = (($tgt.get(0) !== $src.get(0)) &&
                               _.reduce(droppable, function(res, name) {
                                return (res || $src.hasClass(name));
                               }, false));

            var $tgtTags   = $tgt.parent().find( '> '+ $tgt.prop('tagName') ),
                $srcTags   = $src.parent().find( '> '+ $src.prop('tagName') );
            console.log("drag enter: src[ %s-%d.%s ], tgt[ %s-%d.%s ]: "
                        +   "droppable[ %s ]: %sdrop",
                        $src.prop('tagName'),
                        $srcTags.index($src),
                        $src.attr('class'),
                        $tgt.prop('tagName'),
                        $tgtTags.index($tgt),
                        $tgt.attr('class'),
                        droppable.join(', '),
                        (canDrop ? ' ' : '!'));

            if (! canDrop)  { return false; }
            // */
        }


        var dragCount       = $tgt.data('drag-count') || 0;
        if (dragCount < 1) { $tgt.addClass('drag-over'); }
        dragCount++;
        $tgt.data('drag-count', dragCount);

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
    },
    dragLeave: function(e) {
        var self    = this,
            $tgt    = $(e.target),
            $src    = self.dragging;

        if (! $tgt.attr('droppable'))
        {
            // Immediate propagate up to the top-level 'droppable'
            $tgt = $tgt.parents('[droppable]:first');
        }

        if ($src && ($tgt.get(0) === $src.get(0)))
        {
            return;
        }

        var dragCount   = $tgt.data('drag-count') || 0;
        if (dragCount > 0)  { dragCount--; }

        /*
        var $tags   = $tgt.parent().find( $tgt.prop('tagName') );
        console.log("drag leave: tgt[ %s-%d.%s ]: %d",
                    $tgt.prop('tagName'),
                    $tags.index($tgt),
                    $tgt.attr('class'),
                    dragCount);
        // */

        if (dragCount < 1)  { $tgt.removeClass('drag-over'); }
        $tgt.data('drag-count', dragCount);

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

        var $src    = (self.dragging || $(dataTransfer.mozSourceNode));
        if (! $src) { return; }


        var $tgt    = $(e.target);
        if (! $tgt.attr('droppable'))
        {
            // Immediate propagate up to the top-level 'droppable'
            $tgt = $tgt.parents('[droppable]:first');
        }

        if ($tgt.get(0) === $src.get(0))
        {
            return;
        }

        var droppable   = $tgt.attr('droppable').split(/\s+/),
            canDrop     = (($tgt.get(0) !== $src.get(0)) &&
                           ((! $src.attr('draggable')) ||
                            _.reduce(droppable, function(res, name) {
                                return (res || $src.hasClass(name));
                            }, false)));
        if (! canDrop)
        {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
        }

        // /*
        var $tgtTags   = $tgt.parent().find( '> '+ $tgt.prop('tagName') ),
            $srcTags   = $src.parent().find( '> '+ $src.prop('tagName') );
        console.log("drag drop: src[ %s-%d.%s ], tgt[ %s-%d.%s ]: "
                    +   "%sdrop: %s/[ %s ]",
                    $src.prop('tagName'),
                    $srcTags.index($src),
                    $src.attr('class'),
                    $tgt.prop('tagName'),
                    $tgtTags.index($tgt),
                    $tgt.attr('class'),
                    (canDrop ? ' ' : '!'),
                    $src.attr('class'), droppable.join(', '));

        if (! self.dragging)
        {
            /* The user is dragging an "external", non-sidebar node.
             *
             * Create a new entry based upon this node.
             */
            var item    = {
                    url:        'url://of.source/page',
                    title:      dataTransfer.getData('text/plain'),
                    timestamp:  (new Date()).getTime(),
                    content:    dataTransfer.getData('text/html'),
                    comments:   []
                };

            //var types   = [].slice.call(dataTransfer.types, 0);
            _.each(dataTransfer.types, function(type) {
                var data    = dataTransfer.getData(type);
                console.log("drag drop: type[ %s ]: %s",
                            type, JSON.stringify(data));
            });
            // */

            switch ($src.prop('nodeName'))
            {
            case 'IMG':
                if ($src.attr('alt'))   { item.title = $src.attr('alt'); }
                if ($src.attr('title')) { item.title = $src.attr('title'); }
                break;

            case 'A':
                item.title = $src.text();
                break;

            default:
                if ([].indexOf.call(dataTransfer.types, 'text/x-moz-url') >= 0)
                {
                    var parts = dataTransfer.getData('text/x-moz-url')
                                                                .split("\n");
                    item.title = parts[1];
                }
                break;
            }


            $src = $( self.templates.item(item) );
            $src.data('curation-item', item);
        }

        // Move the source element to its new location
        if (   $tgt.hasClass('curation-topic') &&
            (! $src.hasClass('curation-topic')) )
        {
            // At the top of the $tgt list
            var $ul = $tgt.find('.curation-items'),
                $li = $ul.find('> li').first();

            if ($li.length > 0) { $src.insertBefore( $li ); }
            else                { $ul.append( $src ); }
        }
        else
        {
            // After $tgt
            $src.insertAfter($tgt);
        }

        /* Directly remove the 'drag-over' class on $tgt since 'dragleave' will
         * NOT be triggerd on the target element.
         */
        $tgt.removeClass('drag-over');
        $tgt.data('drag-count', 0);

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
    }
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
        mainView.render(msg.topics);
    });
});

//console.log("js/topics-sidebar.js loaded");
