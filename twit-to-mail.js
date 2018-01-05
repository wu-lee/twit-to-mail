/* This reads JSON objects output by twit-to-mailer.js from
 * stdin and mails them.
 */
global.twitToMail = true; // Flag for environment detection in config.js
var email = require('emailjs/email');
var path = require('path');
var fs = require('fs');
var split = require('split');
var child_process = require('child_process');
var config = require('./config.js') || process.exit(-1);
if (!config.stateFile)
    config.stateFile = './state.json';
var state = {};
try {
    state = require(config.stateFile);
}
catch(e) { // No such file, create it                                                                 
    writeState();
}
if (!state.tweets) state.tweets = [];
if (!state.seen) state.seen = [];


var filter = config.filter || noOp; // noOp returns true, so doesn't filter

// This may exit the process if it fails
var formatter = mkFormatter(config.formatter); 

function log(message) {
    [].unshift.call(arguments, new Date().toLocaleString());
    console.log.apply(console, arguments)
}

var notified = false;
function notify(subject, text) {
    if (notified)
        return;
    
    try {
        sendNotification(subject, text);
    }
    catch(e) {
        log("failed to send notification email: "+e);
    }
    
    notified = true;
}

function noOp() { return true; };

// Object to capture process exits and call app specific cleanup function
function cleanup(callback) {
 
    // attach user callback to the process event emitter
    // if no callback, it will still exit gracefully on Ctrl-C
    callback = callback || noOp;
    process.on('cleanup',callback);
    
    // do app specific cleaning before exiting
    process.on('exit', function (code) {
        notify("twit-to-mail.js exited: "+code);
        process.emit('cleanup');
    });
    
    // catch ctrl+c event and exit normally
    process.on('SIGINT', function () {
        console.log('Ctrl-C...');
        process.exit(98);
    });
    
    //catch uncaught exceptions, trace, then exit normally
    process.on('uncaughtException', function(e) {
        log('Uncaught Exception...');
        log(e.stack);
        notify("twit-to-mail.js exception: "+e, JSON.stringify(e));
        process.exit(99);
    });
};

/** Parse the config.formatter entry, if present
 *
 * @param {object} config Optionally, the config.formatter element
 * @returns a tweet formatter function, accepting the tweet instance
 * and returning a string body attachment.
 */
function mkFormatter(config) {
    if (!config)
        config = {};
    
    if (typeof(config) === 'function')
        return config; // A custom function

    // This may exit the process
    var attachmentTemplate = parseAttachmentTemplate(
        'resources/attachmentTemplate.html',
        config.attachmentTemplate
    );

    return function(tweet) {
        return attachmentTemplate[0] +
            tweet.html+(tweet.expandedFooter || '') +
            attachmentTemplate[1];
    };
}


/** Loads a string from the file, if not supplied as the second paramter
 *
 * If the template parameter is falsy, and the file is absent, prints a diagnostic
 * and terminates the process.
 *
 * @param {string} file The file to load
 * @param {string} template An optional template to use instead of the file
 * @returns {string[]} A two-element array containing the head and tail sections of the attachment
 */
function parseAttachmentTemplate(file, template) {
    if (!template) {
        try {
            template = fs.readFileSync(file, 'utf8');
        }
        catch(e) { // No such file
            console.error("failed to load '"+file+"': "+e.message);
            process.exit(-1);
        }
    }
    // Extract head and tail elements of template as elements 0 and 1
    template = template.split('<tweet/>', 2);
    if (template.length != 2)
        console.error("attachment template malformed, may have no <tweet/> placeholder");
    return [template[0] || '', template[1] || ''];
}

function sourceEscape(name) {
    function quote(str) {
        return '"'+str.replace(/(["\\])/g, '\\$1')+'"'; 
    }
    name = name.replace(/[\000-\0390]/g, ' ');
    return name.match(/[()<>@,;:\\".[\]]/)? quote(name) : name;
}

function sendNotification(subject, text) {
    var server  = email.server.connect(config.mailer.server);
    // FIXME errors?

    var opts = {
        text: text || " ",
        from: 'Twitter Gateway <gateway@twitmonkey.net>',
        to: config.mailer.to,
        subject: subject || "empty notification",
        date: new Date().toString(),
    };
    log("notify "+opts.to+": "+opts.subject);
    server.send(opts, function(err, message) { if (err) log(err); });
}

function send(tweets) {
    var server  = email.server.connect(config.mailer.server);
    // FIXME errors?

    for(var ix = 0; ix < tweets.length; ix += 1) {
        var tweet = tweets[ix];
        
        var splitAfter = config.mailer.subjectSplitAfter || 30;
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
                {data: formatter(tweet), alternative:true},
            ],
        };
        log("send to "+opts.to+": "+opts.subject);
        server.send(opts, function(err, message) { if (err) log(err); });

        state.seen.unshift(tweet.tweetId);
        state.seen.length = (config.numDedupTweets || 200);
    }
}

function writeState() {
    fs.writeFileSync(config.stateFile, JSON.stringify(state));
    log("saving state");
}

function dedupFilter(tweet) {
    return state.seen.indexOf(tweet.tweetId) < 0;
}

function tweetFilter(tweet) {
    return dedupFilter(tweet) && filter(tweet);
}


function processLine (line) {
    if (!line.match("^[{]")) {
        log("scraper: ",line);
        return;
    }
    var tweet = JSON.parse(line);
    
    if (tweetFilter(tweet)) {
        log("received tweet "+tweet.tweetId+": "+tweet.text.substr(0, 50));
        state.tweets.push(tweet);
    }
    else {
        log("ignoring tweet "+tweet.tweetId+": "+tweet.text.substr(0, 50));
    }
}

var phantomjsDir = path.resolve(
    process.cwd(),
    config.phantomjsDir || 'node_modules/.bin'
);

function Scraper() {
    var self = this; // for use in inner closures
    this.process = child_process.spawn(
        config.casperjsPath,
        (config.casperjsOpts || []).concat('./scraper.js'),
        { env: { PATH: process.env.PATH+':'+phantomjsDir }}
    );
    var pid = this.process.pid;

    this.process.on('error', function(err) {
        log("error managing scraper.js (pid "+pid+"): "+err);
        notify("error managing scraper.js", err);
        process.exit(-1);
    });
    this.process.on('exit', function(code, signal) { 
        var msg = "scraper.js (pid "+pid+")"+
            (code==null? "" : " exited with code "+code)+
            (signal==null? "" : " was halted with signal "+signal);
        log(msg);

        // Special case scraper.js can pass to us
        if (code === 66) {
            notify("unrecoverable termination of scraper.js", msg);
            process.exit(66);
        }

        notify("unexpected termination of scraper.js", msg);

        // relaunch the scraper
        self.process = new Scraper();
    });

    this.process.stdout.pipe(split()).on('data', processLine)
    this.process.stderr.pipe(split()).on('data', processLine)

    return this;
}

var scraper = new Scraper();

cleanup(writeState);

function sendPending() {
    if (state.tweets.length > 0) {
        send(state.tweets);
        state.tweets.length = 0;
    }
}

setInterval(sendPending, config.mailer.interval);
sendPending();
