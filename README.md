A twitter-to-mail gateway.
==========================

Monitors a twitter account's stream, and sends the tweets as emails to
an address of your choice.

## Motivation

I find following twitter a somewhat exhausting activity. Partly this
is just due to the volume of tweets which it can spew, but I also find
twitter's presentation awkward: backwards, and subject to the vagaries
of a browser page.  Whereas I find email much simpler to use: my
client can filter incoming mail into folders, and it keep track of
which emails I've seen or not.  I can edit and forward messages,
archive them, delete them and so on.

So something which turns a twitter stream into an email stream seems
obvious.


## Requirements

* nodejs
* use of a SMTP server to send through

## Installation

Install nodejs/npm as per your OS (you may want a recent version), then:

    git clone https://github.com/wu-lee/twit-to-mail
    cd twit-to-mail
    npm install # installs dependencies in ./node_modules
    cp example.config.js config.js # default config

## Configuration

Edit `config.js` to set your email and twitter login, etc. and make
sure it is set to be readable only by yourself if there are chances
someone may try to read the file. On Unix:

    chmod go-rwx config.js

FIXME describe the configuration settings.

You can add a `customFilter.js` file to omit selected tweets.  The
file should be a nodejs module which exports a single function that
accepts a JS tweet object, and returns `true` for tweets to send, and
`false` for tweets to omit.

For example:

    module.exports = function(tweet) {
        return !tweet.promoted;
    }

## Running

Simply run the `twit-to-mail.js` script as you would any nodejs program:

    node twit-to-mail.js

A timestamped log will be written on stdout, you may wish to pipe this
somewhere.  Rotation can be managed with logrotate or a similar tool.


## Diagnostics

If you need to work out why the scraper is not working, you can run the scraper.js script directly:

    casperjs scraper.js

Note, this assumes casperjs is installed and on the path.  The latter
is not true by default, you may need to supply the path.  On Unix:

    PATH=$PATH:$PWD/node_modules/.bin casperjs scraper.js

The config.js can be used to set a location to write screen dumps of
each run, and the verbosity and debug levels used by casperjs (amongst
other things):

    module.exports = {

        // [snip...]

        capture: {
            scrape: '/home/myname/public_html/scrape.png',
            failure: '/home/myname/public_html/scrape.failure.png',
        },
        casper: {
            verbose: true,
            logLevel: 'debug',
        },

        // [snip...]

    };

## Caveats

Works for me at the moment, however consider this alpha software. It
needs monitoring and the odd restart.

No guarantees that it is fit for use are made, nor liability accepted
in the unlikely event something bad happens as a result of running it.

Subject to being broken whenever Twitter feels like it.

Note that I have only tested this on Debian Linux. The documentation
here is rather brief and assumes you are running it on something
similar to me, as I don't have easy access to a Windows, OS X or other
machine to test it on, nor copious amounts of time to do so.

Emails sent currently contain links to tweeted images etc. rather than
inlining them.  This is partly because that is easier to do, but you
may find you need to tell your mail client that these emails are not
scams before it will display them.

## Issues

Bug reports and improvements welcome, use the issues tool on the
github project:

    https://github.com/wu-lee/twit-to-mail/

## License

Currently uses the Affero GPL 3.0 license.
