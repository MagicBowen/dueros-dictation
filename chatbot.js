const request = require('request-json');
const config = require("./config")
const date = require('./date')

var client = request.createClient(config.chatbot_url)

console.log("connect to chatbot dm client:" + config.chatbot_url)

function concatReplies(replies) {
    var result = '';
    for(var i = 0; i < replies.length; i++) {
        result += replies[i];
    }
    console.log('reply: ' + result)
    return result;
}

function asyncPost(data) {
    return new Promise(function (resolve, reject) {
        client.post('query', data, function (error, res, body) {
        if (!error && res.statusCode == 200) {
          resolve({intent : body.intents[0].name, reply : concatReplies(body.reply), data : body.data});
        } else {
          console.log(error)
          reject(error);
        }
      });
    });
  }

function replyToText(agent, userId, text, userContext) {
    var data = { query : { query : text, confidence : 1.0 }, session : userId, agent : agent, userContext:userContext };
    console.log(date.getCurrentTime() + ' : user : ' + userId + ', query: ' + text)
    return asyncPost(data)
}

function replyToEvent(agent, userId, eventType, userContext) {
    var data = { event : { name : eventType }, session : userId, agent : agent, userContext:userContext };
    console.log(date.getCurrentTime() + ' : user : ' + userId + ', event: ' + eventType)
    return asyncPost(data)
}

module.exports = {
    replyToText,
    replyToEvent
}