import { UsersService } from '../../users/users.service';
import locales from "../../config/locales";
import { User } from "../../users/entities/user.entity";
import Database from "./database";
import areas from "../../config/areas";
import { RequestsService } from "../../requests/requests.service";

const START_COMMAND: string = '/start';
const EDIT_COMMAND: string = '/edit';

const DEFAULT_LOCALE = 'ru';

const CHOSE = '✅';
const TRIAL = 'TRIAL';

const ACTIONS = {
    0: { currentAction: 'ask-email', nextAction: 'read-email' },
    1: { currentAction: 'waiting-for-reply', nextAction: null },
    2: { currentAction: 'waiting-for-reply', nextAction: 'read-areas' },
    3: { currentAction: 'waiting-for-reply', nextAction: 'read-beds' },
    4: { currentAction: 'waiting-for-reply', nextAction: 'read-price' },
    5: { currentAction: 'waiting-for-reply', nextAction: 'confirm' },
    6: { currentAction: 'display-results', nextAction: null },
}

export default class MessageHandler {
    constructor(
        private readonly usersService: UsersService,
        private readonly requestsService: RequestsService,
        private readonly bot
    ) {}
    async handle(message) {
        const chatId: number = message.chat.id;
        const userId: number = message.from.id;
        const user: User = await this.usersService.findOne(userId, chatId);
        console.debug(user);
        console.debug(message);
        try {
            if (message.text.toString() === START_COMMAND) {
                await this.handleStartMessage(message, user);
            } else if (user.nextAction && user.nextAction === 'read-email') {
                await this.handleEmailMessage(message, user);
            } else if (user.nextAction && (
                user.nextAction.includes('read-price') || user.nextAction.includes('read-edit-price')
            )) {
                await this.handlePriceMessage(message, user);
            } else if (message.text.toString() === EDIT_COMMAND) {
                await this.handleEditMessage(message);
            }
        } catch (exception) {
            console.error(exception);
        }
    }

