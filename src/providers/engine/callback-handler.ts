import { UsersService } from '../../users/users.service'
import locales from '../../config/locales'
import { User } from '../../users/entities/user.entity'
import Database from './database'
import areas from '../../config/areas'
import beds from '../../config/beds'
import { RequestsService } from '../../requests/requests.service'
import { FetchService } from 'nestjs-fetch'
import { Templater } from './templater'
import { BaseHandler, Actions } from './base-handler'
import { SelectionKeyboard } from './selection-keyboard'

const CHOSE = '✅'
const TRIAL = 'TRIAL'

const FINISH = 'finish'
const START_SEARCH = 'start-search'

const EDIT_AREAS = 'edit-areas'
const EDIT_BEDS = 'edit-beds'
const EDIT_PRICE = 'edit-price'
const EDIT_MIN_PRICE = 'edit-min-price'

export default class CallbackHandler extends BaseHandler {
    constructor(
        usersService: UsersService,
        requestsService: RequestsService,
        bot,
        fetch: FetchService
    ) {
        super(usersService, requestsService, bot, fetch)
    }

    async handle(chatId, userId, messageId, data, keyboard) {
        const user: User = await this.usersService.findOne(userId, chatId)
        console.debug(user)
        try {
            if (['choose-locale:ru', 'choose-locale:en'].includes(data)) {
                await this.handleLocaleMessage(
                    chatId,
                    userId,
                    messageId,
                    data,
                    user
                )
            } else if (data === 'start') {
                await this.handleEmailMessage(chatId, userId, user)
            } else if (user.nextAction === 'read-areas') {
                if (data === FINISH) {
                    await this.handleFinishAreaMessage(
                        messageId,
                        user,
                        keyboard
                    )
                } else {
                    await this.handleAreaMessage(
                        messageId,
                        data,
                        keyboard,
                        user
                    )
                }
            } else if (user.nextAction === Actions.ReadBeds) {
                if (data === FINISH) {
                    await this.handleFinishBedMessage(messageId, user, keyboard)
                } else {
                    await this.handleBedMessage(messageId, data, keyboard, user)
                }
            } else if (
                [EDIT_AREAS, EDIT_BEDS, EDIT_MIN_PRICE, EDIT_PRICE].includes(
                    data
                )
            ) {
                const isValid: boolean = await this.isValidUser(user)
                if (isValid) {
                    switch (data) {
                        case EDIT_AREAS:
                            await this.handleEditAreasMessage(messageId, user)
                            break
                        case EDIT_BEDS:
                            await this.handleEditBedsMessage(messageId, user)
                            break
                        case EDIT_MIN_PRICE:
                            await this.handleEditMinPriceMessage(
                                messageId,
                                user
                            )
                            break
                        case EDIT_PRICE:
                            await this.handleEditPriceMessage(messageId, user)
                            break
                    }
                }
            } else if (user.nextAction === 'confirm') {
                console.log(data)
                if (data.includes(Actions.StartSearch)) {
                    await this.handleSearchMessage(messageId, user, data.includes(Actions.StartSearchNext))
                }
            } else if (
                user.nextAction &&
                user.nextAction.includes('read-edit')
            ) {
                if (user.nextAction.includes('read-edit-areas')) {
                    if (data === FINISH) {
                        await this.handleFinishAreaMessage(
                            messageId,
                            user,
                            keyboard,
                            true
                        )
                    } else if (data.includes('read-areas')) {
                        await this.handleAreaMessage(
                            messageId,
                            data,
                            keyboard,
                            user
                        )
                    }
                }
                if (user.nextAction.includes('read-edit-beds')) {
                    if (data === FINISH) {
                        await this.handleFinishBedMessage(
                            messageId,
                            user,
                            keyboard,
                            true
                        )
                    } else if (data.includes('read-beds')) {
                        await this.handleBedMessage(
                            messageId,
                            data,
                            keyboard,
                            user
                        )
                    }
                }
            }
        } catch (exception) {
            console.error(exception)
        }
    }

    async handleLocaleMessage(chatId, userId, messageId, data, user) {
        const locale: string = data === 'choose-locale:ru' ? 'ru' : 'en'
        user = await this.usersService.update(userId, chatId, { locale })
        await this.bot.deleteMessage(chatId, messageId)
        await this.handleEmailMessage(chatId, userId, user)
    }

    async handleEmailMessage(chatId, userId, user) {
        await this.usersService.update(userId, chatId, {
            currentAction: Actions.AskEmail,
            nextAction: Actions.ReadEmail,
            requestId: null,
        })
        await this.bot.sendMessage(chatId, locales[user.locale].start)
    }

