var url = {
    twitter: 'https://twitter.com/twitter',
};
var pollInterval = 1000*10; // 
var page = require('webpage').create();
console.log('twit-to-mailer starting...');

function output(tweets) {
    tweets.map(function(tweet) { console.log(JSON.stringify(tweet)); });
}

page.onConsoleMessage = function(msg) {
    console.log('> ', msg);
};



page.open(url.twitter, function(status) {

    if (status !== 'success') {
        console.log("exiting, status: ",status);

        phantom.exit();
        return;
    }


    function poll() {
        function scrape() {
            var $ = window.jQuery;

            var state = { id: undefined };
            console.log("starting scraper");
            

            function selectElement(jqnode, ix) {
                if (jqnode.length <= 0) {
                    console.log("skipping empty node (#"+ix+")");
                    return false;
                }
                
                if (jqnode.find('.original-tweet').length > 0)
                    return true;

                console.log("Skipping node #"+ix+": no .original-tweet", jqnode[0]);
                return false;
            }

            function formatTweet(jqnode, ix) {
                var html = jqnode.find('.original-tweet').first(); // FIXME currently ignores subsequent elems
                var tweetId = html.attr('data-retweet-id') || html.attr('data-tweet-id');
                var expandedFooter = html.attr('data-expanded-footer');
                var tweet = {
                    type: 'tweet',
                    youBlock: html.attr('data-you-block') === 'false',
                    followsYou: html.attr('data-follows-you') === 'true',
                    youFollow: html.attr('data-you-follows') === 'true',
                    hasCards: html.attr('data-has-cards') === 'true',
                    hasNativeMedia: html.attr('data-has-native-media') === 'true',
                    youFollow: html.attr('data-you-follows') === 'true',
                    cardType: html.attr('data-card-type'),
                    retweeter: html.attr('data-retweeter'),
                    userId: html.attr('data-user-id'),
                    name: html.attr('data-name'),
                    screenName: html.attr('data-screen-name'),
                    retweetId: html.attr('data-retweet-id'),
                    permalinkPath: html.attr('data-permalink-path'),
                    itemId:  html.attr('data-item-id'),
                    date: html.find('[data-time-ms]').attr('data-time-ms'),
                    html: html[0].outerHTML,
                    expandedFooter: expandedFooter,
                    text: html.find('.tweet-text').text(),
                    follows: state.lastId,
                    tweetId: tweetId,
                };
                state.lastId = tweetId;
                return tweet;
            }

            var children = $('#stream-items-id').children();

            var tweets = children.get()
                .reverse()
                .map($)
                .filter(selectElement)
                .map(formatTweet);

            children.remove();
            return tweets;
        };

        page.render('twitter.png');
        var tweets = page.evaluate(scrape);

        page.sendEvent('keypress', '.');

        console.log("tweets scraped: "+tweets.length,
                    tweets.map(function(it) { return it.name }));
        output(tweets);
    }

    var interval = setInterval(poll, pollInterval);
    
});
