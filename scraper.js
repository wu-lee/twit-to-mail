var config = require('./config.js');
var casper = require('casper').create(config.casper);

var page = require('webpage').create();
console.log('twit-to-mailer starting...');

function output(tweets) {
    tweets.map(function(tweet) { console.log(JSON.stringify(tweet)); });
}

// print out all the messages in the headless browser context
casper.on('remote.message', function(msg) {
    this.echo('remote.message: ' + msg);
});

// print out all the messages in the headless browser context
casper.on("page.error", function(msg, trace) {
    this.echo(msg, "ERROR");
});

casper.on('error', function(err) {
    console.log(err);
    this.exit();
    process.exit(-1);
});

casper.start(config.startUrl, function() {
    this.echo("got "+this.getCurrentUrl());
});

casper.waitForSelector(config.selectors.loginForm, function() {
    var selectors = {}
    selectors[config.selectors.userInput] = config.credentials.user;
    selectors[config.selectors.passwordInput] = config.credentials.password;
    
    this.fillSelectors(config.selectors.loginForm, selectors, true);

    //this.echo(JSON.stringify(this.getFormValues(loginFormSelector)));// DEBUG
    //this.capture('login.png'); // DEBUG
});


casper.waitForSelector(
    config.selectors.stream,
    function() {
        this.echo("Got to twitter stream");        
        if (config.capture.success)
            this.capture(config.capture.success);
    },
    function() {
        this.echo("Failed to get to twitter stream");
        if (config.capture.failure)
            this.capture(config.capture.failure);
    }
);

// Run this and don't exit
casper.run(function() { 

    function poll() {

        function scrape(config) {
            var $ = window.jQuery;

            console.log("starting scraper");
            

            function selectElement(jqnode, ix) {
                if (jqnode.length <= 0) {
                    console.log("skipping empty node (#"+ix+")");
                    return false;
                }
                
		var tweet = jqnode.find('.original-tweet');
                if (tweet.length > 0)
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
		    promoted: html.attr('data-promoted') === 'true',
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
                    tweetId: tweetId,
                };
                return tweet;
            }

            var children = $(config.selectors.stream).children();

            var tweets = children.get()
                .reverse()
                .map($)
                .filter(selectElement)
                .map(formatTweet);

            children.remove();
            return tweets;
        };

        if (config.capture.scrape)
            casper.capture(config.capture.scrape);
        var tweets = casper.evaluate(scrape, config);

        casper.click(config.selectors.updateButton); // update the stream 

        casper.echo("tweets scraped: "+tweets.length+"\n"+
                    tweets.map(function(it) { return it.name }));
        output(tweets);
    }

    function pollWrapper() {
	try {
	    poll();
	}
	catch(e) {
	    caspar.echo("exception: "+e, "ERROR");
	}
    }

    var interval = setInterval(pollWrapper, config.pollInterval);
});

