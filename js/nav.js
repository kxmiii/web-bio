const INDEX_FILE = 'index.html'

export function normalizePath(pathname) {
    const path = pathname.replace(/\/+$/, '')
    if (!path) return `/${INDEX_FILE}`
    return path.endsWith('.html') ? path : `${path}/${INDEX_FILE}`
}

export function toUrl(href, base = location.href) {
    try {
        return new URL(href, base)
    } catch {
        return null
    }
}

export function isSamePath(a, b) {
    return a.origin === b.origin && normalizePath(a.pathname) === normalizePath(b.pathname)
}

export function isSamePage(a, b) {
    return isSamePath(a, b) && a.search === b.search
}

export function setActiveNav() {
    const current = new URL(location.href)

    document.querySelectorAll('.navbar a').forEach((link) => {
        const href = link.getAttribute('href')
        const url = href ? toUrl(href, current) : null

        if (url && isSamePath(url, current)) link.setAttribute('aria-current', 'page')
        else link.removeAttribute('aria-current')
    })
}

export function shouldHandle(link) {
    const href = link.getAttribute('href')
    if (!href) return false
    if (link.target === '_blank' || link.hasAttribute('download')) return false
    if (href.startsWith('#')) return false
    if (/^(mailto|tel|javascript):/i.test(href)) return false

    const url = toUrl(href)
    if (!url) return false
    if (url.origin !== location.origin) return false

    return url.pathname.endsWith('.html') || url.pathname.endsWith('/')
}