    async handleEditAreasMessage(messageId, user) {
        const request: any = await this.requestsService.find(+user.requestId)
        await this.usersService.update(user.userId, user.chatId, {
            currentAction: Actions.WaitingForReply,
            nextAction: Actions.ReadEditAreas,
        })
        const [keyboard, _] = SelectionKeyboard.create(
            areas[user.locale],
            Actions.ReadAreas,
            { text: locales[user.locale].next, callback_data: FINISH },
            request.areas.map(
                (area) => areas[user.locale][areas['ru'].indexOf(area)]
            )
        )
        await this.bot.sendMessage(
            user.chatId,
            locales[user.locale].chooseAreas,
            {
                reply_markup: {
                    inline_keyboard: keyboard,
                },
            }
        )
    }

    async handleEditBedsMessage(messageId, user) {
        const request: any = await this.requestsService.find(+user.requestId)
        await this.usersService.update(user.userId, user.chatId, {
            currentAction: Actions.WaitingForReply,
            nextAction: Actions.ReadEditBeds,
        })
        const [keyboard, _] = SelectionKeyboard.create(
            beds,
            Actions.ReadBeds,
            { text: locales[user.locale].next, callback_data: FINISH },
            request.beds
        )
        await this.bot.sendMessage(
            user.chatId,
            locales[user.locale].numberOfBeds,
            {
                reply_markup: {
                    inline_keyboard: keyboard,
                },
            }
        )
    }

    async handleEditMinPriceMessage(messageId, user, isEdit = false) {
        console.debug(messageId)
        await this.usersService.update(user.userId, user.chatId, {
            currentAction: Actions.WaitingForReply,
            nextAction: Actions.ReadEditPrice,
        })
        const botMessage = await this.bot.sendMessage(
            user.chatId,
            locales[user.locale].minPrice
        )
        await this.usersService.update(user.userId, user.chatId, {
            nextAction: `${Actions.ReadEditMinPrice},delete-message:${botMessage.message_id}`,
        })
    }

    async handleEditPriceMessage(messageId, user) {
        console.debug(messageId)
        await this.usersService.update(user.userId, user.chatId, {
            currentAction: Actions.WaitingForReply,
            nextAction: Actions.ReadEditPrice,
        })
        const botMessage = await this.bot.sendMessage(
            user.chatId,
            locales[user.locale].price
        )
        await this.usersService.update(user.userId, user.chatId, {
            nextAction: `${Actions.ReadEditPrice},delete-message:${botMessage.message_id}`,
        })
    }

