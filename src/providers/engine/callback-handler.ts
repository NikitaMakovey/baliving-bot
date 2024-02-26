import { UsersService } from '../../users/users.service'
import locales from '../../config/locales'
import { User } from '../../users/entities/user.entity'
import Database from './database'
import areas from '../../config/areas'
import beds from '../../config/beds'
import { RequestsService } from '../../requests/requests.service'
import { Actions } from './actions'
import { SelectionKeyboard } from './selection-keyboard'
import { BotSenderService } from '../bot-sender.service'
import { isValidUrl } from './utils'
import city from 'src/config/city'
import categories from 'src/config/categories'

export default class CallbackHandler {
    constructor(
        private usersService: UsersService,
        private requestsService: RequestsService,
        private botSenderService: BotSenderService
    ) {}

    async handle(chatId, userId, messageId, data, keyboard) {
        const user: User = await this.usersService.findOne(userId, chatId)
        console.debug(user)
        console.debug(data)
        try {
            if (['choose-locale:ru', 'choose-locale:en'].includes(data)) {
                await this.handleLocaleMessage(
                    chatId,
                    userId,
                    messageId,
                    data,
                    user
                )
            } else if (data.includes(Actions.AreaIsNotImportant)) {
                await this.handleAreaIsNotImportant(user)
            } else if (data.includes(Actions.AreaNeedConsult)) {
                await this.handleAreaNeedConsult(user)
            } else if (data.includes(Actions.AskArea)) {
                await this.handleAskArea(user)
            } else if (data.includes(Actions.SelectAllAreas)) {
                await this.handleSelectAllAreas(messageId, user, keyboard)
            } else if (data.includes(Actions.HaveAlreadyFound)) {
                await this.handleHaveAlreadyFound(user)
            } else if (data.includes(Actions.ResumeSearch)) {
                await this.handleResumeSearch(user)
            } else if (user.nextAction === Actions.ReadCity) {
                if (data === Actions.Finish) {
                    await this.handleFinishCityMessage(
                        messageId,
                        user,
                        keyboard
                    )
                } else {
                    await this.handleCityMessage(
                        messageId,
                        data,
                        keyboard,
                        user
                    )
                }
            } else if (user.nextAction === Actions.ReadAreas) {
                if (data === Actions.Finish) {
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
            } else if (user.nextAction === Actions.ReadCategories) {
                if (data === Actions.Finish) {
                    await this.handleFinishCategoriesMessage(
                        messageId,
                        user,
                        keyboard
                    )
                } else {
                    await this.handleCategoriesMessage(
                        messageId,
                        data,
                        keyboard,
                        user
                    )
                }
            } else if (user.nextAction === Actions.ReadBeds) {
                if (data === Actions.Finish) {
                    await this.handleFinishBedMessage(messageId, user, keyboard)
                } else {
                    await this.handleBedMessage(messageId, data, keyboard, user)
                }
            } else if (
                [
                    Actions.EditCity,
                    Actions.EditAreas,
                    Actions.EditCategories,
                    Actions.EditBeds,
                    Actions.EditMinPrice,
                    Actions.EditPrice,
                ].includes(data)
            ) {
                const isValid: boolean = await this.isValidUser(user)
                if (isValid) {
                    switch (data) {
                        case Actions.EditCity:
                            await this.handleEditCityMessage(messageId, user)
                            break
                        case Actions.EditAreas:
                            await this.handleEditAreasMessage(messageId, user)
                            break
                        case Actions.EditCategories:
                            await this.handleEditCategoriesMessage(
                                messageId,
                                user
                            )
                            break
                        case Actions.EditBeds:
                            await this.handleEditBedsMessage(messageId, user)
                            break
                        case Actions.EditMinPrice:
                            await this.handleEditMinPriceMessage(
                                messageId,
                                user
                            )
                            break
                        case Actions.EditPrice:
                            await this.handleEditPriceMessage(messageId, user)
                            break
                    }
                }
            } else if (user.nextAction === Actions.Confirm) {
                console.log(data)
                if (
                    data.includes(Actions.StartSearch) ||
                    data.include(Actions.ResumeSearch)
                ) {
                    await this.handleSearchMessage(
                        user,
                        data.includes(Actions.StartSearchNext),
                        data.includes(Actions.StartSearchNew)
                    )
                }
            } else if (
                user.nextAction &&
                user.nextAction.includes('read-edit')
            ) {
                if (user.nextAction.includes(Actions.ReadEditCity)) {
                    if (data === Actions.Finish) {
                        await this.handleFinishCityMessage(
                            messageId,
                            user,
                            keyboard
                        )
                    } else if (data.includes(Actions.ReadCity)) {
                        await this.handleCityMessage(
                            messageId,
                            data,
                            keyboard,
                            user
                        )
                    }
                }
                if (user.nextAction.includes(Actions.ReadEditAreas)) {
                    if (data === Actions.Finish) {
                        await this.handleFinishAreaMessage(
                            messageId,
                            user,
                            keyboard
                        )
                    } else if (data.includes(Actions.ReadAreas)) {
                        await this.handleAreaMessage(
                            messageId,
                            data,
                            keyboard,
                            user
                        )
                    }
                }
                if (user.nextAction.includes(Actions.ReadEditCategories)) {
                    if (data === Actions.Finish) {
                        await this.handleFinishCategoriesMessage(
                            messageId,
                            user,
                            keyboard
                        )
                    } else if (data.includes(Actions.ReadCategories)) {
                        await this.handleCategoriesMessage(
                            messageId,
                            data,
                            keyboard,
                            user
                        )
                    }
                }
                if (user.nextAction.includes(Actions.ReadEditBeds)) {
                    if (data === Actions.Finish) {
                        await this.handleFinishBedMessage(
                            messageId,
                            user,
                            keyboard
                        )
                    } else if (data.includes(Actions.ReadBeds)) {
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
        await this.botSenderService.deleteMessageForUser(user)
        user = await this.usersService.update(user.userId, user.chatId, {
            currentAction: Actions.WaitingForReply,
            nextAction: Actions.ReadService,
            requestId: null,
            locale,
        })
        const message = await this.botSenderService.sendMessage(
            user.chatId,
            locales[user.locale].howWorkService,
            {
                disable_web_page_preview: false,
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: locales[user.locale].haveRead,
                                callback_data: Actions.ReadService,
                            },
                        ],
                    ],
                },
            }
        )
        await this.usersService.addMessageForDelete(
            user.userId,
            user.chatId,
            message.message_id
        )
    }

    async handleEditCityMessage(messageId, user) {
        const request: any = await this.requestsService.find(+user.requestId)
        await this.usersService.update(user.userId, user.chatId, {
            currentAction: Actions.WaitingForReply,
            nextAction: Actions.ReadEditCity,
        })
        await this.botSenderService.sendCityKeyboard(user, request)
    }

    async handleSelectAllAreas(messageId, user, keyboard) {
        const request: any = await this.requestsService.find(+user.requestId)
        const newKeyboard = SelectionKeyboard.select_all(
            keyboard,
            areas[user.locale][request.city]
        )
        newKeyboard.push([
            {
                text: locales[user.locale].next,
                callback_data: Actions.Finish,
            },
        ])
        await this.botSenderService.editMessageReplyMarkup(
            { inline_keyboard: newKeyboard },
            { chat_id: user.chatId, message_id: messageId }
        )
    }

    async handleEditAreasMessage(messageId, user) {
        const request: any = await this.requestsService.find(+user.requestId)
        await this.usersService.update(user.userId, user.chatId, {
            currentAction: Actions.WaitingForReply,
            nextAction: Actions.ReadEditAreas,
        })
        await this.botSenderService.sendAreaKeyboard(user, request)
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
            { text: locales[user.locale].next, callback_data: Actions.Finish },
            request.beds.map((bed: number) => beds.at(bed - 1))
        )
        await this.botSenderService.sendMessage(
            user.chatId,
            locales[user.locale].numberOfBeds,
            {
                reply_markup: {
                    inline_keyboard: keyboard,
                },
            }
        )
    }

