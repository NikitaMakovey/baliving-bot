import {
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    Generated,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm'

@Entity({ name: 'users' })
export class User {
    @PrimaryGeneratedColumn()
    id: number

    @Column({ name: 'guid' })
    @Generated('uuid')
    guid: string

    @Column({ name: 'chat_id', type: 'bigint' })
    chatId: number

    @Column({ name: 'user_id', type: 'bigint' })
    userId: number

    @Column({ name: 'email', default: null })
    email: string

    @Column({ name: 'current_action', default: null })
    currentAction: string

    @Column({ name: 'next_action', default: null })
    nextAction: string

    @Column({ name: 'is_trial', default: false })
    isTrial: boolean

    @Column({ name: 'is_admin', default: false })
    isAdmin: boolean

    @Column({ name: 'locale', default: 'ru' })
    locale: string

    @Column({ name: 'request_id', type: 'bigint', default: null })
    requestId: number

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date

    @DeleteDateColumn({ name: 'deleted_at' })
    deletedAt: Date

    @Column({ name: 'message_for_delete', type: 'simple-array', default: '' })
    messageForDelete: number[]

    @Column({ name: 'warningTime', default: null })
    warningTime: Date

    @Column({ name: 'enabled_notifications', default: true })
    enabledNotifications: boolean
}
