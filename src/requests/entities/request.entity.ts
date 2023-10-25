import {
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    Generated,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm'

@Entity({ name: 'requests' })
export class Request {
    @PrimaryGeneratedColumn()
    id: number

    @Column({ name: 'guid' })
    @Generated('uuid')
    guid: string

    @Column({ name: 'user_id', type: 'bigint' })
    userId: number

    @Column({ name: 'city', default: 'Бали' })
    city: string

    @Column({
        name: 'categories',
        type: 'simple-array',
        default: 'Вилла,Комната,Гестхаус,Апартаменты,Дом',
    })
    categories: string

    @Column({ name: 'areas', type: 'simple-array', default: null })
    areas: string

    @Column({ name: 'beds', type: 'simple-array', default: null })
    beds: string

    @Column({ name: 'properties', type: 'simple-array', default: null })
    properties: string

    @Column({ name: 'min_price', default: null })
    minPrice: number

    @Column({ name: 'price', default: null })
    price: number

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date

    @DeleteDateColumn({ name: 'deleted_at' })
    deletedAt: Date

    isFilled() {
        return (
            this.areas != null &&
            this.beds != null &&
            this.minPrice != null &&
            this.price != null
        )
    }
}
