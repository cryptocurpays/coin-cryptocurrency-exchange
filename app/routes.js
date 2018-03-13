// app/routes.js
module.exports = function(app, passport) {
	app.use(function(req, res, next){

		next();
	});

	// =====================================
	// HOME PAGE (with login links) ========
	// =====================================
	app.get('/', function(req, res) {
		res.render('index.ejs'); // load the index.ejs file
	});

	// =====================================
	// LOGIN ===============================
	// =====================================
	// show the login form
	app.get('/login', function(req, res) {

		// render the page and pass in any flash data if it exists
		res.render('login.ejs', { message: req.flash('loginMessage') });
	});

	// process the login form
	app.post('/login', passport.authenticate('local-login', {
            successRedirect : '/profile', // redirect to the secure profile section
            failureRedirect : '/login', // redirect back to the signup page if there is an error
            failureFlash : true // allow flash messages
		}),
        function(req, res) {
            console.log("hello");

            if (req.body.remember) {
              req.session.cookie.maxAge = 1000 * 60 * 3;
            } else {
              req.session.cookie.expires = false;
            }
        res.redirect('/');
    });

	// =====================================
	// SIGNUP ==============================
	// =====================================
	// show the signup form
	app.get('/signup', function(req, res) {
		// render the page and pass in any flash data if it exists
		res.render('signup.ejs', { message: req.flash('signupMessage') });
	});

	// process the signup form
	app.post('/signup', passport.authenticate('local-signup', {
		successRedirect : '/profile', // redirect to the secure profile section
		failureRedirect : '/signup', // redirect back to the signup page if there is an error
		failureFlash : true // allow flash messages
	}));

	// =====================================
	// PROFILE SECTION =========================
	// =====================================
	// we will want this protected so you have to be logged in to visit
	// we will use route middleware to verify this (the isLoggedIn function)
	app.get('/profile', isLoggedIn, function(req, res) {
		console.log(req.session.id)


		res.render('profile.ejs', {
			user : req.user // get the user out of session and pass to template
		});
	});

	// =====================================
	// LOGOUT ==============================
	// =====================================
	app.get('/logout', function(req, res) {
		req.logout();
		res.redirect('/');
	});


	//Leo 绘制eth转账二维码界面
	app.get('/deposit', function(req, res) {
		// render the page and pass in any flash data if it exist
		var QRCode = require('qrcode');
		const DBService =require('./../service/db_service');
		DBService.getUserByUsername(req.user.username,function (err, rows) {
            if (err){
                console.log(err);
                //	return done(false);
            }
            if (rows.length==0){
                console.log("Cannot find this user name in DB!");
                //	return done(false);
            }
            QRCode.toDataURL(rows[0].eth_address, function (err, url) {
            	let eth_url = url;
            	QRCode.toDataURL(this.row.bch_address,function (err1,url1) {
					let bch_url = url1;
                    this.res.render('deposit.ejs', { user: this.req.user, imgUrlEth: eth_url,imgUrlBCH:bch_url});
                }.bind({row: rows[0],res:res,req:req}))
            }.bind({row: rows[0],res:res,req:req}))
        });
	});

	//Leo  eth转出接口
	app.post('/ethwithdraw',function(req, res){
		let Eth = require('./eth_transactions');
        Eth.withdrawEth(req.user,req.body.ethAddress,req.body.ethAmount,function (err,data) {
			if(err) console.log(err);
			else{
                res.render('withdraw.ejs', { user: req.user,msg: "Coin was withdrawn into Ethereum. The transaction ID is "+data});
            }
        });

	});
    app.post('/bchwithdraw',function(req, res){
    	console.log(req.user);
        let Bch = require('./bch_transactions');
        Bch.withdrawBCH(req.user.username,req.body.bchAddress,req.body.bchAmount,function (err,data) {
            if(err) console.log(err);
            else{
                res.render('withdraw.ejs', { user: req.user,msg: "Coin was withdrawn into Bitcoin Cash. The transaction ID is "+data});
            }
        });

    });
    app.get('/withdraw',function(req, res){
        console.log(req.body);
        res.render('withdraw.ejs', { user: req.user, msg: "Withdraw Coin to Eth or Bch"});
    });
};




// route middleware to make sure
function isLoggedIn(req, res, next) {

	// if user is authenticated in the session, carry on
	if (req.isAuthenticated())
		return next();

	// if they aren't redirect them to the home page
	res.redirect('/');
}
