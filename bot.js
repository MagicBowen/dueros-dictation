const BaseBot = require('bot-sdk')
const chatbot = require('./chatbot')
const config = require('./config')
const request = require('request')
const Request = require('bot-sdk/lib/Request')

const AGENT_MAP = {
    'b1be928e-fce7-01e3-f716-13f843efec30' : 'course-record',
    '9fd0a166-d25c-c2c6-a4f4-f30825ffa971' : 'indentifyCode',
    'e40ddc35-eed8-5260-a913-4201bbb64674' : 'dictation'
}

const agent_tille = {
    "course-record":"课程表",
    "indentifyCode":"幸运数字", 
    "dictation":"词语听写"
}

const agent_backgroud = {
    "course-record": config.background1,
    "indentifyCode":config.background2, 
    "dictation":config.background2
}

function getOpenAppEvent(agent) {
    return (agent === 'course-record') ? 'open-app' : 'open-skill-' + agent
}

function getCloseAppEvent(agent) {
    return (agent === 'course-record') ? 'close-app' : 'quit-skill-' + agent
}

function getNoResponseEvent(agent) {
    return (agent === 'course-record') ? 'no-response' : 'no-response-' + agent
}

class Bot extends BaseBot {
    constructor(postData) {
        super(postData)

        const request = new Request(postData)
        const user_id = 'dueros_' + request.getUserId()
        const bot_id = request.getBotId()
        this.agent = AGENT_MAP[bot_id]
        console.log(`request from bot ${bot_id} of user ${user_id}`)
        if (!this.agent) {
            console.log('bot id does not register agent: ' + bot_id)
            this.agent = 'indentifyCode'
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
                          .then((result) => { return that.getQrcodeImageUrl(user_id, result)})
                          .then((result) => { return new Promise((resolve) => { resolve(that.buildResponse(result)) }) })
                          .catch((error) => {
                            console.log('Error occurred: ' + error + ', ' + error.stack)
                        })
        });

        this.addIntentHandler('ai.dueros.common.default_intent', () => {
            this.waitAnswer()
            var that = this
            return chatbot.replyToText(that.agent, user_id, request.getQuery(), user_context)
                          .then((result) => { return that.getQrcodeImageUrl(user_id, result)})
                          .then((result) => { return new Promise((resolve) => { resolve(that.buildResponse(result)) }) })
                          .catch((error) => {
                            console.log('Error occurred: ' + error)
                        })
        });
        
        this.addSessionEndedHandler(() => {
            this.setExpectSpeech(false)
            this.endDialog()
            var that = this
            return chatbot.replyToEvent(that.agent, user_id, getCloseAppEvent(that.agent), user_context)
                          .then((result) => { return that.getQrcodeImageUrl(user_id, result)})            
                          .then((result) => { return new Promise((resolve) => { resolve(that.buildResponse(result)) }) })
                          .catch((error) => {
                              console.log('Error occurred: ' + error)
                          })
        })
    }

    getQrcodeImageUrl(userId, result) {
        return new Promise( (resolve, reject) => { 
            request( { method : 'GET'
                     , uri : config.wechat_url + `/qrcode?scene=${userId}&source=dueros`
                     }, (err, res, body) => {
                        if (!err && res.statusCode == 200) {
                            result.image = config.wechat_url + JSON.parse(body).url
                            console.log('get image : ' + result.image)
                            resolve(result);
                          } else {
                            reject(err);
                          }
                     }
                )
            } 
        );
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

        if (this.shouldDisplayQrcode(result)) {
            let reply = '请使用微信扫描二维码，打开小程序进行课程的录制和修改。'
            this.setExpectSpeech(false)
            return {
                directives: [this.getTextTemplateWithImage(reply, result.image)],
                outputSpeech: reply
            }
        }

        return {
            directives: [this.getTextTemplate(result.reply)],
            outputSpeech: result.reply
        }
    }

    shouldDisplayQrcode(result) {
        if (!this.isSupportDisplay() || this.agent != 'course-record') return false
        return ((result.intent.indexOf('how-to-record') != -1)||(result.reply.indexOf('哒尔文') != -1))
    }

    getTextTemplate(text) {
        let bodyTemplate = new BaseBot.Directive.Display.Template.BodyTemplate1();
        bodyTemplate.setTitle(this.title);
        bodyTemplate.setPlainTextContent(text);
        bodyTemplate.setBackGroundImage(this.background);
        let renderTemplate = new BaseBot.Directive.Display.RenderTemplate(bodyTemplate);
        return renderTemplate;
    }

    getTextTemplateWithImage(text, image) {
        let bodyTemplate = new BaseBot.Directive.Display.Template.BodyTemplate2();
        bodyTemplate.setTitle(this.title);
        bodyTemplate.setPlainContent(text);
        bodyTemplate.setImage(image, 100, 100);
        bodyTemplate.setBackGroundImage(this.background);
        let renderTemplate = new BaseBot.Directive.Display.RenderTemplate(bodyTemplate);
        return renderTemplate;
    }

    getSecondaryTitle(item){
        if(item.startTime != "" || item.endTime != ""){
            var startTime = (item.startTime == "") ? "?" : item.startTime
            var endTime = (item.startTime == "") ? "?" : item.endTime
            return startTime + "~" + endTime
        }
        return item.preiod
    }

    getThirdTitle(item){
        let info = ''
        if (item.teacher) {
            info += ('任课老师：' + item.teacher)
            if (item.location) info += ('，上课地点：' + item.location)
        }
        else {
            if (item.location) info += ('上课地点：' + item.location)
        }
        return info
    }

    getListTemplate(list) {
        let listTemplate = new BaseBot.Directive.Display.Template.ListTemplate1();
        listTemplate.setToken('token');
        listTemplate.setTitle(this.title);
        listTemplate.setBackGroundImage(this.background);
        for (let item of list) {
            let listItem = new BaseBot.Directive.Display.Template.ListTemplateItem();
            listItem.setToken('token');
            // listItem.setImage('https://skillstore.cdn.bcebos.com/icon/100/c709eed1-c07a-be4a-b242-0b0d8b777041.jpg');
            listItem.setPlainPrimaryText('一级标题');  
            listItem.setPlainSecondaryText('二级标题'); 
            listItem.setPlainTertiaryText('三级标题');
            listTemplate.addItem(listItem);
        }
        let renderTemplate = new BaseBot.Directive.Display.RenderTemplate(listTemplate);
        return renderTemplate;
    }
}

module.exports = Bot
