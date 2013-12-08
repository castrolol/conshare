
var express = require("express");
var io = require("socket.io").listen(9067);
var sessionStore = new express.session.MemoryStore();
var app = express();
var config = require("./config");
var less = require('less-middleware');

app.configure(function(){

	app.use(less({
        src: __dirname + '/public',
        compress: true
    }));
	app.set('views', __dirname + '/view');
	app.set("view engine",'jade');
	app.use(express.static(__dirname + "/public"));
	app.use(express.cookieParser());
	app.use(express.session({ 
		store: sessionStore,
		secret: config.sessionKey,
		key: 'express.sid',
	}));

});


app.get('/',function(req,res){

	res.render("index.jade",{layout:false});

});

 
var cookie = require('cookie');
var connect = require('connect')
var Session = connect.middleware.session.Session;


io.set('authorization', function (data, accept) {
      
	// TODO check session params
	// check if there's a cookie header
	if (data.headers.cookie) {

		data.cookie = cookie.parse( data.headers.cookie, { secure: true } );
      	data.cookie = connect.utils.parseSignedCookies( data.cookie, 'todayisthedaytobeabestandnewpeople' );
      	data.cookie = connect.utils.parseJSONCookies( data.cookie );

		data.sessionID = data.cookie['express.sid'];
		data.sessionStore = sessionStore;
	    
		sessionStore.get(data.sessionID, function (err, session) {

			if (err) {
				// if we cannot grab a session, turn down the connection
				accept(err.message.toString()+'. u mad?', false);

			} else {
				// create a session object, passing data as request and our just acquired session data
				data.session = new Session(data, session);        	
				accept(null, true);
			}
	    
		});
	    
	} else {
   
		accept('No cookie transmitted. u mad?', false);
	}
});
 

io.on('connection', function(socket){
 
	function obterClient(){


		return clients[socket.handshake.sessionID];

	}
  
	function erro(mensagem){

		socket.emit("error", mensagem);

	}

	function atualizarContatos(){


			io.sockets.emit("refresh contacts",  obterClientes());

	}

	(function requererLogin(){

		socket.emit('request login', function(name, status){

			var callback = function (e) {
				socket.emit("welcome", e, socket.handshake.sessionID);
			};

		//	try{
				if( name && status ){

					clients[socket.handshake.sessionID] = { name: name, status: status, emit: function(){

						socket.emit.apply(socket, arguments);

					} };
					console.log("Iniciando envio de contatos....");
					atualizarContatos();

					callback(false)

				}else{

					callback("É Obrigatorio o nome e a mensagem!.")

				}
		//	}catch(e){ callback(e); }

		});

	}());
  


	socket.on('change name', function (data) {
		
		var client = obterClient();

		if( !client ) {
			erro("Cliente não autorizado!.");
			requererLogin();
			return;
		}

		if( !data ){

			erro("Nome informado não é valido!.")
			return;
		}

		client.name = data;


	});


	socket.on('change status',  function (data) {
		
		var client = obterClient();

		if( !client ) {
			erro("Cliente não autorizado!.");
			requererLogin();
			return;
		}

		if( !data ){

			erro("Status informado não é valido!.")
			return;
		}

		client.status = data;

	});

	socket.on("send message", function (message, target) {

		var client = obterClient();

		if( !client ) {
			erro("Cliente não autorizado!.");
			requererLogin();
			return;
		}

		if( !message )return;

		if( !target ){

			io.sockets.emit("receive message", { sender: socket.handshake.sessionID, senderName: client.name  , date: new Date(), message: message  });
			return;
		}

		var clientTarget = clients[target];

		if( !clientTarget ){
			erro("Cliente selecionado não está mais disponivel.")
			return;
		}

		clientTarget.emit("receive message", { sender: socket.handshake.sessionID, senderName: client.name , date: new Date(), message: message  });
		

	});

  
	socket.on('disconnect', function () {
		console.log('A socket with sessionID', socket.handshake.sessionID, 'disconnected!');
		
		clearInterval(intervalID);
		delete clients[socket.handshake.sessionID] ;

		atualizarContatos();
	});




});


app.listen(8008);