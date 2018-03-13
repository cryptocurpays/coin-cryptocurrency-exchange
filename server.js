// server.js

// set up ======================================================================
// get all the tools we need
var express  = require('express');
var session  = require('express-session');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var morgan = require('morgan');
var app      = express();
var port     = process.env.PORT || 8080;
var passport = require('passport');
var flash    = require('connect-flash');
var ethConfig = require('./config/ethereum');


// Initiate Ethereum Keystore and Eth Web3 instance. Start to check node for new unrecorded transactions.
var keystore = require('./service/keystoreeth');
var Eth = require('./app/eth_transactions');
keystore.init(function (ifSucceed,ksi) {
    if(ifSucceed){
        Eth.init();
    }
});

// Init BCH HD Public key and wallet accounts
var BCH = require('./app/bch_transactions');
var bchKeyUtils= require('./service/keystorebch');
bchKeyUtils.init(function (err) {
    if(err);
    else
        BCH.updateUnspentTx();
});

BCH.initRecipientAddresses();

setInterval(function () {
    Eth.checkBlockChainForMinedTxService();
    BCH.checkBlockChainForDepositTx();
    BCH.updateSubmittedWithdrawTxs();
},ethConfig.ethDepositCheckInterval);

// configuration ===============================================================
// connect to our database

require('./config/passport')(passport); // pass passport for configuration


// set up our express application
app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser.urlencoded({
	extended: true
}));
app.use(bodyParser.json());

app.set('view engine', 'ejs'); // set up ejs for templating

// required for passport
app.use(session({
	secret: 'vidyapathaisalwaysrunning',
	resave: true,
	saveUninitialized: true
 } )); // session secret
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session



// routes ======================================================================
require('./app/routes.js')(app, passport); // load our routes and pass in our app and fully configured passport

// launch ======================================================================
app.listen(port);
console.log('The magic happens on port ' + port);