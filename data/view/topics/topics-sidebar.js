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
        'click a':                      'openInTab',
        'click .toggle':                'toggleItem',
        'click .curation-topic > h1':   'toggleItem',

        // Drag-and-drop
        'dragstart [draggable]':        'dragStart',
        'dragend   [draggable]':        'dragEnd',

        'dragover  [draggable]':        'dragOver',
        'dragenter [draggable]':        'dragEnter',
        'dragleave [draggable]':        'dragLeave',

        'drop      [draggable]':        'dragLeave',
    },

    templates:  {
        topic:  '#curation-topic'
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

        self.$el.empty();
        topics.forEach(function(topic) {
            var html    = self.templates.topic(topic);
            self.$el.append( html );
        });

        return self;
    },

    /************************************************************************
     * Event handlers
     *
     */
    openInTab: function(e) {
        var self    = this,
            $a      = $(e.target);

        e.preventDefault();
        e.stopPropagation();

        // Post that we're ready
        proxy.postMessage({
            name:   'sidebar',
            action: 'visit',
            url:    $a.attr('href')
        });
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
        var self    = this,
            $src    = $(e.target);

        if (! $src.attr('draggable')) { return; }

        console.log("drag start: src[", $src.attr('class'), "]");

        $src.addClass('dragging');

        self.dragging = $src;

        e.dataTransfer.effectAllowed = 'move';

        e.dataTransfer.setData('text/html', $src.html());
        e.dataTransfer.setData('application/x-moz-node', $src[0]);
    },
    dragEnd: function(e) {
        var self    = this,
            $src    = (self.dragging ? self.dragging : $(e.target));

        $src.removeClass('dragging');

        console.log("drag end: src[", $src.attr('class'), "]");

        self.dragging = null;
    },

    dragOver: function(e) {
        var self    = this,
            $tgt    = $(e.target);

        /*
        if (! $tgt.attr('droppable'))
        {
            $tgt = $tgt.parents('[droppable]:first'); 
        }
        // */
        if ( (! $tgt.attr('droppable'))  ||
             ($tgt.hasClass('dragging')) ||
             ($tgt.hasClass('drag-over')) )
        { return; }

        console.log("drag over: tgt[", $tgt.attr('class'), "]");

        e.dataTransfer.dropEffect = 'move';

        e.preventDefault();
        e.stopPropagation();
        return false;
    },
    dragEnter: function(e) {
        var self    = this,
            $tgt    = $(e.target);

        /*
        if (! $tgt.attr('droppable'))
        {
            $tgt = $tgt.parents('[droppable]:first'); 
        }
        // */
        if ( (! $tgt.attr('droppable'))  ||
             ($tgt.hasClass('dragging')) ||
             ($tgt.hasClass('drag-over')) )
        { return; }

        console.log("drag enter: tgt[", $tgt.attr('class'), "]");

        $tgt.addClass('drag-over');

        e.preventDefault();
        e.stopPropagation();
        return false;
    },
    dragLeave: function(e) {
        var self    = this,
            $tgt    = $(e.target);

        /*
        if (! $tgt.attr('droppable'))
        {
            $tgt = $tgt.parents('[droppable]:first'); 
        }
        // */
        if ( (! $tgt.attr('droppable'))  ||
             ($tgt.hasClass('dragging')) ||
             ($tgt.hasClass('drag-over')) )
        { return; }

        console.log("drag leave: tgt[", $tgt.attr('class'), "]");

        $tgt.removeClass('drag-over');

        e.preventDefault();
        e.stopPropagation();
        return false;
    },

    dragDrop: function(e) {
        var self    = this,
            $tgt    = $(e.target);

        e.stopPropagation();

        console.log("drag drop: src[", $src.attr('class'), "]");
    }
});

/** @brief  Handle a postMessage()
 *  @param  msg     The message data:
 *                      {action: *action*, action-secific-data}
 *                          Valid actions:
 *                              'load', topics:[]
 */
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

$(document).ready(function() {
    //console.log("js/topics-sidebar.js: Document Ready.");

    // Establish our mainView
    var $topics = $('#curation-topics');

    mainView = new TopicsView({el: $topics});

    $topics.data('view', mainView);

    // Post that we're ready
    proxy.postMessage({
        name:   'sidebar',
        action: 'loaded',
        url:    'js/topics-sidebar.js'
    });
});

//console.log("js/topics-sidebar.js loaded");
