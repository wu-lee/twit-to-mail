/* This reads JSON objects output by twit-to-mailer.js from
 * stdin and mails them.
 */
var email = require('emailjs/email');
var path = require('path');
var fs = require('fs');
var split = require('split');
var child_process = require('child_process');
var config = require('./config.js') || process.exit(-1);
if (!config.stateFile)
    config.stateFile = './state.json';
var state = require(config.stateFile);
if (!state.tweets) state.tweets = [];
if (!state.seen) state.seen = [];


var customFilter = function() { return true };
if (config.filterFile) {
    console.log("loading custom filter code in "+config.filterFile);
    customFilter = require(config.filterFile);
    if (!(customFilter instanceof Function)) {
	console.log("invalid custom filter: not a function");
	process.exit(-1);
    }
}


function noOp() {};

// Object to capture process exits and call app specific cleanup function
function cleanup(callback) {
    
    // attach user callback to the process event emitter
    // if no callback, it will still exit gracefully on Ctrl-C
    callback = callback || noOp;
    process.on('cleanup',callback);
    
    // do app specific cleaning before exiting
    process.on('exit', function () {
	process.emit('cleanup');
    });
    
    // catch ctrl+c event and exit normally
    process.on('SIGINT', function () {
	console.log('Ctrl-C...');
	process.exit(2);
    });
    
    //catch uncaught exceptions, trace, then exit normally
    process.on('uncaughtException', function(e) {
	console.log('Uncaught Exception...');
	console.log(e.stack);
	process.exit(99);
    });
};

function sourceEscape(name) {
    function escape(ch) {
	return '%'+('0'+ch.toCharCodeAt(0).toString(16)).slice(-2);
    }

    return name.replace(/()<>@,;:\\".[]/g, escape);
}

function send(tweets) {
    var server  = email.server.connect(config.mailer.server);
    // FIXME errors?

    for(var ix = 0; ix < tweets.length; ix += 1) {
        var tweet = tweets[ix];
        
        var splitAfter = 30;
        var tweeter = (tweet.retweeter == null? tweet.screenName : tweet.retweeter);
        var source = tweet.retweeter?
            (tweet.name + " retweeted by "+tweet.retweeter):
            (tweet.name);
        var text = (tweet.text || '');
        var splitPoint = text.indexOf(' ', splitAfter);
        var subject = splitPoint > 0? 
            text.substr(0, splitPoint) : text;
        var opts = {
            text: tweet.text,
            from: sourceEscape(source) +' <'+ tweeter +'@twitmonkey.net>',
            to: config.mailer.to,
            subject: subject,
            date: new Date(Number(tweet.date)).toString(),
            'x-tweet-id': tweet.tweetId,
            attachment: [
                {data: formatTweet(tweet), alternative:true},
            ],
        };
        console.log("send to",opts.to,": ",opts.subject);
        server.send(opts, function(err, message) { if (err) console.log(err); });

	state.seen.unshift(tweet.tweetId);
	state.seen.length = (config.numDedupTweets || 200);
    }
}

function formatTweet(tweet) {
    return '<!DOCTYPE html>\
<html>\
<head>\
  <meta charset="utf-8">\
  <base href="http://twitter.com" target="_blank"></base>\
  <title>Tweets</title>\
  <link href="https://abs.twimg.com/a/1448417839/css/t1/twitter_core.bundle.css" rel="stylesheet"></link>\
  <link href="https://abs.twimg.com/a/1448417839/css/t1/twitter_more_1.bundle.css" rel="stylesheet"></link>\
  <link href="https://abs.twimg.com/a/1448417839/css/t1/twitter_more_2.bundle.css" rel="stylesheet"></link>\
  <style>\
    .stream-container {\
       margin: 1em 58px;\
    }\
    .OldMedia, .AdaptiveMedia {\
       max-height: none !important;\
    }\
    .OldMedia img, .AdaptiveMedia img {\
       top: auto !important;\
    }\
  </style>\
</head>\
<body >\
  <h1 class="page">Tweets</h1>\
  <div class="stream-container">\
  <div class="stream">\
  <ol>\
'+tweet.html+(tweet.expandedFooter || '')+'\
  </ol>\
  </div>\
  </div>\
</body>\
</html>';
}

function writeState() {
    fs.writeFileSync(config.stateFile, JSON.stringify(state));
    console.log("saving state");
}

function dedupFilter(tweet) {
    return state.seen.indexOf(tweet.tweetId) < 0;
}

function tweetFilter(tweet) {
    return dedupFilter(tweet) && customFilter(tweet);
}


function processLine (line) {
    if (!line.match("^[{]")) {
        console.log("scraper: ",line);
        return;
    }
    var tweet = JSON.parse(line);
    
    if (tweetFilter(tweet)) {
	console.log("received tweet "+tweet.tweetId+": "+tweet.text.substr(0, 50));
	state.tweets.push(tweet);
    }
    else {
	console.log("ignoring tweet "+tweet.tweetId+": "+tweet.text.substr(0, 50));
    }
}

var phantomjsDir = path.resolve(
    process.cwd(),
    path.dirname(config.phantomjsPath)
);
var child = child_process.spawn(
    config.casperjsPath,
    (config.casperjsOpts || []).concat('./scraper.js'),
    { env: { PATH: process.env.PATH+':'+phantomjsDir }}
);

child.on('error', function(err) { console.log(err); process.exit(-1); })

cleanup(writeState);

child.stdout.pipe(split()).on('data', processLine)

function sendPending() {
    if (state.tweets.length > 0) {
        send(state.tweets);
        state.tweets.length = 0;
    }
}

setInterval(sendPending, config.mailer.interval);
sendPending();
