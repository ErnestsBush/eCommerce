const port = 8080;
const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const expressSanitizer = require('express-sanitizer');
const paypal = require('paypal-rest-sdk');
paypal.configure({
	'mode':'sandbox',
	'client_id':'AQkXGAzXpfdqSpZbY5oTYbUQTCavpkyXkBK6XdsKVCivVqFSxsVsjQiyT3aXfrkecglMujpLQbSzLfZg',
	'client_secret':'EDNGbVyn0WbhFKDD7mEA8QQd28Vdr2WqePCcxCENLRpUaBCpYphY2J5tMWGmwxj9G6Xf5RaZyhdZr0ru'
});
const app = express();

app.set('view engine', 'ejs');
app.use('/public',express.static('public'));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:false}));
app.use(expressSanitizer());

var arrayDB = require('./public/DBdata.js');

mongoose.connect('mongodb://localhost/ecommerceDB');
mongoose.connection.once('open',function(){
	console.log('successfully connected to DB...');
}).on('error',function(err){
	console.log(err);
});

const contactEntry = require('./models/contactEntry');
const orderEntry = require('./models/orderEntry');

app.get('/',function(req,res){
	var cookieValue = req.cookies;
	var cookieCart = req.sanitize(cookieValue.cart);
	if(cookieCart){
		var cookieArray = JSON.parse(cookieCart);
		
	}else{
		var cookieArray = [];
	}

	res.render('homePage',{listings:arrayDB.slice(0,3),cartNumb:cookieArray.length});
});

app.get('/products',function(req,res){
	var cookieValue = req.cookies;
	var cookieCart = req.sanitize(cookieValue.cart);

	if(cookieCart){
		var cookieArray = JSON.parse(cookieCart);
	}else{
		var cookieArray = [];
	}
	res.render('productsPage',{products:arrayDB,cartNumb:cookieArray.length});
});

app.get('/products/:ID',function(req,res){
	var cookieValue = req.cookies;
	var cookieCart = req.sanitize(cookieValue.cart);
	var ID = req.sanitize(req.params.ID);
	
	if(cookieCart){
		var cookieArray = JSON.parse(cookieCart);
	}else{
		var cookieArray = [];
	}

	for(i=0;i<arrayDB.length;i++){
		if(ID == arrayDB[i].ID){
			res.render('listingPage',{listing:arrayDB[i],cartNumb:cookieArray.length});
		}
	}

});

app.get('/buyNow/:ID',function(req,res){
	var cookieValue = req.cookies;
	var cookieCart = req.sanitize(cookieValue.cart);
	var ID = req.sanitize(req.params.ID);

	if(!cookieCart){
		var cookieArray = [];
		cookieArray.push(ID);
		var cookieStringArray = JSON.stringify(cookieArray);
	}else{
		var cookieStringArray = cookieCart;
		var cookieArray = JSON.parse(cookieStringArray);
		cookieArray.push(ID);
		cookieStringArray = JSON.stringify(cookieArray);
		res.clearCookie('cart');
	}
	
	res.cookie('cart',cookieStringArray);
	res.redirect('../cart');
});

app.get('/cart',function(req,res){
	var cookieValue = req.cookies;
	var cookieCart = req.sanitize(cookieValue.cart);

	if(cookieCart){
		var cookieArray = JSON.parse(cookieCart);
		cookieArray.sort();

		var tempCartArray = [];

		for(var i=0;i<cookieArray.length;i++){
			for(var c=0;c<arrayDB.length;c++){
				if(cookieArray[i] == arrayDB[c].ID){
					tempCartArray.push(arrayDB[c]);
				}
			}
		}

		var cartTotal = 0;
		for(var i=0;i<tempCartArray.length;i++){
			cartTotal = cartTotal + tempCartArray[i].price;
		}
	}else{
		var cartTotal = 0;
		var tempCartArray = [];
		var cookieArray = [];
	}

	res.render('cartPage',{cart:cookieCart,cartNumb:cookieArray.length,cartValues:tempCartArray,total:cartTotal});
});

app.get('/remove/:ID',function(req,res){
	var cookieValue = req.cookies;
	var cookieCart = req.sanitize(cookieValue.cart);
	var cookieArray = JSON.parse(cookieCart);
	var IDremove = req.sanitize(req.params.ID);

	for(var i=0;i<cookieArray.length;i++){
		if(cookieArray[i] == IDremove){
			cookieArray.splice(i,1);
			break;
		}
	}

	var stringArray = JSON.stringify(cookieArray);
	res.clearCookie('cart');
	res.cookie('cart',stringArray);
	res.redirect('/cart');
});

app.get('/contact',function(req,res){
	var cookieValue = req.cookies;
	var cookieCart = req.sanitize(cookieValue.cart);

	if(cookieCart){
		var cookieArray = JSON.parse(cookieCart);
	}else{
		var cookieArray = [];
	}
	res.render('contactPage',{cartNumb:cookieArray.length});
});

app.get('/submission/:text',function(req,res){
	var cookieValue = req.cookies;
	var cookieCart = req.sanitize(cookieValue.cart);

	if(cookieCart){
		var cookieArray = JSON.parse(cookieCart);
	}else{
		var cookieArray = [];
	}

	var text = req.params.text;

	res.render('submissionPage',{cartNumb:cookieArray.length,successText:text});
});

