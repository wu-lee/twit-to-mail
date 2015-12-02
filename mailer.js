/* This reads JSON objects output by twit-to-mailer.js from
 * stdin and mails them.
 */
var email = require("emailjs/email");
var split = require('split');
var config = require('./config.js');

function send(tweets) {
    var server  = email.server.connect(config.mailer.server);
    // FIXME errors?

    for(var ix = 0; ix < tweets.length; ix += 1) {
        var tweet = tweets[ix];
        
        var splitAfter = 30;
        var tweeter = tweet.retweeter?
            (tweet.name + " retweeted by "+tweet.retweeter):
            (tweet.name);
        var text = (tweet.text || '');
        var splitPoint = text.indexOf(' ', splitAfter);
        var subject = splitPoint > 0? 
            text.substr(0, splitPoint) : text;
        var opts = {
            text: tweet.text,
            from: tweeter+' <twitmonkey@twitmonkey.net>',
            to: config.mailer.to,
            subject: subject,
            date: new Date(Number(tweet.date)).toString(),
            attachment: [
                {data: formatTweet(tweet), alternative:true},
            ],
        };
        console.log("send to",opts.to,": ",opts.subject);
        server.send(opts, function(err, message) { if (err) console.log(err); });
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
    .OldMedia {\
       max-height: none;\
    }\
    .OldMedia img {\
       top: auto;\
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

var tweets = [];
function processLine (line) {
    if (!line.match("^[{]"))
        return;
    var tweet = JSON.parse(line);
    console.log("received tweet, got "+tweets.length+": "+tweet.tweetId);
    tweets.push(tweet);
}

process.stdin.pipe(split()).on('data', processLine)

setInterval(function() {
    if (tweets.length > 0) {
        send(tweets);
        tweets.length = 0;
    }
}, config.mailer.interval);
