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
        console.log(JSON.stringify(request))
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
            // return chatbot.replyToEvent(that.agent, user_id, getOpenAppEvent(that.agent), user_context)
            //               .then((result) => { return new Promise((resolve) => { resolve(that.buildResponse(result)) }) })
            //               .catch((error) => {
            //                 console.log('Error occurred: ' + error + ', ' + error.stack)
            //             })
            const response = {
                directives: [this.getTextTemplate('欢迎使用测试技能')],
                outputSpeech: '欢迎使用测试技能'
            }         
            console.log(JSON.stringify(response))
            return response
        });

        this.addIntentHandler('ai.dueros.common.default_intent', () => {
            this.waitAnswer()
            var that = this
            // return chatbot.replyToText(that.agent, user_id, request.getQuery(), user_context)
            //               .then((result) => { return new Promise((resolve) => { resolve(that.buildResponse(result)) }) })
            //               .catch((error) => {
            //                 console.log('Error occurred: ' + error)
            //             })
            const Play = BaseBot.Directive.AudioPlayer.Play
            let a1 = new Play('http://xiaoda.ai/audios/audio?name=05', Play.ENQUEUE)
            let a2 = new Play('https://xiaodamp.cn/asst/tts/f7e4c110-e67b-11e8-9774-bd7f39b40d24.mp3', Play.ENQUEUE)
    
            const response = {
                directives: [a1, a2],
                outputSpeech: '这是你要听的词语'
            }
            console.log(JSON.stringify(response))
            return response
        });
        
        this.addSessionEndedHandler(() => {
            this.setExpectSpeech(false)
            this.endDialog()
            var that = this
            // return chatbot.replyToEvent(that.agent, user_id, getCloseAppEvent(that.agent), user_context)
            //               .then((result) => { return new Promise((resolve) => { resolve(that.buildResponse(result)) }) })
            //               .catch((error) => {
            //                   console.log('Error occurred: ' + error)
            //               })
            const response = {
                directives: [this.getTextTemplate('欢迎下次使用')],
                outputSpeech: '再见，下次记得找我'
            }
            console.log(JSON.stringify(response))
            return response
        })
    }

    isIndicateQuit(result) {
        if (!result || !result.data) return false
        return result.data.filter((data) => {return data.type === 'quit-skill'}).length > 0
    }

    buildResponse(result) {
        console.log(JSON.stringify(result))
        if ((result.intent.indexOf('close-app') != -1)||this.isIndicateQuit(result)) {
            this.setExpectSpeech(false)
            this.endDialog()
            return {outputSpeech: result.reply}
        }

        return {
            directives: [this.getTextTemplate(result.reply)],
            outputSpeech: result.reply
        }
    }

    getDirectives(result) {
        let directives = []
        if (result.reply) {
            directives.push(this.getTextTemplate(result.reply))
        }
        if (result.data) {
            const Play = BaseBot.Directive.AudioPlayer.Play
            let action = Play.REPLACE_ALL
            for (let data of result.data) {
                if (data.type && data.type === 'play-audio' && data['audio-url']) {
                    let audioUrl = data['audio-url']
                    if(data['audio-url'] === 'http://www.xiaodamp.cn/asst/voice/5s_white_noise.mp3')
                    {
                        audioUrl = 'http://xiaoda.ai/audios/audio?name=05'
                    }
                    directives.push(new Play(audioUrl, action))
                    action = Play.REPLACE_ENQUEUED
                } else if (data.type && data.type === 'text' && data['reply']) {
                    if (result.reply) {
                        result.reply += `。${data.reply}`
                    } else {
                        result.reply = data.reply
                    }
                }
            }
        }
        return directives
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