    async handleEditMessage(message) {
        const options: any = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: locales[DEFAULT_LOCALE].editAreas, callback_data: 'edit-areas' }],
                    [{ text: locales[DEFAULT_LOCALE].editBeds, callback_data: 'edit-beds' }],
                    [{ text: locales[DEFAULT_LOCALE].editPrice, callback_data: 'edit-price' }],
                ]
            }
        }
        await this.bot.sendMessage(
            message.chat.id,
            locales[DEFAULT_LOCALE].choseEditOption,
            options
        );
    }

    async handlePriceMessage(message, user) {
        const price: number = +message.text;
        console.debug(price);
        if (Number.isNaN(price)) {
            await this.bot.sendMessage(
                user.chatId,
                locales[DEFAULT_LOCALE].price
            );
        } else {
            console.debug(message);
            const request: any = await this.requestsService.update(+user.requestId, { price });
            if (user.nextAction.includes('delete-message')) {
                await this.bot.deleteMessage(user.chatId, +user.nextAction.substring(user.nextAction.indexOf(':') + 1))
            }
            await this.bot.deleteMessage(user.chatId, message.message_id);
            await this.usersService.update(user.userId, user.chatId, ACTIONS[5]);
            await this.bot.sendMessage(
                message.chat.id,
                locales[DEFAULT_LOCALE].finish,
                { parse_mode: 'html' }
            );
            const options: any = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: locales[DEFAULT_LOCALE].agree, callback_data: 'start-search' }],
                    ]
                }
            }
            let template: string = locales[DEFAULT_LOCALE].details;
            console.debug(request);
            template = template.replace('${areas}', request.areas.join(','));
            template = template.replace('${beds}', request.beds.join(','));
            template = template.replace('${price}', request.price);
            await this.bot.sendMessage(
                message.chat.id,
                template,
                options
            );
        }
    }

    async handleStartMessage(message, user) {
        await this.usersService.update(user.userId, user.chatId, { ...ACTIONS[0], requestId: null });
        await this.bot.sendMessage(
            message.chat.id,
            locales[DEFAULT_LOCALE].start,
        );
    }

    sliceIntoChunks(array, size) {
        const result = [];
        for (let i = 0; i < array.length; i += size) {
            const chunk = array.slice(i, i + size);
            result.push(chunk);
        }
        return result;
    }

    async handleEmailMessage(message, user) {
        const email: string = message.text.toString().toLowerCase();
        await this.usersService.update(user.userId, user.chatId, { email });
        await this.bot.sendMessage(
            message.chat.id,
            locales[DEFAULT_LOCALE].checking,
        );
        const databaseUser: any = await Database.findUser(email);
        if (!databaseUser) {
            await this.usersService.update(user.userId, user.chatId, ACTIONS[1]);
            const options: any = {
                reply_markup: {
                    inline_keyboard: [
                        [{
                            text: locales[DEFAULT_LOCALE].goToWebsite,
                            switch_inline_query: locales[DEFAULT_LOCALE].goToWebsite,
                            url: 'https://baliving.ru/tariffs'
                        }],
                        [{text: `${locales[DEFAULT_LOCALE].writeAnotherEmail}`, callback_data: `start` }]
                    ]
                }
            }
            await this.bot.sendMessage(
                message.chat.id,
                locales[DEFAULT_LOCALE].notFound,
                options
            );
        } else if (databaseUser.get('Доступ действителен') === CHOSE) {
            if (databaseUser.get('Plan') === 'VIP' || databaseUser.get('TRIAL') === TRIAL) {
                await this.usersService.update(user.userId, user.chatId, {
                    ...ACTIONS[2],
                    isTrial: databaseUser.get('TRIAL') === TRIAL
                });
                let keyboard: any = [];
                areas.forEach(area => {
                    keyboard.push({text: `${area}`, callback_data: `read-areas ${area}` })
                });
                const inlineKeyboard: any = [];
                const rows = this.sliceIntoChunks(keyboard, 2); // 2 cols in a row
                rows.forEach(row => {
                    inlineKeyboard.push(row);
                })
                const options: any = {
                    reply_markup: {
                        inline_keyboard: inlineKeyboard
                    }
                }
                await this.bot.sendMessage(
                    message.chat.id,
                    locales[DEFAULT_LOCALE].chooseAreas,
                    options
                );
            } else {
                await this.usersService.update(user.userId, user.chatId, ACTIONS[1]);
                const options: any = {
                    reply_markup: {
                        inline_keyboard: [
                            [{
                                text: locales[DEFAULT_LOCALE].goToWebsite,
                                switch_inline_query: locales[DEFAULT_LOCALE].goToWebsite,
                                url: 'https://baliving.ru/tariffs'
                            }],
                            [{
                                text: locales[DEFAULT_LOCALE].writeToSupport,
                                switch_inline_query: locales[DEFAULT_LOCALE].writeToSupport,
                                url: 'https://t.me/info_baliving'
                            }],
                            [{text: `${locales[DEFAULT_LOCALE].writeAnotherEmail}`, callback_data: `start` }]
                        ]
                    }
                }
                await this.bot.sendMessage(
                    message.chat.id,
                    locales[DEFAULT_LOCALE].expired,
                    options
                );
            }
        } else {
            await this.usersService.update(user.userId, user.chatId, ACTIONS[1]);
            const options: any = {
                reply_markup: {
                    inline_keyboard: [
                        [{
                            text: locales[DEFAULT_LOCALE].goToWebsite,
                            switch_inline_query: locales[DEFAULT_LOCALE].goToWebsite,
                            url: 'https://baliving.ru/tariffs'
                        }],
                        [{text: `${locales[DEFAULT_LOCALE].writeAnotherEmail}`, callback_data: `start` }]
                    ]
                }
            }
            await this.bot.sendMessage(
                message.chat.id,
                locales[DEFAULT_LOCALE].expired,
                options
            );
        }
    }
}