    async isValidUser(user) {
        this.bot.sendMessage(user.chatId, locales[user.locale].checking)
        const databaseUser: any = await Database.findUser(user.email)
        const options: any = {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: locales[user.locale].goToWebsite,
                            switch_inline_query:
                                locales[user.locale].goToWebsite,
                            url: 'https://baliving.ru/tariffs',
                        },
                    ],
                    [
                        {
                            text: `${locales[user.locale].writeAnotherEmail}`,
                            callback_data: `start`,
                        },
                    ],
                ],
            },
        }
        if (!databaseUser) {
            await this.usersService.update(user.userId, user.chatId, {
                currentAction: Actions.WaitingForReply,
                nextAction: null,
            })
            await this.bot.sendMessage(
                user.chatId,
                locales[user.locale].notFound,
                options
            )
            return false
        } else if (
            (databaseUser.get('Доступ действителен') === CHOSE &&
                databaseUser.get('Plan') === 'VIP') ||
            databaseUser.get('TRIAL') === TRIAL
        ) {
            await this.usersService.update(user.userId, user.chatId, {
                isTrial: databaseUser.get('TRIAL') === TRIAL,
            })
            return true
        } else {
            await this.usersService.update(user.userId, user.chatId, {
                currentAction: Actions.WaitingForReply,
                nextAction: null,
            })
            await this.bot.sendMessage(
                user.chatId,
                locales[user.locale].expired,
                options
            )
            return false
        }
    }

    async handleSearchMessage(messageId, user, isNext) {
        await this.usersService.update(user.userId, user.chatId, {
            currentAction: Actions.WaitingForReply,
            nextAction: Actions.Confirm,
        })
        await this.bot.sendMessage(user.chatId, locales[user.locale].checking)
        const request: any = await this.requestsService.find(+user.requestId)
        const properties: any = (() => {
            if (!isNext) {
                return []
            }
            return request.properties ?? []
        })()
        console.debug(isNext);
        const databaseProperties: any = await Database.findNewProperties(
            request.areas,
            request.beds,
            request.minPrice,
            request.price,
            properties
        )
        if (databaseProperties.length) {
            let isSent: boolean = false
            for (const property of databaseProperties) {
                if (this.isValidUrl(property.get('Телеграм ссылка'))) {
                    const id: any = await this.sendProperty(property, user)
                    if (id) {
                        properties.push(id)
                        isSent = true
                    }
                }
            }
            await this.requestsService.update(request.id, { properties })
            if (isSent) {
                await this.bot.sendMessage(
                    user.chatId,
                    locales[user.locale].maybeYouCanFindSomethingElse,
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: locales[user.locale]
                                            .showTheFollowingAds,
                                        callback_data: Actions.StartSearchNext,
                                    },
                                ],
                            ],
                        },
                    }
                )
            }
        } else {
            await this.bot.sendMessage(
                user.chatId,
                locales[user.locale].notFoundOptions
            )
        }
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
            await this.bot.sendMessage(user.chatId, template, options)

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
                    await this.bot.sendMediaGroup(user.chatId, media)
                }
            }

            return +property.get('Номер')
        } catch (exception) {
            console.error(`issue detected ...\n${exception}`)
            return null
        }
    }

    isValidUrl(string) {
        let url
        try {
            url = new URL(string)
        } catch (_) {
            return false
        }
        return url.protocol === 'http:' || url.protocol === 'https:'
    }

    async handleFinishBedMessage(
        messageId,
        user,
        keyboardBeds,
        isEdit = false
    ) {
        await this.bot.deleteMessage(user.chatId, messageId)
        const actionData = isEdit
            ? {
                  currentAction: Actions.WaitingForReply,
                  nextAction: Actions.Confirm,
              }
            : {
                  currentAction: Actions.WaitingForReply,
                  nextAction: Actions.ReadEditMinPrice,
              }
        await this.usersService.update(user.userId, user.chatId, actionData)
        let userBeds = SelectionKeyboard.getSelected(keyboardBeds).map(
            (bed) => {
                return beds.indexOf(bed) + 1
            }
        )
        const request: any = await this.requestsService.update(
            +user.requestId,
            { beds: userBeds }
        )
        if (isEdit) {
            await this.sendStartSearchingPreview(user, request)
        } else {
            const botMessage = await this.bot.sendMessage(
                user.chatId,
                locales[user.locale].minPrice
            )
            await this.usersService.update(user.userId, user.chatId, {
                nextAction: `${Actions.ReadMinPrice},delete-message:${botMessage.message_id}`,
            })
        }
    }

    async handleFinishAreaMessage(
        messageId,
        user,
        keyboardAreas,
        isEdit = false
    ) {
        await this.bot.deleteMessage(user.chatId, messageId)
        const actionData = isEdit
            ? {
                  currentAction: Actions.WaitingForReply,
                  nextAction: Actions.Confirm,
              }
            : {
                  currentAction: Actions.WaitingForReply,
                  nextAction: Actions.ReadBeds,
              }
        if (!user.requestId) {
            const request: any = await this.requestsService.create({
                userId: user.id,
            })
            user = await this.usersService.update(user.userId, user.chatId, {
                ...actionData,
                requestId: request.id,
            })
        } else {
            await this.usersService.update(user.userId, user.chatId, actionData)
        }
        let userAreas = SelectionKeyboard.getSelected(keyboardAreas).map(
            (area) => {
                return areas['ru'][areas[user.locale].indexOf(area)]
            }
        )
        const request: any = await this.requestsService.update(
            +user.requestId,
            { areas: userAreas }
        )
        if (isEdit) {
            await this.sendStartSearchingPreview(user, request)
        } else {
            const [keyboard, _] = SelectionKeyboard.create(
                beds,
                Actions.ReadBeds,
                { text: locales[user.locale].next, callback_data: FINISH },
                request.beds ?? []
            )
            await this.bot.sendMessage(
                user.chatId,
                locales[user.locale].numberOfBeds,
                {
                    reply_markup: {
                        inline_keyboard: keyboard,
                    },
                }
            )
        }
    }

    async handleBedMessage(messageId, data, keyboard, user) {
        const numberOfBeds: number = data.substring(
            `${Actions.ReadBeds} `.length
        )
        console.debug(numberOfBeds)
        const [newKeyboard, _] = SelectionKeyboard.proccess(
            keyboard,
            numberOfBeds,
            beds,
            { text: locales[user.locale].next, callback_data: FINISH }
        )
        await this.bot.editMessageReplyMarkup(
            { inline_keyboard: newKeyboard },
            { chat_id: user.chatId, message_id: messageId }
        )
    }

    async handleAreaMessage(messageId, data, keyboard, user) {
        console.debug(keyboard)
        const area: string = data.substring(`${Actions.ReadAreas} `.length)
        const [newKeyboard, _] = SelectionKeyboard.proccess(
            keyboard,
            area,
            areas[user.locale],
            { text: locales[user.locale].next, callback_data: FINISH }
        )
        await this.bot.editMessageReplyMarkup(
            { inline_keyboard: newKeyboard },
            { chat_id: user.chatId, message_id: messageId }
        )
    }
}
