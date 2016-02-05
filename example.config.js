module.exports = {
    credentials: {
        user: 'twitteruser',
        password: 'secret',
    },
    startUrl: 'https://twitter.com/',
    pollInterval: 1000*10, // millis
    selectors: {
        loginForm: 'form.signin',
        userInput: '#signin-email',
        passwordInput: '#signin-password',
        stream: "#stream-items-id",
        updateButton: '#global-nav-home a',
    },
    capture: {},
    casperjsPath: './node_modules/.bin/casperjs',
    phantomjsDir: './node_modules/casperjs/node_modules/.bin',
    casper: {
        verbose: true, 
        logLevel: 'debug',
        pageSettings: {
            loadPlugins: false,
            userAgent: "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:42.0) Gecko/20100101 Firefox/42.0",
        },
    },
    mailer: {
        server: {
            user: 'mailuser',
            password: 'secret',
            host: 'mail.example.com',
            tls: true,
            timeout: 15000,
            port: 25,
        },
        to: 'recipient@example.com',
        from: 'twitmonkey@twitmonkey.net',
        interval: 1000*60*1, // Millis
    },
};
