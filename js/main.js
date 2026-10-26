import { setActiveNav, shouldHandle, isSamePage } from './nav.js'
import { loadPage, prefetchPage, createEntryId } from './pageLoader.js'

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

const scrollPositions = new Map()
let activeEntryId = null
let ignoreScroll = false

function createPageAnnouncer() {
    const region = document.createElement('div')
    region.id = 'page-announcer'
    region.setAttribute('aria-live', 'polite')
    region.setAttribute('aria-atomic', 'true')
    region.style.cssText =
        'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;'
    document.body.appendChild(region)
    return region
}

function setupNavigation(onNavigate) {
    document.addEventListener('click', (event) => {
        if (event.defaultPrevented || event.button !== 0) return
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

        const targetEl = event.target instanceof Element ? event.target : null
        const link = targetEl ? targetEl.closest('a[href]') : null
        if (!link || !shouldHandle(link)) return

        const target = new URL(link.href)
        const current = new URL(location.href)

        if (isSamePage(target, current)) {
            if (!target.hash) event.preventDefault()
            return
        }

        if (reducedMotion.matches) return

        event.preventDefault()
        if (activeEntryId) scrollPositions.set(activeEntryId, window.scrollY)
        loadPage(target, { historyMode: 'push', onNavigate }).then((loaded) => {
            if (loaded) setActiveNav()
        })
    })
}

function setupPrefetch() {
    const connection = navigator.connection
    if (connection && connection.saveData) return

    const currentUrl = () => new URL(location.href)

    const canPrefetch = (link) => {
        if (!shouldHandle(link)) return false
        return !isSamePage(new URL(link.href), currentUrl())
    }

    const prefetchFrom = (event) => {
        const targetEl = event.target instanceof Element ? event.target : null
        const link = targetEl ? targetEl.closest('a[href]') : null
        if (link && canPrefetch(link)) prefetchPage(link.href)
    }

    document.addEventListener('pointerover', prefetchFrom, { passive: true })
    document.addEventListener('focusin', prefetchFrom)

    const prefetchNav = () => {
        document.querySelectorAll('.navbar a').forEach((link) => {
            if (canPrefetch(link)) prefetchPage(link.href)
        })
    }

    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(prefetchNav, { timeout: 2000 })
    } else {
        window.setTimeout(prefetchNav, 1000)
    }
}

function setupScrollMemory() {
    let frame = 0

    window.addEventListener(
        'scroll',
        () => {
            if (ignoreScroll || frame) return
            frame = window.requestAnimationFrame(() => {
                frame = 0
                if (activeEntryId) scrollPositions.set(activeEntryId, window.scrollY)
            })
        },
        { passive: true }
    )
}

function restoreScroll(value) {
    const top = Number.isFinite(value) ? value : 0

    window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => window.scrollTo(0, top))
    })
}

document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('loaded')

    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

    const initialState = history.state || {}
    const initialScroll = initialState.scrollY
    activeEntryId = initialState.id || createEntryId()
    history.replaceState({ ...initialState, id: activeEntryId, href: location.href }, '')

    const announcer = createPageAnnouncer()
    const onNavigate = (title) => {
        announcer.textContent = title
        const state = history.state
        if (state && state.id) activeEntryId = state.id
    }

    setActiveNav()
    setupNavigation(onNavigate)
    setupPrefetch()
    setupScrollMemory()

    if (!location.hash && Number.isFinite(initialScroll) && initialScroll > 0) {
        restoreScroll(initialScroll)
    }

    window.addEventListener('popstate', async (event) => {
        const state = event.state || {}
        const href = state.href || location.href

        if (activeEntryId) scrollPositions.set(activeEntryId, window.scrollY)
        activeEntryId = state.id || createEntryId()
        if (!state.id) {
            history.replaceState({ ...state, id: activeEntryId, href: location.href }, '')
        }

        ignoreScroll = true
        const loaded = await loadPage(href, { historyMode: 'none', onNavigate })
        if (loaded) {
            const saved = scrollPositions.has(activeEntryId)
                ? scrollPositions.get(activeEntryId)
                : state.scrollY
            restoreScroll(saved)
        }
        setActiveNav()
        window.setTimeout(() => {
            ignoreScroll = false
        }, 150)
    })

    window.addEventListener('pagehide', () => {
        if (activeEntryId) scrollPositions.set(activeEntryId, window.scrollY)
        if (!history.state) return
        try {
            history.replaceState({ ...history.state, scrollY: window.scrollY }, '')
        } catch {}
    })

    window.addEventListener('pageshow', (event) => {
        if (!event.persisted) return
        document.body.classList.add('loaded')
        setActiveNav()
    })
})
