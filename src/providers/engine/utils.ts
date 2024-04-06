export function isValidUrl(string) {
    let url
    try {
        url = new URL(string)
    } catch (_) {
        return false
    }
    return url.protocol === 'http:' || url.protocol === 'https:'
}

export function convertToMoscosTZ(date: Date | string) {
    return new Date(
        (typeof date === 'string' ? new Date(date) : date).toLocaleString(
            'en-US',
            { timeZone: 'Europe/Moscow' }
        )
    )
}
