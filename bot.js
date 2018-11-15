const BaseBot = require('bot-sdk')
const chatbot = require('./chatbot')
const config = require('./config')
const Request = require('bot-sdk/lib/Request')

const AGENT_MAP = {
    'e40ddc35-eed8-5260-a913-4201bbb64674' : 'dictation'
}

const agent_tille = {
    "dictation":"词语听写"
}

const agent_backgroud = {
    "dictation":config.background2
}

function getOpenAppEvent(agent) {
    return 'open-skill-' + agent
}

function getCloseAppEvent(agent) {
    return 'quit-skill-' + agent
}

function getNoResponseEvent(agent) {
    return 'no-response-' + agent
}

class Bot extends BaseBot {
    constructor(postData) {
        super(postData)

        const request = new Request(postData)
        const user_id = 'dueros_' + request.getUserId()
        const bot_id = request.getBotId()
        this.agent = AGENT_MAP[bot_id]
        console.log(`request from bot ${bot_id} of user ${user_id}`)
        // console.log(JSON.stringify(request))
        if (!this.agent) {
            console.log('bot id does not register agent: ' + bot_id)
            this.agent = 'dictation'
        }
        this.title = agent_tille[this.agent]
        this.background = agent_backgroud[this.agent]
        const user_context = {
            support_display : this.isSupportDisplay(),
            source          : 'dueros'
        }

        this.addLaunchHandler(() => {
            this.waitAnswer()
            var that = this
            return chatbot.replyToEvent(that.agent, user_id, getOpenAppEvent(that.agent), user_context)
                          .then((result) => { return new Promise((resolve) => { resolve(that.buildResponse(result)) }) })
                          .catch((error) => {
                            console.log('Error occurred: ' + error + ', ' + error.stack)
                        })
        });

        this.addIntentHandler('ai.dueros.common.default_intent', () => {
            this.waitAnswer()
            var that = this
            return chatbot.replyToText(that.agent, user_id, request.getQuery(), user_context)
                          .then((result) => { return new Promise((resolve) => { resolve(that.buildResponse(result)) }) })
                          .catch((error) => {
                            console.log('Error occurred: ' + error)
                        })
        });
        
        this.addSessionEndedHandler(() => {
            // console.log(JSON.stringify(request))
            this.setExpectSpeech(false)
            this.endDialog()
            var that = this
            const event = (request.getData().request.reason === 'EXCEEDED_MAX_REPROMPTS') ? getNoResponseEvent(that.agent) : getCloseAppEvent(that.agent)
            return chatbot.replyToEvent(that.agent, user_id, event, user_context)
                          .then((result) => { return new Promise((resolve) => { resolve(that.buildResponse(result)) }) })
                          .catch((error) => {
                              console.log('Error occurred: ' + error)
                          })
        })
    }

    isIndicateQuit(result) {
        if (result.intent.indexOf('close-app') != -1) return true
        if (!result.data) return false
        return result.data.filter((data) => {return data.type === 'quit-skill'}).length > 0
    }

    buildResponse(result) {
        if(result.reply === '测试一下') {
            return {
                outputSpeech: `<speak>银<silence time="500ms"></silence>行</speak>`
            }
        }
        console.log(JSON.stringify(result))
        if (this.isIndicateQuit(result)) {
            this.setExpectSpeech(false)
            this.endDialog()
            return {outputSpeech: this.getSsmlReply(result)}
        }

        return {
            directives: [this.getTextTemplate(result.reply)],
            outputSpeech: this.getSsmlReply(result)
        }
    }

    getSsmlReply(result) {
        if (!result.data) return result.reply
        let reply = ''
        if (result.reply) reply += (result.reply + "。")
        for (let data of result.data) {
            if (data.type && data.type === 'play-audio' && data['text']) {
                reply += ("，" + `<silence time="1"></silence>` + data['text'] + "，")
            } else if (data.type && data.type === 'play-audio' && data['mute']) {
                const time = data['mute'] > 10 ? 10 : data['mute']
                reply += `<silence time="${time}"></silence>`
            }else if (data.type && data.type === 'text' && data['reply']) {
                if (result.reply) {
                    reply += `。${data.reply}`
                } else {
                    reply += data.reply
                }
            }
        }
        console.log('SSML : ' + reply)
        return `<speak>${reply}</speak>`
    } 

    getTextTemplate(text) {
        let bodyTemplate = new BaseBot.Directive.Display.Template.BodyTemplate1();
        bodyTemplate.setTitle(this.title);
        bodyTemplate.setPlainTextContent(text);
        bodyTemplate.setBackGroundImage(this.background);
        let renderTemplate = new BaseBot.Directive.Display.RenderTemplate(bodyTemplate);
        return renderTemplate;
    }
}

module.exports = Bot
