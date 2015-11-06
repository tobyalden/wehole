var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var YouTube = require('youtube-node');
var youTube = new YouTube();
youTube.setKey('AIzaSyAeOVDwLCaSSKjDWf1gOGPJhKYal3ZHIP8');
youTube.addParam('videoDuration');
var moment = require('moment');
moment().format();
var request = require('request-json');
var client = request.createClient('http://localhost:8888/');
var Store = require("jfs");
var db = new Store("data");
var Chance = require('chance'),
chance = new Chance();
var Moniker = require('moniker');
var Repeat = require('repeat');

// Videos containing blacklisted words in their title or desciption won't be played.
var keywordBlacklist = ["pronounc", "say", "vocabulary", "spelling", "mean", "definition", "slideshow", "full", "ebook", "auto-generated by youtube", "amazon.com", "amazon.es", "amazon.co.uk", "bit.ly", "tukunen.org", "bitiiy.com", "http://po.st"];

// Videos with a higher view count than the threshold won't be played.
var viewCountThreshold = 500;

// This array is populated with ~1000 words by an AJAX call to api.wordnik.com at startup
var randomWords = [];
var isPopulating = false;

const INITIAL_TIME_TILL_VOTE = 10;
const INITIAL_VOTING_TIME = 10;
var voteTimer = INITIAL_TIME_TILL_VOTE;
var isVotingOpen = false;
var displayVoteResults = false;
var votes = { stay: 0, skip: 0};

var startTime;
findVideo();

function countDownVote() {
  io.emit('vote info', {voteTimer: voteTimer, isVotingOpen: isVotingOpen, displayVoteResults: displayVoteResults});
  console.log({voteTimer: voteTimer, isVotingOpen: isVotingOpen});
  voteTimer -= 1;
  if(voteTimer === 0) {
    if(!isVotingOpen) {    
      isVotingOpen = true;
      voteTimer = INITIAL_VOTING_TIME;
    } else {
      tallyVotes();
    }
  }
}

function tallyVotes() {
  if(votes.skip > votes.stay) {
    displayVoteResults = true;
    io.emit('vote results', true);
    findVideo();
  } else {
    io.emit('vote results', false);
    isVotingOpen = false;
    voteTimer = INITIAL_TIME_TILL_VOTE;
  }
  votes = { stay: 0, skip: 0};
}

