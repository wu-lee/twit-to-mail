var config = require('./config.js');
var fs = require('fs');
var casper = require('casper').create(config.casper);
if (typeof(config.parser) === 'string') {
    // If config.parser is a string, read the file
    // (its readability should have been checked by twit-to-mail.js)
    config.parser = fs.read(config.parser, {charset: 'utf8'});
}


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
        
        //this.echo(JSON.stringify(this.getFormValues(loginFormSelector)));// DEBUG
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

        // Define the parser once, as a global
        console.log(">>>>>>>>>>");
//        casper.evaluate(defParser, config.parser);
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

            var children = $(config.selectors.stream).children();

            var tweets = children.get()
                .reverse()
                .map($)
                .filter(selectElement)
                .map(window.parser);

            children.remove();
            return tweets;
        }

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


/** Tweet parser definer.
 *
 * This is run in the context of casper, so must be self-contained and
 * not use any local functions or variables (see caspar docs for
 * casper.execute())
 *
 * It defines the parser() function in that context.
 *
 * The config argument may be a string, in which case it is
 * eval()ed and the result returned. Otherwise it is used to
 * configure the default parser function returned.
 *
 * @config {Function|Object} Defines the parser
 */
function defParser(config) {
    console.log("defParser", config);
    if (typeof(config) === 'string') {
        // Wrap it. Pass also a function which can be used to
        // reconstruct the default parser.
        config = "function mkParser(config) {\n"+parseTweet.toString()+"\n}\n"+
            "function evaluate(module, mkParser) {\n"+config+"\n}\n"+
            "module = {};\n"+
            "evaluate(module, mkParser);\n"+
            "window.parser = module.export";
        console.error("evaluating parser function definition:", config); // DEBUG

        window.parser = "fooey";
        eval(config);
        return;
    }
    
    if (typeof(config) !== 'object')
        config = {};

    parser = parseTweet;
    return;
    
    /** Default tweet parser
     *
     * @param jqnode {object} The root jquery object.
     * @param ix {Number} The (zero-based) index of the tweet on the page
     * @returns {object} The parsed tweet object
     */
    function parseTweet(jqnode, ix) {
        console.log("CALLING parseTweet");
        // currently ignores subsequent elems
        var html = jqnode.find('.original-tweet').first();

        preprocess(html);

        WHOOPSIE
    }
}
