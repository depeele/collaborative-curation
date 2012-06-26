console.log("js/topics.js: self[", self, "]");

/** @brief  Handle a postMessage()
 *  @param  msg     The message data:
 *                      {action: *action*, action-secific-data}
 *                          Valid actions:
 *                              'load', topics:[]
 */
self.on('message', function(msg) {

    console.log("js/topics.js: message ", JSON.stringify(msg));

    switch (msg.action)
    {
    case 'load':
        render(msg.topics);
        break;
    }
});

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
function render(topics)
{
    var $topics     = $('#curation-topics'),
        templates   = {
            topic:  $('#curation-topic'),
            item:   $('#curation-item')
        };

    if ($topics.length < 1)
    {
        console.log('js/topics+.js:render(): no jQuery topics, ge[',
                    document.getElementById('curation-topics'), ']');
    }

    console.log('js/topics+.js:render(): $topics', $topics, ", ", $topics.length);
    console.log('js/topics+.js:render(): templates.topic', templates.topic, ", ", templates.topic.length);
    console.log('js/topics+.js:render(): templates.item',  templates.item, ", ", templates.item.length);

    $topics.empty();

    console.log('Present '+ topics.length +' topics...');

    topics.forEach(function(topic) {
        var $topic = $('#curation-topic').clone(),
            $items  = $topic.find('.curation-items');

        console.log('topic: ', topic.topic, ' #', topic.items.length, ' items');

        $topic.find('h1')
            .text(topic.topic);

        topic.items.forEach(function(item) {
            var $item   = $('#curation-item').clone();
                $header = $item.find('header:first'),
                data    = $.extend({}, item);

            // /*
            console.log('item: ',
                            'url[ ',        item.url,          ' ], ',
                            'title[ ',      item.title,        ' ], ',
                            'timestamp[ ',  item.timestamp,    ' ], ',
                            'content[ ',    item.content,      ' ], ',
                            'comments[ ',   item.comments,     ' ]');
            // */

            $header.find('.url')
                .text(item.url)
                .attr('href', item.url)
                .bind('click', function(e) {
                    e.stopPropagation();
                    e.preventDefault();

                    self.postMessage({action:'visit', url:item.url});
                });

            $header.find('.curation-comments')
                .text( ($.isArray(item.comments)
                            ? item.comments.length : item.comments) );

            $header.find('time')
                .attr('datetime', item.timestamp)
                .text( new Date(item.timestamp) );

            $item.find('.curation-content')
                .html(item.content);

            $items.append($item);
        });

        $topics.append($topic);
    });
}

console.log("js/topics.js loaded");

self.postMessage({action:'loaded', url:'js/topics.js'});