Repeat(countDownVote).every(1000, 'ms').start.now();

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(socket) {
	console.log('A user connected.');
  socket.emit('user name', Moniker.choose());

  socket.on('video request', function() {
    console.log('Video request recieved.');
    db.get("currentVideo", function(err, obj) {
      var video = { id: obj.items[0].id, startTime: moment().diff(startTime, "seconds") };
      socket.emit('video', video);
    })
  });

  socket.on('vote', function(vote) {
    if(vote) {
      votes.skip += 1;
    } else {
      votes.stay += 1;
    }
  });

  socket.on('chat message', function(msg) {
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

// ------------------ YOUHOLE ------------------

// Returns a randomly generated "seed" to use as a search term.
function getSearchSeed() {
  if(randomWords.length === 0 && !isPopulating) {
    populateRandomWords();
  }

  algo = Math.floor(Math.random() * 9) + 1;
  if(algo === 1) {
    return nonsenseWord();
  } else if(algo === 2) {
    return nonsenseChinesePhrase();
  } else if(algo === 3) {
    return nonsenseJapanesePhrase();
  } else if(algo === 4) {
    return nonsenseCyrillic();
  } else if(algo === 5) {
    return randomCharacters();
  } else if(algo === 6) {
    return nonsenseHangul();
  } else if(algo === 7) {
    return nonsenseArabic();
  } else if(algo === 8) {
    return nonsenseLatin();
  } else if (algo === 9) {
    if(randomWords.length === 0) {
      return nonsenseLatin();
    } else {
      var word = randomWords.pop();
      return word;
    }
  }
}

function findVideo() {
  var word = getSearchSeed();
  var requestStr = 'https://www.googleapis.com/youtube/v3/search?order=date&part=snippet&q=' + word + '&type=video&maxResults=50&key=AIzaSyAeOVDwLCaSSKjDWf1gOGPJhKYal3ZHIP8';
  client.get(requestStr, function(err, res, body) {
    findVideoCallback(body);
  });
}

function findVideoCallback(responseJSON) {
  if (responseJSON.items.length < 1) {
    findVideo();
  } else {
    var videoChoice = Math.floor(Math.random() * responseJSON.items.length);
    var videoId = responseJSON.items[videoChoice].id.videoId;
    var requestStr = "https://www.googleapis.com/youtube/v3/videos?part=snippet%2C+statistics&id=" + videoId + "&key=AIzaSyAeOVDwLCaSSKjDWf1gOGPJhKYal3ZHIP8";
    client.get(requestStr, function(err, res, body) {
      if(body.items[0].statistics.viewCount > viewCountThreshold) {
        findVideo();
      } /*else if(isBlacklisted(body.items[0].snippet.title, body.items[0].snippet.description)) {
        findVideo();
      }*/ else {
        playVideo(videoId);
      }
    });
  }
}

function playVideo(videoId) {
  youTube.getById(videoId, function(error, result) {
    if (error) {
      console.log(error);
    }
    else {
      duration = moment.duration(result.items[0].contentDetails.duration).asMilliseconds();
      console.log("Video length: " + duration + "ms");
      startTime = moment();
      voteTimer = INITIAL_TIME_TILL_VOTE;
      isVotingOpen = false;
      displayVoteResults = false;
      setTimeout(findVideo, duration);
      var video = { id: videoId, startTime: 0 };
      io.emit('video', video);
      
      db.save("currentVideo", result, function(err) {
        if(err != null) {
          console.log('There was an error: ' + err);
        }
      });

    }
  });
}

// ---------------------------- SEED GENERATORS ----------------------------

// A "truly random" nonsense phrase, i.e. "behuga".
function nonsenseWord() {
  var word = chance.word({syllables: 3});
  return word;
}

// Two random chinese characters with a space between them.
function nonsenseChinesePhrase() {
  // U0530 - U18B0 all unicode (lots of trains for some reason)
  // var word = getRandomKatakana() + " " + getRandomKatakana() + " " + getRandomKatakana();
  var word = getRandomChineseCharacter() + " " + getRandomChineseCharacter();
  word = encodeURIComponent(word);
  return word;
}

function getRandomChineseCharacter() {
  return String.fromCharCode(0x4E00 + Math.random() * (0x62FF-0x4E00+1));
}

// Two random japanese characters with a space between them.
function nonsenseJapanesePhrase() {
    var word = getRandomJapaneseCharacter() + getRandomJapaneseCharacter();
    word = encodeURIComponent(word);
    return word;
}

function getRandomJapaneseCharacter() {
  var a = Math.floor(Math.random() * 3) + 1;
  if(a === 1) {
    return String.fromCharCode(0x4E00 + Math.random() * (0x62FF-0x4E00+1));
  } else if(a === 2) {
    return String.fromCharCode(0x3040 + Math.random() * (0x309F-0x3040+1));
  } else {
    return String.fromCharCode(0x30A0 + Math.random() * (0x30FF-0x30A0+1));
  }
}

function getRandomHiragana() {
  return String.fromCharCode(0x3040 + Math.random() * (0x309F-0x3040+1));
}

function getRandomKatakana() {
  return String.fromCharCode(0x30A0 + Math.random() * (0x30FF-0x30A0+1));
}

function nonsenseCyrillic() {
   var word = getCyrillicChar() + " " + chance.word({syllables: 1});
   word = encodeURIComponent(word);
   return word;
}

function randomCharacters() {
  var inputLength = Math.floor(Math.random() * 3) + 3;
  var word = chance.string({length: inputLength, pool: 'abcdefghijklmnopqrstuvwxyz'});
  // var word = chance.character({alpha: true}) + chance.character({alpha: true}) + chance.character({alpha: true}) + chance.character({alpha: true}) + chance.character({alpha: true});
  return word;
}

function nonsenseHangul() {
  var word = getRandomHangul() + " " + getRandomHangul();
  word = encodeURIComponent(word);
  return word;
}

function nonsenseArabic() {
  var word = getRandomArabic() + getRandomArabic() + getRandomArabic();
  word = encodeURIComponent(word);
  return word;
}

function nonsenseLatin() {
  var word = getLatinChar() + chance.string({length: 1, pool: 'abcdefghijklmnopqrstuvwxyz'}) + getLatinChar();
  word = encodeURIComponent(word);
  return word;
}

function getLatinChar() {
  return String.fromCharCode(0x00C0 + Math.random() * (0x00C0-0x00FF+1))
}

function getCyrillicChar() {
  return String.fromCharCode(0x0400 + Math.random() * (0x04FF-0x0400+1))
}

function getRandomUnicodeCharacter() {
  return String.fromCharCode(0x0000 + Math.random() * (0x0000-0xFFFD+1))
}

function getRandomHangul() {
  return String.fromCharCode(0xAC00 + Math.random() * (0xAC00-0xD7AF+1))
}

function getRandomEthiopic() {
  return String.fromCharCode(0x1200 + Math.random() * (0x1200-0x137F+1))
}

function getRandomArabic() {
  return String.fromCharCode(0x0600 + Math.random() * (0x0600-0x06FF+1))
}

function populateRandomWords() {
  isPopulating = true;
  var requestStr = 'http://api.wordnik.com/v4/words.json/randomWords?hasDictionaryDef=true&minCorpusCount=0&minLength=3&maxLength=10&limit=1000&api_key=a2a73e7b926c924fad7001ca3111acd55af2ffabf50eb4ae5';
  client.get(requestStr, function(err, res, body) {
    populateRandomWordsHelper(body);
  });
}

function populateRandomWordsHelper(data) {
  var newRandomWords = '';
  for(var i = 0; i < data.length; i++) {
    newRandomWords += data[i].word;
    if(i < data.length - 1) {
      newRandomWords += "~";
    }
  }
  randomWords = newRandomWords.split('~');
  randomWords = shuffle(randomWords);
  isPopulating = false;
}

function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex ;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}
