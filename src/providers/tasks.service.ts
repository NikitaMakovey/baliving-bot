import { Injectable, OnModuleInit } from '@nestjs/common'
import { CronExpression, SchedulerRegistry } from '@nestjs/schedule'
import { CronJob } from 'cron'
import { UsersService } from '../users/users.service'
import { RequestsService } from '../requests/requests.service'
import Database from './engine/database'
import locales from '../config/locales'
import { BotSenderService } from './bot-sender.service'
import { isValidUrl } from './engine/utils'
import { Actions } from './engine/actions'

const TelegramBot = require('node-telegram-bot-api')
require('dotenv').config()

const waitSeconds = (seconds: number) =>
    new Promise((resolve) => setTimeout(resolve, seconds * 1000))

@Injectable()
export class TasksService implements OnModuleInit {
    constructor(
        private readonly usersService: UsersService,
        private readonly requestsService: RequestsService,
        private readonly botSenderService: BotSenderService,
        private readonly schedulerRegistry: SchedulerRegistry
    ) {}

    onModuleInit() {
        const job = new CronJob(CronExpression.EVERY_HOUR, async () => {
            await this.handleCron()
        })

        this.schedulerRegistry.addCronJob('sendNewAdsToUsers', job)
        job.start()
    }

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

    async handleCron() {
        try {
            this.schedulerRegistry.getCronJob('sendNewAdsToUsers').stop()
            console.debug('Checking new properties ...')
            const bot = new TelegramBot(process.env.TOKEN)
            const users = await this.usersService.find()
            for (const user of users) {
                try {
                    await Promise.race([
                        this.handleUser(bot, user),
                        waitSeconds(10).then(() => {
                            throw new Error(
                                `Timeout of handle user #${user.userId}`
                            )
                        }),
                    ])
                } catch (ex) {
                    console.log(`Failed to handle user: ${ex}`)
                }
            }
        } catch (ex) {
            console.log(ex)
        } finally {
            console.debug('Checking new properties is ended!')
            this.schedulerRegistry.getCronJob('sendNewAdsToUsers').start()
        }
    }

    async handleUser(bot, user) {
        if (!user.enabledNotifications) return
        if (user.requestId) {
            const databaseUser = await Database.findUser(user.email)
            if (databaseUser) {
                await this.handleActiveUser(bot, user)
            }
        }
    }

    async handleActiveUser(bot, user) {
        const request = await this.requestsService.find(+user.requestId)
        if (request && request.areas && request.beds && request.price) {
            const properties: any = request.properties ? request.properties : []
            console.debug(properties)
            const newProperties = await Database.findNewProperties(
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
            ).then((properties) =>
                properties.filter((property) =>
                    isValidUrl(property.get('Телеграм ссылка'))
                )
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
                                    text: locales[user.locale].showNewAds,
                                    callback_data: Actions.StartSearchNew,
                                },
                                {
                                    text: locales[user.locale].haveAlreadyFound,
                                    callback_data: Actions.HaveAlreadyFound,
                                },
                            ],
                        ],
                    },
                }
            )
        }
    }
}