    async handleEditMinPriceMessage(messageId, user) {
        console.debug(messageId)
        await this.usersService.update(user.userId, user.chatId, {
            currentAction: Actions.WaitingForReply,
            nextAction: Actions.ReadEditPrice,
        })
        const botMessage = await this.botSenderService.sendMessage(
            user.chatId,
            locales[user.locale].minPrice
        )
        await this.usersService.addMessageForDelete(
            user.userId,
            user.chatId,
            botMessage.message_id
        )
        await this.usersService.update(user.userId, user.chatId, {
            nextAction: Actions.ReadEditMinPrice,
        })
    }

    async handleEditPriceMessage(messageId, user) {
        console.debug(messageId)
        await this.usersService.update(user.userId, user.chatId, {
            currentAction: Actions.WaitingForReply,
            nextAction: Actions.ReadEditPrice,
        })
        const botMessage = await this.botSenderService.sendMessage(
            user.chatId,
            locales[user.locale].price
        )
        await this.usersService.addMessageForDelete(
            user.userId,
            user.chatId,
            botMessage.message_id
        )
        await this.usersService.update(user.userId, user.chatId, {
            nextAction: Actions.ReadEditPrice,
        })
    }

    async isValidUser(user) {
        const message = await this.botSenderService.sendMessage(
            user.chatId,
            locales[user.locale].checking
        )
        const databaseUser: any = await Database.findUser(user.email)
        console.debug(user.userId, user.chatId, message.message_id)
        await this.botSenderService.deleteMessage(
            user.chatId,
            message.message_id
        )
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
            await this.botSenderService.sendMessage(
                user.chatId,
                locales[user.locale].notFound,
                options
            )
            return false
        } else if (
            (Database.isUserAccessValid(databaseUser) &&
                Database.isVIPUser(databaseUser)) ||
            Database.isTrialUser(databaseUser)
        ) {
            await this.usersService.update(user.userId, user.chatId, {
                isTrial: Database.isTrialUser(databaseUser),
            })
            return true
        } else {
            await this.usersService.update(user.userId, user.chatId, {
                currentAction: Actions.WaitingForReply,
                nextAction: null,
            })
            await this.botSenderService.sendMessage(
                user.chatId,
                locales[user.locale].expired,
                options
            )
            return false
        }
    }

    async handleSearchMessage(user, isNext, isNew) {
        await this.botSenderService.deleteMessageForUser(user)
        await this.usersService.update(user.userId, user.chatId, {
            currentAction: Actions.WaitingForReply,
            nextAction: Actions.Confirm,
        })
        const botMessage = await this.botSenderService.sendMessage(
            user.chatId,
            locales[user.locale].checking
        )
        const request: any = await this.requestsService.find(+user.requestId)
        const properties: any = (() => {
            if (!isNext && !isNew) {
                return []
            }
            return request.properties ?? []
        })()
        console.debug(isNext)
        const databaseProperties: any = await Database.findNewProperties(
            request.city,
            request.areas,
            request.categories,
            request.beds,
            request.minPrice,
            request.price,
            properties,
            isNew ? 10 : 3,
            isNew
                ? request.properties.reduce((a: number, b: number) =>
                      Math.max(a, b)
                  )
                : undefined
        )
        await this.botSenderService.deleteMessage(
            user.userId,
            user.chatId,
            botMessage.message_id
        )
        if (databaseProperties.length) {
            let isSent: boolean = false
            for (const property of databaseProperties) {
                try {
                    if (isValidUrl(property.get('Телеграм ссылка'))) {
                        const id: any =
                            await this.botSenderService.sendProperty(
                                property,
                                user
                            )
                        if (id) {
                            properties.push(id)
                            isSent = true
                        }
                    }
                } catch (ex) {
                    console.log(`Failed to send propetry: ${ex}`)
                }
            }
            await this.requestsService.update(request.id, { properties })
            if (isSent) {
                const button = isNew
                    ? {
                          text: locales[user.locale].showTheFollowingGeneralAds,
                          callback_data: Actions.StartSearchNext,
                      }
                    : {
                          text: locales[user.locale].showTheFollowingAds,
                          callback_data: Actions.StartSearchNext,
                      }
                await this.botSenderService.sendMessage(
                    user.chatId,
                    locales[user.locale].maybeYouCanFindSomethingElse,
                    {
                        reply_markup: {
                            inline_keyboard: [[button]],
                        },
                    }
                )
            } else {
                await this.botSenderService.sendMessage(
                    user.chatId,
                    locales[user.locale].notFoundOptions
                )
            }
        } else {
            await this.botSenderService.sendMessage(
                user.chatId,
                locales[user.locale].notFoundOptions
            )
        }
    }

    async handleFinishBedMessage(messageId, user, keyboardBeds) {
        await this.botSenderService.deleteMessage(user.chatId, messageId)
        const isEdit = await this.botSenderService.isEditStage(user)
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
            {
                beds: userBeds,
            }
        )
        if (isEdit) {
            await this.botSenderService.sendStartSearchingPreview(user, request)
        } else {
            const botMessage = await this.botSenderService.sendMessage(
                user.chatId,
                locales[user.locale].minPrice
            )
            await this.usersService.addMessageForDelete(
                user.userId,
                user.chatId,
                botMessage.message_id
            )
            await this.usersService.update(user.userId, user.chatId, {
                nextAction: Actions.ReadMinPrice,
            })
        }
    }

    async handleFinishAreaMessage(messageId, user, keyboardAreas) {
        await this.botSenderService.deleteMessage(user.chatId, messageId)
        const isEdit = await this.botSenderService.isEditStage(user)
        const actionData = isEdit
            ? {
                  currentAction: Actions.WaitingForReply,
                  nextAction: Actions.Confirm,
              }
            : {
                  currentAction: Actions.WaitingForReply,
                  nextAction: Actions.ReadCategories,
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
        let request: any = await this.requestsService.find(+user.requestId)
        let userAreas = SelectionKeyboard.getSelected(keyboardAreas).map(
            (area) => {
                return areas['ru'][request.city][
                    areas[user.locale][request.city].indexOf(area)
                ]
            }
        )
        request = await this.requestsService.update(+user.requestId, {
            areas: userAreas,
        })
        if (isEdit) {
            await this.botSenderService.sendStartSearchingPreview(user, request)
        } else {
            const [keyboard, _] = SelectionKeyboard.create(
                categories,
                Actions.ReadCategories,
                {
                    text: locales[user.locale].next,
                    callback_data: Actions.Finish,
                },
                request.categories ?? []
            )
            await this.botSenderService.sendMessage(
                user.chatId,
                locales[user.locale].categories,
                {
                    reply_markup: {
                        inline_keyboard: keyboard,
                    },
                }
            )
        }
    }

    async handleFinishCategoriesMessage(messageId, user, keyboardCategories) {
        await this.botSenderService.deleteMessage(user.chatId, messageId)
        const isEdit = await this.botSenderService.isEditStage(user)
        const actionData = isEdit
            ? {
                  currentAction: Actions.WaitingForReply,
                  nextAction: Actions.Confirm,
              }
            : {
                  currentAction: Actions.WaitingForReply,
                  nextAction: Actions.ReadEditBeds,
              }
        await this.usersService.update(user.userId, user.chatId, actionData)
        let userCategories = SelectionKeyboard.getSelected(keyboardCategories)
        console.log(userCategories)
        const request: any = await this.requestsService.update(
            +user.requestId,
            {
                categories: userCategories,
            }
        )
        if (isEdit) {
            await this.botSenderService.sendStartSearchingPreview(user, request)
        } else {
            const [keyboard, _] = SelectionKeyboard.create(
                beds,
                Actions.ReadBeds,
                {
                    text: locales[user.locale].next,
                    callback_data: Actions.Finish,
                },
                request.beds ?? []
            )
            await this.botSenderService.sendMessage(
                user.chatId,
                locales[user.locale].numberOfBeds,
                {
                    reply_markup: {
                        inline_keyboard: keyboard,
                    },
                }
            )
            await this.usersService.update(user.userId, user.chatId, {
                nextAction: Actions.ReadBeds,
            })
        }
    }

    async handleCategoriesMessage(messageId, data, keyboard, user) {
        const userCaregories: string = data.substring(
            `${Actions.ReadCategories} `.length
        )
        const [newKeyboard, _] = SelectionKeyboard.proccess(
            keyboard,
            userCaregories,
            categories,
            { text: locales[user.locale].next, callback_data: Actions.Finish }
        )
        await this.botSenderService.editMessageReplyMarkup(
            { inline_keyboard: newKeyboard },
            { chat_id: user.chatId, message_id: messageId }
        )
    }

    async handleEditCategoriesMessage(messageId, user) {
        const request: any = await this.requestsService.find(+user.requestId)
        await this.usersService.update(user.userId, user.chatId, {
            currentAction: Actions.WaitingForReply,
            nextAction: Actions.ReadEditCategories,
        })
        const [keyboard, _] = SelectionKeyboard.create(
            categories,
            Actions.ReadCategories,
            { text: locales[user.locale].next, callback_data: Actions.Finish },
            request != null && request.categories != null
                ? request.categories
                : []
        )
        await this.botSenderService.sendMessage(
            user.chatId,
            locales[user.locale].categories,
            {
                reply_markup: {
                    inline_keyboard: keyboard,
                },
            }
        )
    }

    async handleBedMessage(messageId, data, keyboard, user) {
        const numberOfBeds: number = data.substring(
            `${Actions.ReadBeds} `.length
        )
        const [newKeyboard, _] = SelectionKeyboard.proccess(
            keyboard,
            numberOfBeds,
            beds,
            { text: locales[user.locale].next, callback_data: Actions.Finish }
        )
        await this.botSenderService.editMessageReplyMarkup(
            { inline_keyboard: newKeyboard },
            { chat_id: user.chatId, message_id: messageId }
        )
    }

    async handleFinishCityMessage(messageId, user, keyboardAreas) {
        await this.botSenderService.deleteMessage(user.chatId, messageId)
        const isEdit = await this.botSenderService.isEditStage(user)
        const actionData = {
            currentAction: Actions.WaitingForReply,
            nextAction: Actions.ReadAreas,
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
        let userCity = SelectionKeyboard.getSelected(keyboardAreas)[0]
        const request: any = await this.requestsService.update(
            +user.requestId,
            {
                city: userCity,
            }
        )
        if (isEdit) {
            await this.handleAskArea(user)
        } else {
            await this.botSenderService.sendAreaKeyboard(user, request)
        }
    }

    async handleCityMessage(messageId, data, keyboard, user) {
        console.debug(keyboard)
        const city_: string = data.substring(`${Actions.ReadCity} `.length)
        const [newKeyboard, anySelected] = SelectionKeyboard.proccess(
            keyboard,
            city_,
            city,
            { text: locales[user.locale].next, callback_data: Actions.Finish },
            1,
            false
        )
        await this.botSenderService.editMessageReplyMarkup(
            { inline_keyboard: newKeyboard },
            { chat_id: user.chatId, message_id: messageId }
        )
    }

    async handleAreaMessage(messageId, data, keyboard, user) {
        console.debug(keyboard)
        const area: string = data.substring(`${Actions.ReadAreas} `.length)
        const request: any = await this.requestsService.find(+user.requestId)
        const [newKeyboard, anySelected] = SelectionKeyboard.proccess(
            keyboard,
            area,
            areas[user.locale][request.city],
            { text: locales[user.locale].next, callback_data: Actions.Finish }
        )
        newKeyboard.push([
            {
                text: locales[user.locale].selectAll,
                callback_data: Actions.SelectAllAreas,
            },
        ])
        if (!anySelected) {
            console.debug('add area is not important')
            // newKeyboard.push([
            //     {
            //         text: locales[user.locale].areaIsNotImportant,
            //         callback_data: Actions.AreaIsNotImportant,
            //     },
            //     {
            //         text: locales[user.locale].areaNeedConsult,
            //         callback_data: Actions.AreaNeedConsult,
            //     },
            // ])
        }
        await this.botSenderService.editMessageReplyMarkup(
            { inline_keyboard: newKeyboard },
            { chat_id: user.chatId, message_id: messageId }
        )
    }

    async handleAreaIsNotImportant(user) {
        user = await this.usersService.update(user.userId, user.chatId, {
            currentAction: Actions.WaitingForReply,
            nextAction: Actions.WaitingForReply,
        })
        const keyboard = [
            [
                {
                    text: locales[user.locale].writeToSupport,
                    callback_data: '123',
                },
            ],
            [
                {
                    text: locales[user.locale].articleAboutChoosingArea,
                    callback_data: '123',
                },
            ],
            [
                {
                    text: locales[user.locale].editAreas,
                    callback_data: Actions.AskArea,
                },
            ],
        ]
        const botMessage = await this.botSenderService.sendMessage(
            user.chatId,
            'Как-то не круто',
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
    }

    async handleAreaNeedConsult(user) {
        user = await this.usersService.update(user.userId, user.chatId, {
            currentAction: Actions.WaitingForReply,
            nextAction: Actions.WaitingForReply,
            warningTime: new Date(Date.now()),
        })
        const keyboard = [
            [
                {
                    text: locales[user.locale].articleAboutChoosingArea,
                    callback_data: '123',
                },
            ],
            [
                {
                    text: locales[user.locale].editAreas,
                    callback_data: Actions.AskArea,
                },
            ],
        ]
        const botMessage = await this.botSenderService.sendMessage(
            user.chatId,
            '123',
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
    }

    async handleAskArea(user) {
        await this.usersService.update(user.userId, user.chatId, {
            currentAction: Actions.WaitingForReply,
            nextAction: Actions.ReadAreas,
            warningTime: null,
        })
        const request: any = await this.requestsService.find(+user.requestId)
        await this.botSenderService.deleteMessageForUser(user)
        await this.botSenderService.sendAreaKeyboard(user, request)
    }

    async handleHaveAlreadyFound(user) {
        await this.usersService.update(user.userId, user.chatId, {
            enabledNotifications: false,
        })
        await this.botSenderService.sendMessage(
            user.chatId,
            locales[user.locale].haveAlreadyFoundReply,
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: locales[user.locale].resumeSearchButton,
                                callback_data: Actions.ResumeSearch,
                            },
                        ],
                    ],
                },
            }
        )
    }

    async handleResumeSearch(user) {
        await this.usersService.update(user.userId, user.chatId, {
            enabledNotifications: true,
        })
        await this.handleSearchMessage(user, false, false)
    }
}
