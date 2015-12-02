var casper = require('casper').create({
    verbose: true, 
    logLevel: 'debug',
    pageSettings: {
        //loadImages:  false,         // The WebPage instance used by Casper will
        loadPlugins: false,
        userAgent: "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:42.0) Gecko/20100101 Firefox/42.0",
    },
});

var credentials = {
    user: 'someone',
    password: 'secretg',
};

// print out all the messages in the headless browser context
casper.on('remote.message', function(msg) {
    this.echo('remote message caught: ' + msg);
});

// print out all the messages in the headless browser context
casper.on("page.error", function(msg, trace) {
    this.echo("Page Error: " + msg, "ERROR");
});

casper.start('http://twitter.com/', function() {
    this.echo(this.getTitle());
});

var loginFormSelector = 'form.signin';
casper.waitForSelector(loginFormSelector, function() {
    this.fillSelectors(loginFormSelector, {
        '#signin-email': credentials.user,
        '#signin-password': credentials.password,
    }, true);

    //this.echo(JSON.stringify(this.getFormValues(loginFormSelector)));// DEBUG
    this.capture('login.png');
});

var streamSelector = "#stream-items-id";
casper.waitForSelector(streamSelector,
                       function() {
                           this.echo("Got to twitter stream");                           
                           this.capture('twitter.png');
                       },
                       function() {
                           this.echo("Failed to get to twitter stream");
                           this.capture('twitter.png');
                       }
                      );


casper.run();

