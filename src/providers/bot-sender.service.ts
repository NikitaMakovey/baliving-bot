import { Injectable } from '@nestjs/common'
import areas from 'src/config/areas'
import locales from 'src/config/locales'
import { RequestsService } from 'src/requests/requests.service'
import { UsersService } from 'src/users/users.service'
import { Actions } from './engine/actions'
import { SelectionKeyboard } from './engine/selection-keyboard'
import { Templater } from './engine/templater'

const TelegramBot = require('node-telegram-bot-api')
require('dotenv').config()

@Injectable()
export class BotSenderService {
    protected bot: any

    constructor(
        private usersService: UsersService,
        private requestsService: RequestsService
    ) {
        this.bot = new TelegramBot(process.env.TOKEN)
    }

    async sendStartSearchingPreview(user, request) {
        await this.deleteMessageForUser(user)
        await this.sendMessage(user.chatId, locales[user.locale].finish, {
            parse_mode: 'html',
        })
        const options: any = {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: locales[user.locale].agree,
                            callback_data: 'start-search',
                        },
                    ],
                ],
            },
        }
        const template = Templater.applyDetails(request, user.locale)
        await this.sendMessage(user.chatId, template, options)
    }

    async isEditStage(user) {
        if (!user.requestId) {
            return false
        }
        const request: any = await this.requestsService.find(+user.requestId)
        return request && request.isFilled()
    }

    async sendAreaKeyboard(user, request) {
        const selectedAreas =
            request != null
                ? request.areas.map(
                      (area) => areas[user.locale][areas['ru'].indexOf(area)]
                  )
                : []
        const [keyboard, anySelected] = SelectionKeyboard.create(
            areas[user.locale],
            Actions.ReadAreas,
            { text: locales[user.locale].next, callback_data: Actions.Finish },
            selectedAreas
        )
        if (!anySelected) {
            console.debug('add area is not important')
            keyboard.push([
                {
                    text: locales[user.locale].areaIsNotImportant,
                    callback_data: Actions.AreaIsNotImportant,
                },
                {
                    text: locales[user.locale].areaNeedConsult,
                    callback_data: Actions.AreaNeedConsult,
                },
            ])
        }
        const botMessage = await this.sendMessage(
            user.chatId,
            locales[user.locale].chooseAreas,
            {
                reply_markup: {
                    inline_keyboard: keyboard,
                },
            }
        )
        await this.usersService.addMessageForDelete(
            user.userId,
            user.chatId,
            botMessage.message_id
        )
        return botMessage
    }

    async sendProperty(property, user) {
        try {
            let options: any = {
                parse_mode: 'html',
            }
            if (!user.isTrial) {
                options.reply_markup = {
                    inline_keyboard: [
                        [
                            {
                                text: locales[user.locale].write,
                                switch_inline_query: locales[user.locale].write,
                                url: property.get('Телеграм ссылка'),
                            },
                        ],
                    ],
                }
            }
            const template = Templater.applyProperty(property, user.locale)
            await this.sendMessage(user.chatId, template, options)
            await this.handlePhotos(property, user)
            return +property.get('Номер')
        } catch (exception) {
            console.error(`issue detected ...\n${exception}`)
            return null
        }
    }

    async handlePhotos(property, user) {
        if (property.get('Фото') && Array.isArray(property.get('Фото'))) {
            console.debug('Photo is processing...')
            let media: any = []
            const images = property
                .get('Фото')
                .map((image) => image.thumbnails.large.url)
            for (const url of images) {
                const i = images.indexOf(url)
                if (i < 3) {
                    // limit = 3
                    media.push({
                        type: 'photo',
                        media: url,
                    })
                }
            }
            if (media.length) {
                await this.sendMediaGroup(user.chatId, media)
            }
        }
    }

    async sendMessage(...params: Array<any>) {
        return await this.bot.sendMessage(...params)
    }

    async deleteMessageForUser(user) {
        console.debug(user.messageForDelete)
        if (!user.messageForDelete) {
            return
        }
        user.messageForDelete.forEach((messageId) => {
            try {
                this.deleteMessage(user.chatId, +messageId)
            } catch (exception) {
                console.error(`issue detected ...\n${exception}`)
            }
        })
        await this.usersService.clearMessageForDelete(user.userId, user.chatId)
    }

    async deleteMessage(...params: Array<any>) {
        try {
            return await this.bot.deleteMessage(...params)
        } catch (exception) {}
    }

    async sendMediaGroup(...params: Array<any>) {
        return await this.bot.sendMediaGroup(...params)
    }

    async editMessageReplyMarkup(...params: Array<any>) {
        return await this.bot.editMessageReplyMarkup(...params)
    }
}