export function setActiveNav() {
    document.querySelectorAll('.navbar a').forEach(a => {
        try {
            const url = new URL(a.getAttribute('href'), location.href)
            if (url.pathname === location.pathname) a.setAttribute('aria-current', 'page')
            else a.removeAttribute('aria-current')
        } catch (e) { a.removeAttribute('aria-current') }
    })
}

export function shouldHandle(link) {
    const href = link.getAttribute('href')
    if (!href) return false
    if (link.target === '_blank' || link.hasAttribute('download')) return false
    if (href.startsWith('http') && !href.startsWith(location.origin)) return false
    return href.endsWith('.html') || href.startsWith('/') || href.startsWith('./') || href.startsWith('../')
}