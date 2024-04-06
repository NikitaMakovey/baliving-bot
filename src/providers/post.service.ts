import { Process, Processor } from '@nestjs/bull'
import { UsersService } from '../users/users.service'
import { Job } from 'bull'
import { BotSenderService } from './bot-sender.service'

@Processor('post')
export class PostService {
    constructor(
        readonly botSender: BotSenderService,
        readonly usersService: UsersService
    ) {}

    @Process({ name: 'post', concurrency: 1 })
    private async handlePost(job: Job<any>): Promise<void> {
        const users = await this.usersService.find()
        for (const user of users) {
            try {
                const { fromChatId, messageId } = job.data
                await this.botSender.copyMessage(
                    user.chatId,
                    fromChatId,
                    messageId
                )
            } catch (ex) {
                console.log(`Failed to send post: ${ex}`)
            }
        }
    }
}
