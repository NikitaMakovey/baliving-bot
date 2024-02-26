import { Injectable, OnModuleInit } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { UsersService } from '../users/users.service'
import { RequestsService } from '../requests/requests.service'
import Database from './engine/database'
import locales from '../config/locales'
import { BotSenderService } from './bot-sender.service'
import { isValidUrl } from './engine/utils'
import { Actions } from './engine/actions'

const TelegramBot = require('node-telegram-bot-api')
require('dotenv').config()

@Injectable()
export class TasksService {
    constructor(
        private readonly usersService: UsersService,
        private readonly requestsService: RequestsService,
        private readonly botSenderService: BotSenderService
    ) {}

    // @Cron(CronExpression.EVERY_10_MINUTES)
    // handleWarning() {
    //     this.usersService.findForWarning().then((users) => {
    //         users.forEach((user) => {
    //             this.botSenderService.sendMessage(
    //                 user.chatId,
    //                 'КАК ДЕЛ? ЧЕ ДЕЛ?'
    //             )
    //         })
    //         this.usersService.markAsWarned(users)
    //     })
    // }

    @Cron(CronExpression.EVERY_HOUR)
    handleCron() {
        console.debug('Checking new properties ...')
        const bot = new TelegramBot(process.env.TOKEN)
        this.usersService.find().then((users) => {
            users.forEach((user) => {
                if (!user.enabledNotifications) return
                if (user.requestId) {
                    Database.findUser(user.email).then((databaseUser) => {
                        if (
                            databaseUser &&
                            (Database.isUserAccessValid(databaseUser) ||
                                Database.isTrialUser(databaseUser))
                        ) {
                            if (Database.isTrialUser(databaseUser)) {
                                this.handleActiveUser(bot, user, true)
                            } else if (Database.isVIPUser(databaseUser)) {
                                this.handleActiveUser(bot, user)
                            } else {
                                this.handleUndefinedActiveUser(bot, user)
                            }
                        } else {
                            this.handleExpiredUser(bot, user)
                        }
                    })
                }
            })
        })
    }

    handleActiveUser(bot, user, isTrial = false) {
        this.requestsService.find(+user.requestId).then((request) => {
            if (request.areas && request.beds && request.price) {
                const properties: any = request.properties
                    ? request.properties
                    : []
                console.debug(properties)
                Database.findNewProperties(
                    request.city,
                    request.areas,
                    request.categories,
                    request.beds,
                    request.minPrice,
                    request.price,
                    properties,
                    10,
                    properties
                        .map((property: string) => Number(property))
                        .reduce((a: number, b: number) => Math.max(a, b))
                ).then(async (newProperties) => {
                    newProperties = newProperties.filter((property) =>
                        isValidUrl(property.get('Телеграм ссылка'))
                    )
                    console.log(newProperties.length)
                    if (newProperties.length == 0) return

                    await this.botSenderService.sendMessage(
                        user.chatId,
                        locales[user.locale].foundOptions,
                        {
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        {
                                            text: locales[user.locale]
                                                .showNewAds,
                                            callback_data:
                                                Actions.StartSearchNew,
                                        },
                                        {
                                            text: locales[user.locale]
                                                .haveAlreadyFound,
                                            callback_data:
                                                Actions.HaveAlreadyFound,
                                        },
                                    ],
                                ],
                            },
                        }
                    )
                })
            }
        })
    }

    handleUndefinedActiveUser(bot, user) {
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
                            text: locales[user.locale].writeToSupport,
                            switch_inline_query:
                                locales[user.locale].writeToSupport,
                            url: 'https://t.me/info_baliving',
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
        bot.sendMessage(
            user.chatId,
            locales[user.locale].expired,
            options
        ).then(() => {
            this.usersService.delete(user.userId).then((r) => console.debug(r))
        })
    }

    handleExpiredUser(bot, user) {
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
        bot.sendMessage(
            user.chatId,
            locales[user.locale].expired,
            options
        ).then(() => {
            this.usersService
                .delete(user.userId)
                .then((response) => console.debug(response))
        })
    }
}