app.post('/submit/:type',function(req,res){
	var type = req.sanitize(req.params.type);
	var cookieCart = req.sanitize(cookieValue.cart);

	if(type == 'contact'){
		var contactName = req.sanitize(req.body.name);
		var contactEmail = req.sanitize(req.body.email);
		var contactSubject = req.sanitize(req.body.subject);
		var contactComment = req.sanitize(req.body.comment);

		var newContactEntry = new contactEntry({
			name: contactName,
			email: contactEmail,
			subject: contactSubject,
			comment: contactComment
		});

		newContactEntry.save();
		res.redirect('/submission/Form_Successfully_Submitted');
	}else{
		res.send('submit type not yet made');
	}
});

app.post('/chargePaypal',function(req,res){
	var items = req.sanitize(req.body.description);
	items = JSON.parse(items);

	var chargeAmount = 5;

	for(var i=0;i<items.length;i++){
		for(var c=0;c<arrayDB.length;c++){
			if(items[i] == arrayDB[c].ID){
				chargeAmount = chargeAmount + arrayDB[c].price;
			}
		}
	}


	var create_payment_json = {
		'intent':'sale',
		'payer':{
			'payment_method':'paypal'
		},
		'redirect_urls':{
			'return_url':`https://localhost:8080/success?price=${chargeAmount}&description=${items}`,
			'cancel_url':'https://localhost:8080/cancel'
		},
		'transactions':[{
			'item_list':{
				'items':[{
					'name':'eCommerce Sale',
					'sku':`${items}`,
					'price':`${chargeAmount}`,
					'currency':'USD',
					'quantity':1
				}]
			},
			'amount':{
				'currency':'USD',
				'total':`${chargeAmount}`
			},
			'description':'Sale of Color(s)'
		}]
	};

	paypal.payment.create(create_payment_json,function(error,payment){
		if(error){
			res.send('an error has occured');
			throw error;
		}else{
			for(var i=0;i<payment.links.length;i++){
				if(payment.links[i].rel === 'approval_url'){
					res.redirect(payment.links[i].href);
				}
			}
		}
	});

});
app.get('/success',function(req,res){
	var payerID = req.sanitize(req.query.PayerID);
	var paymentID = req.sanitize(req.query.paymentId);
	var chargeAmount = req.sanitize(req.query.price);
	var items = req.sanitize(req.query.description);

	var execute_payment_json = {
		'payer_id':payerID,
		'transactions':[{
			'amount':{
				'currency':'USD',
				'total':`${chargeAmount}`
			}
		}]
	};

	paypal.payment.execute(paymentID,execute_payment_json,function(error,payment){
		if(error){
			res.send('an error has occured');
			throw error;
		}else{
			var shippingEmail = req.sanitize(payment.payer.payer_info.email);
			var shippingName = req.sanitize(payment.payer.payer_info.shipping_address.recipient_name);
			var shippingAddress = req.sanitize(payment.payer.payer_info.shipping_address.line1) + ' ' //continues to next line
									+ req.sanitize(payment.payer.payer_info.shipping_address.line2);
			var shippingZIP = req.sanitize(payment.payer.payer_info.shipping_address.postal_code);
			var shippingState = req.sanitize(payment.payer.payer_info.shipping_address.state);
			var shippingCity = req.sanitize(payment.payer.payer_info.shipping_address.city);
			var shippingCountry = req.sanitize(payment.payer.payer_info.shipping_address.country_code);
			var Type = 'Paypal';

			var newOrderEntry = new orderEntry({
				name:shippingName,
				email:shippingEmail,
				address:shippingAddress,
				zip:shippingZIP,
				city:shippingCity,
				country:shippingCountry,
				description:items,
				grossTotal:chargeAmount,
				type:Type
			});

			newOrderEntry.save();
			res.clearCookie('cart');
			res.redirect('/submission/Your_Payment_Was_Successful');
		}
	});

});


//This is an Ajax route
app.get('/product/:type',function(req,res){
	var type = req.sanitize(req.params.type);
	var tempArray = [];

	for(i=0;i<arrayDB.length;i++){
		if(type === arrayDB[i].type){
			tempArray.push(arrayDB[i]);
		}
	}

	res.send({products:tempArray});
});
app.get('/addCart/:ID',function(req,res){
	var ID = req.sanitize(req.params.ID);
	var cookieValue = req.cookies;
	var cookieCart = req.sanitize(cookieValue.cart);

	if(!cookieCart){
		var cookieArray = [];
		cookieArray.push(ID);
		var cookieStringArray = JSON.stringify(cookieArray);

		res.cookie('cart',cookieStringArray);
		res.send({cartNumb:1});
	}else{
		var cartValue = cookieCart;
		var cookieArray = JSON.parse(cartValue);
		cookieArray.push(ID);
		var cookieStringArray = JSON.stringify(cookieArray);
	
		res.clearCookie('cart');
		res.cookie('cart',cookieStringArray);
		res.send({cartNumb:cookieArray.length});
	}
});

app.listen(port,function(){
	console.log('Connected successfully');
});


