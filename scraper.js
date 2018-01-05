var config = require('./config.js');
var casper = require('casper').create(config.casper);

var page = require('webpage').create();
console.log('scraper starting...');

function output(tweets) {
    tweets.map(function(tweet) { console.log(JSON.stringify(tweet)); });
}

function readTrace(trace) {
    return trace.map(function(it) {
        return ' -> ' + (it.file || it.sourceURL) + ': ' + it.line +
            (it.function ? ' (in function ' + it.function +')' : '')
    }).join("\n");
}

// print out all the messages in the headless browser context
casper.on('remote.message', function(msg) {
    this.echo('remote.message: ' + msg);
});

// print out all the messages in the headless browser context
casper.on("page.error", function(msg, trace) {
    this.echo("page error: "+JSON.stringify(msg), "ERROR");
    this.echo(readTrace(trace), "ERROR");
});

casper.on("resource.error", function(msg, trace) {
    this.echo("resource error: "+JSON.stringify(msg), "ERROR");
    this.echo(readTrace(trace), "ERROR");
});

casper.on('error', function(err) {
    console.log("error:", err);
    this.exit();
    process.exit(-1);
});

// We want to avoid errors like:
// undefined is not a function evaluating document.createElement("video").canPlayType(...)
casper.on('page.initialized', function (page) {
    page.evaluate(function () { 
        delete window.callPhantom;
        delete window._phantom;
        var original = {
            createElement: document.createElement,
        };
        document.createElement = function (tag) {
            var elem = original.createElement.call(document, tag);
            if (tag === "video") {
                elem.canPlayType = function () { return "" };
            }
            return elem;
        };
    });        
});

casper.start(config.startUrl, function() {
    this.echo("got "+this.getCurrentUrl());
});

casper.waitForSelector(
    config.selectors.loginForm,
    function() {
        var selectors = {}
        selectors[config.selectors.userInput] = config.credentials.user;
        selectors[config.selectors.passwordInput] = config.credentials.password;
        
        this.fillSelectors(config.selectors.loginForm, selectors, true);

        //this.echo(JSON.stringify(this.getFormValues(config.selectors.loginForm)));// DEBUG
        //this.capture('login.png'); // DEBUG
    },
    function() {
        this.echo("Failed to get to twitter login form");
        if (config.capture.failure)
            this.capture(config.capture.failure);
        this.die("Exiting", 66);
    }
);


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
        this.die("Exiting", 66);
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

            /** Default tweet parser
             *
             * @param jqnode {object} The root jquery object.
             * @param ix {Number} The (zero-based) index of the tweet on the page
             * @returns {object} The parsed tweet object
             */
            function parseTweet(jqnode, ix) {
                // currently ignores subsequent elems
                var html = jqnode.find('.original-tweet').first(); 

                preprocess(html);
                
                var tweet = {
                    type: 'tweet',
                    tweetId: html.attr('data-retweet-id') || html.attr('data-tweet-id'),
                    attr: {},
                    data: {},
                    date: html.find('[data-time-ms]').attr('data-time-ms'),
                    html: html.get(0).outerHTML,
                    text: extractText(html),
                };

                var attrs = html.get(0).attributes;
                Array.prototype.forEach.call(attrs, function(attr) {
                    tweet.attr[attr.name] = attr.value;
                    if (attr.name.indexOf('data-') == 0) {
                        // Unpack certain data attributes into JS primitives, for convenience
                        tweet[toCamelCase(attr.name.slice(5))] =
                            attr.value === 'true'? true :
                            attr.value === 'false'? false :
                            attr.value === undefined? undefined : // avoid isNaN edge case
                            !isNaN(attr.value)? Number(attr.value) :
                            attr.value;
                    }
                });

                return tweet;
                
                // Convert foo-bar-baz -> fooBarBaz
                function toCamelCase(text) {
                    return text.replace(/(-.)/g, toUpper);
                    function toUpper(ix) {
                        return ix.charAt(1).toUpperCase();
                    }
                }

                // Converts the tweet-text node into text
                function extractText(tweet) {
                    return html.find('.tweet-text').text();
                }

                function preprocess(html) {
                    // We don't want elided, click-through URLs.
                    html.find('.tweet-text').find('a[data-expanded-url]').each(replaceWithUrl);
                    
                    function replaceWithUrl(ix, node) {
                        node = $(node);
                        var url = node.attr('data-expanded-url');
                        node.replaceWith(" <a href='"+url+"'>"+url+"</a>");
                    }
                }
            }

            var children = $(config.selectors.stream).children();

            var tweets = children.get()
                .reverse()
                .map($)
                .filter(selectElement)
                .map(parseTweet);

            children.remove();
            return tweets;
        };

        if (config.capture.scrape)
            casper.capture(config.capture.scrape);
        var tweets = casper.evaluate(scrape, config);

        casper.click(config.selectors.updateButton); // update the stream 

        casper.echo("tweets scraped: "+tweets.length);
        output(tweets);
    }

    function pollWrapper() {
        try {
            poll();
        }
        catch(e) {
            casper.echo("exception: "+e, "ERROR");
        }
    }

    var interval = setInterval(pollWrapper, config.pollInterval);
    pollWrapper();
});
