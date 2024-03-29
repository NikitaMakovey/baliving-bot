import { Injectable, OnModuleInit } from '@nestjs/common'
import Handler from './engine/handler'
import { UsersService } from '../users/users.service'
import { RequestsService } from '../requests/requests.service'
import { BotSenderService } from './bot-sender.service'
const TelegramBot = require('node-telegram-bot-api')
require('dotenv').config()

const BOT_CHAT_TYPE: string = 'private'

@Injectable()
export class BotPollerService extends Handler implements OnModuleInit {
    constructor(
        usersService: UsersService,
        requestsService: RequestsService,
        botSenderService: BotSenderService
    ) {
        const bot = new TelegramBot(process.env.TOKEN, { polling: true })
        super(usersService, requestsService, botSenderService, bot)
    }

    onModuleInit() {
        this.botMessage()
        this.botCallback()
    }

    botCallback() {
        const _this = this
        this.bot.on('callback_query', function onCallbackQuery(callbackQuery) {
            try {
                _this.handleCallback(
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
        const _this = this
        this.bot.on('message', (message) => {
            if (message.chat.type === BOT_CHAT_TYPE) {
                _this.handle(message)
            }
        })
    }
}
