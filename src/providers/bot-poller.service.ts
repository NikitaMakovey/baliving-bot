import { Injectable, OnModuleInit } from '@nestjs/common'
import { MessageHandler } from './engine/message-handler'
import { CallbackHandler } from './engine/callback-handler'
const TelegramBot = require('node-telegram-bot-api')
require('dotenv').config()

const BOT_CHAT_TYPE: string = 'private'

@Injectable()
export class BotPollerService implements OnModuleInit {
    readonly bot: any

    constructor(
        private callbackHandler: CallbackHandler,
        private messageHandler: MessageHandler
    ) {
        this.bot = new TelegramBot(process.env.TOKEN, { polling: true })
    }

    onModuleInit() {
        this.botMessage()
        this.botCallback()
    }

    botCallback() {
        this.bot.on('callback_query', (callbackQuery) => {
            try {
                console.log('callback')
                this.callbackHandler.handle(
                    callbackQuery.message.chat.id,
                    callbackQuery.from.id,
                    callbackQuery.message.message_id,
                    callbackQuery.data,
                    callbackQuery.message.reply_markup.inline_keyboard
                )
            } catch (exception) {
                console.error(exception)
            }
        })
    }

    botMessage() {
        this.bot.on('message', (message) => {
            console.log('message')
            if (message.chat.type === BOT_CHAT_TYPE) {
                this.messageHandler.handle(message)
            }
        })
    }
}
