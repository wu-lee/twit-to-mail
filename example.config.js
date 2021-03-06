module.exports = {
    credentials: { // Twitter login credentials.
        user: 'twitteruser',
        password: 'secret',
    },
    startUrl: 'https://twitter.com/', // Twitter page to open on start
    pollInterval: 1000*60*15, // Scraper polling frequency in milliseconds
    selectors: { // Selectors etc. passed to casper.waitForSelector. Generally not user servicable.
        loginForm: 'form.signin',
        userInput: '#signin-email',
        passwordInput: '#signin-password',
        stream: "#stream-items-id",
        updateButton: '#global-nav-home a',
    },
    capture: { // Optional screenshot files
//        scrape: '/home/nick/public_html/scrape.png', // Successful scrapes here
//        failure: '/home/nick/public_html/scrape.failure.png', // Failed scrapes here
    },
    casperjsPath: './node_modules/.bin/casperjs', // Path to casperjs
    phantomjsDir: './node_modules/casperjs/node_modules/.bin', // Path to phantomjs
    casper: { // Settings passed to casper.create(), for development convenience.
        verbose: true, 
        logLevel: 'debug',
        pageSettings: {
            loadPlugins: false,
            userAgent: "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:42.0) Gecko/20100101 Firefox/42.0",
        },
    },
    mailer: {
        server: { // Mailserver parameters passed to emailjs.email.server.connect
            user: 'mailuser',
            password: 'secret',
            host: 'mail.example.com',
            tls: true,
            timeout: 15000,
            port: 25,
        },
        to: 'recipient@example.com',
        from: 'twitmonkey@twitmonkey.net',
        interval: 1000*60*1, // Sending frequency, in milliseconds
//        subjectSplitAfter: 30, // Sets the truncation length used for subject line
    },
//    filter: require('./customFilter.js'), // Load a custom tweet filter
//    formatter: // require('./customFormatter.js'), // Load a custom tweet formatter function, or
//    formatter: { // define settings for default formatter
//        attachmentTemplate: 'foo<tweet/>bar', // A custom tweet attachment for the default formatter
//    },
};
