import { CacheModule, Module } from '@nestjs/common'
import { BotPollerService } from './providers/bot-poller.service'
import { BotSenderService } from './providers/bot-sender.service'
import { UsersService } from './users/users.service'
import { User } from './users/entities/user.entity'
import { Request } from './requests/entities/request.entity'
import { TypeOrmModule } from '@nestjs/typeorm'
import { RequestsService } from './requests/requests.service'
import { ScheduleModule } from '@nestjs/schedule'
import { TasksService } from './providers/tasks.service'
import { FetchModule } from 'nestjs-fetch'
import { BullModule } from '@nestjs/bull'
import { MessageHandler } from './providers/engine/message-handler'
import { CallbackHandler } from './providers/engine/callback-handler'
import { PostService } from './providers/post.service'
import * as redisStore from 'cache-manager-redis-store'

@Module({
    imports: [
        FetchModule,
        ScheduleModule.forRoot(),
        TypeOrmModule.forRoot({
            type: 'postgres',
            host: process.env.DB_HOST,
            port: +process.env.DB_PORT,
            username: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            entities: [User, Request],
            synchronize: true,
        }),
        TypeOrmModule.forFeature([User, Request]),
        BullModule.forRoot({
            redis: {
                host: process.env.REDIS_HOST,
                port: parseInt(process.env.REDIS_PORT),
                password: process.env.REDIS_PASSWORD,
            },
        }),
        BullModule.registerQueue({
            name: 'post',
        }),
        CacheModule.register({
            isGlobal: true,
            store: redisStore,
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT,
            password: process.env.REDIS_PASSWORD,
            ttl: 0,
        }),
    ],
    providers: [
        PostService,
        BotPollerService,
        MessageHandler,
        CallbackHandler,
        UsersService,
        RequestsService,
        TasksService,
        BotSenderService,
    ],
})
export class AppModule {}
