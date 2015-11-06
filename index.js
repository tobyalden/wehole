var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var YouTube = require('youtube-node');
var youTube = new YouTube();
youTube.setKey('AIzaSyAeOVDwLCaSSKjDWf1gOGPJhKYal3ZHIP8');
youTube.addParam('videoDuration');
var moment = require('moment');
moment().format();

var videoId = 'FN4PF4ulNpk';
var startTime;
loopVideo();

function loopVideo() {
  youTube.getById(videoId, function(error, result) {
    if (error) {
      console.log(error);
    }
    else {
      duration = moment.duration(result.items[0].contentDetails.duration).asMilliseconds();
      console.log("Video length: " + duration + "ms");
      startTime = moment();
      setTimeout(loopVideo, duration);
      var video = { id: videoId, startTime: 0 };
      io.emit('video', video);
    }
  });
}

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(socket) {
	console.log('A user connected.');

  socket.on('video request', function() {
    console.log('Video request recieved.');
    var video = { id: videoId, startTime: moment().diff(startTime, "seconds") };
    socket.emit('video', video);
  });

  socket.on('chat message', function(msg){
  	io.emit('chat message', msg);
    console.log('Message: ' + msg);
  });

  socket.on('disconnect', function() {
    console.log('A user disconnected.');
  });

});

// Development
http.listen(3000, function() {
  console.log('Listening on *:3000.');
});

// Production
// http.listen(process.env.PORT, function() {
// 	console.log('Listening on *:' + process.env.PORT + '.');
// });