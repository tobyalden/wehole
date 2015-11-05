var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(socket){
	console.log('A user connected.');

  socket.on('video request', function() {
    console.log('Video request recieved. Sending video...');
    var video = 'U_kqX_gFiQE';
    io.emit('video', video);
  });

  socket.on('chat message', function(msg){
  	io.emit('chat message', msg);
    console.log('Message: ' + msg);
  });

  socket.on('disconnect', function() {
    console.log('A user disconnected.');
  });

});

http.listen(3000, function() {
	console.log('Listening on *:3000.');
});