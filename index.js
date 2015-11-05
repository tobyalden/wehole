var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var YouTube = require('youtube-node');
var youTube = new YouTube();
youTube.setKey('AIzaSyAeOVDwLCaSSKjDWf1gOGPJhKYal3ZHIP8');
youTube.addParam('videoDuration');
var moment = require('moment');
moment().format();

// var $ = require('jQuery');
// var najax = require('najax');
// var chance = require('chance').Chance();

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(socket){
	console.log('A user connected.');

  socket.on('video request', function() {
    console.log('Video request recieved.');
    restartVideo();
  });

  function restartVideo() {
    var video = 'rZtGLNQWmCc';
    youTube.getById(video, function(error, result) {
      if (error) {
        console.log(error);
      }
      else {
        var duration = moment.duration(result.items[0].contentDetails.duration).asMilliseconds();
        console.log("Video length: " + duration + "ms");
        setTimeout(restartVideo, duration);
      }
    });
    io.emit('video', video);
  }

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