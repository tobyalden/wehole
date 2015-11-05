var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var repeat = require('repeat');

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(socket){
	console.log('a user connected');
	socket.on('disconnect', function() {
		console.log('a user disconnected');
	});
  socket.on('chat message', function(msg){
  	io.emit('chat message', msg);
    console.log('message: ' + msg);
  });
});

http.listen(3000, function() {
	console.log('listening on *:3000');
});

function sayHello() {
  console.log("Hello world!");
};
 
repeat(sayHello).every(500, 'ms').for(2, 'minutes').start.in(5, 'sec');