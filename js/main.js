import { setActiveNav, shouldHandle } from './nav.js'
import { loadPage, getDelayMs } from './pageLoader.js'

document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('loaded')

    setActiveNav()

    // attach navbar handlers (menu stays static)
    document.querySelectorAll('.navbar a').forEach(link => {
        if (!shouldHandle(link)) return
        link.addEventListener('click', async (e) => {
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return
            e.preventDefault()
            if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                location.href = link.getAttribute('href')
                return
            }
            await loadPage(link.getAttribute('href'), true)
            setActiveNav()
        })
    })

    // handle popstate
    window.addEventListener('popstate', async () => {
        const url = location.pathname.split('/').pop() || 'index.html'
        await loadPage(url, false)
        setActiveNav()
    })

    // mark aria-current for other links on initial load
    document.querySelectorAll('a').forEach(link => {
        const href = link.getAttribute('href')
        if (!href) return
        if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return
        try {
            const url = new URL(href, location.href)
            if (url.pathname === location.pathname) link.setAttribute('aria-current', 'page')
        } catch (e) {}
    })

    window.addEventListener('pageshow', (e) => {
        if (e.persisted) {
            document.body.classList.add('loaded')
            setActiveNav()
        }
    })
})