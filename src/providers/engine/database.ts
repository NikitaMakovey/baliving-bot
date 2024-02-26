import Airtable from 'airtable'
import enteringAreas from '../../config/enteringAreas'

require('dotenv').config()

export default class Database {
    static async findUser(email) {
        const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
        try {
            const records = await airtable
                .base(process.env.AIRTABLE_BASE_ID)
                .table(process.env.AIRTABLE_USERS_TABLE_ID)
                .select({
                    filterByFormula: `{Email} = "${email}"`,
                })
                .all()
            return records.length > 0 ? records[0] : null
        } catch (exception) {
            console.error(`issue detected ...\n${exception}`)
        }
    }

    static isTrialUser(databaseUser) {
        return databaseUser.get('TRIAL') === 'TRIAL'
    }

    static isVIPUser(databaseUser) {
        return databaseUser.get('Plan') === 'VIP'
    }

    static isUserAccessValid(databaseUser) {
        return databaseUser.get('Доступ действителен') === '✅'
    }

    static addAreasThatIncludeOther(city, areas) {
        const set = new Set()
        try {
            areas.forEach((area) => {
                set.add(area)
                enteringAreas[city][area].forEach((includedArea) => {
                    set.add(includedArea)
                })
            })
            return Array.from(set)
        } catch (ex) {
            console.log(`Exception entering of areas: ${ex}`)
            return areas
        }
    }

    static generateFilterForProperties(
        city,
        areas,
        categories,
        beds,
        minPrice,
        price,
        properties = [],
        lastPropetry?
    ) {
        // The api has a limitation on working with arrays. There are no functions
        // for arrays as contain or in. Therefore, the search for the number is
        // performed by the string with the number treated with commas
        const propertiesFormula = `NOT(SEARCH(CONCATENATE(",", {Номер} ,","), ',${properties},'))`
        const areas_ = this.addAreasThatIncludeOther(city, areas)
        const areaFieldName = city == 'Бали' ? 'Район' : `Район ${city}`
        const lastPropetryCondition = lastPropetry
            ? `,{Номер} > ${lastPropetry}`
            : ''
        return `
        AND(
            ${properties.length ? propertiesFormula : 'TRUE()'},
            {Модерация},
            SEARCH({${areaFieldName}}, '${areas_}'),
            SEARCH({Категория}, '${categories}'),
            SEARCH({Количество спален}, '${beds}'),
            {Цена долларов в месяц} >= ${minPrice},
            {Цена долларов в месяц} <= ${price},
            {Город} = '${city}'
            ${lastPropetryCondition}
        )
        `
    }

    static async findNewProperties(
        city,
        areas,
        categories,
        beds,
        minPrice,
        price,
        properties = [],
        limit = 3,
        lastPropetry?
    ) {
        const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
        try {
            return await airtable
                .base(process.env.AIRTABLE_BASE_ID)
                .table(process.env.AIRTABLE_PROPERTIES_TABLE_ID)
                .select({
                    filterByFormula: this.generateFilterForProperties(
                        city,
                        areas,
                        categories,
                        beds,
                        minPrice,
                        price,
                        properties,
                        lastPropetry
                    ),
                    maxRecords: limit,
                    sort: [{ field: 'Дата создания', direction: 'desc' }],
                })
                .all()
        } catch (exception) {
            console.error(`issue detected ...\n${exception}`)
            return []
        }
    }
}
