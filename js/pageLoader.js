import { normalizePath } from './nav.js'

const CACHE_LIMIT = 20

const pageCache = new Map()
const inFlight = new Map()

let navigationId = 0
let activeNavigation = null
let fadeStartedAt = 0

export function getDelayMs() {
    const value = getComputedStyle(document.documentElement)
        .getPropertyValue('--page-transition-duration')
        .trim() || '0.35s'

    if (value.endsWith('ms')) return parseFloat(value)
    if (value.endsWith('s')) return parseFloat(value) * 1000
    const number = parseFloat(value)
    return Number.isNaN(number) ? 350 : number
}

export function createEntryId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }
    return `entry-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function cacheKey(url) {
    return `${url.origin}${normalizePath(url.pathname)}${url.search}`
}

function remember(key, page) {
    pageCache.delete(key)
    pageCache.set(key, page)

    if (pageCache.size > CACHE_LIMIT) {
        pageCache.delete(pageCache.keys().next().value)
    }
}

function trackRequest(key, promise, signal) {
    const record = { promise, signal }
    inFlight.set(key, record)

    const cleanup = () => {
        if (inFlight.get(key) === record) inFlight.delete(key)
    }
    promise.then(cleanup, cleanup)

    return promise
}

function getPending(key) {
    const record = inFlight.get(key)
    if (!record) return null

    if (record.signal && record.signal.aborted) {
        inFlight.delete(key)
        return null
    }

    return record.promise
}

async function requestPage(url, { signal } = {}) {
    const response = await fetch(url.href, { cache: 'no-store', signal })
    if (!response.ok) throw new Error(`Failed to load ${url.href}: ${response.status}`)

    const text = await response.text()
    const doc = new DOMParser().parseFromString(text, 'text/html')
    const content = doc.querySelector('#content')
    if (!content) return null

    return {
        html: content.innerHTML,
        className: content.className,
        title: doc.title || document.title
    }
}

export function prefetchPage(href) {
    const url = typeof href === 'string' ? new URL(href, location.href) : href
    const key = cacheKey(url)

    if (pageCache.has(key)) return Promise.resolve(pageCache.get(key))

    const pending = getPending(key)
    if (pending) return pending

    const request = requestPage(url)
        .then((page) => {
            if (page) remember(key, page)
            return page
        })
        .catch(() => null)

    return trackRequest(key, request)
}

async function getPage(url, { signal } = {}) {
    const key = cacheKey(url)

    if (pageCache.has(key)) return pageCache.get(key)

    const pending = getPending(key)
    if (pending) return pending

    const request = requestPage(url, { signal }).then((page) => {
        if (page) remember(key, page)
        return page
    })

    return trackRequest(key, request, signal)
}

function wait(ms, signal) {
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(new DOMException('Aborted', 'AbortError'))
            return
        }

        function onAbort() {
            clearTimeout(timer)
            reject(new DOMException('Aborted', 'AbortError'))
        }

        const timer = setTimeout(() => {
            signal.removeEventListener('abort', onAbort)
            resolve()
        }, ms)

        signal.addEventListener('abort', onAbort, { once: true })
    })
}

export function loadPage(href, { historyMode = 'push', onNavigate } = {}) {
    const target = typeof href === 'string' ? new URL(href, location.href) : href

    if (
        activeNavigation &&
        activeNavigation.href === target.href &&
        activeNavigation.historyMode === historyMode
    ) {
        return activeNavigation.promise
    }

    if (activeNavigation) activeNavigation.controller.abort()

    const controller = new AbortController()
    const navigation = {
        href: target.href,
        historyMode,
        controller,
        promise: null
    }
    activeNavigation = navigation

    navigation.promise = runNavigation(target, { historyMode, onNavigate, controller }).finally(() => {
        if (activeNavigation === navigation) activeNavigation = null
    })

    return navigation.promise
}

async function runNavigation(target, { historyMode, onNavigate, controller }) {
    const contentEl = document.getElementById('content')
    if (!contentEl) {
        location.href = target.href
        return false
    }

    const { signal } = controller
    const id = ++navigationId

    const wasFadingOut = contentEl.classList.contains('fade-out')
    if (!wasFadingOut || !fadeStartedAt) fadeStartedAt = performance.now()

    const elapsed = performance.now() - fadeStartedAt
    const delay = Math.max(0, getDelayMs() - elapsed)

    contentEl.classList.add('fade-out')
    contentEl.classList.remove('fade-in')

    try {
        const page = await getPage(target, { signal })
        await wait(delay, signal)

        if (id !== navigationId) return false
        if (!page) {
            location.href = target.href
            return false
        }

        contentEl.innerHTML = page.html
        contentEl.className = page.className || ''
        contentEl.classList.remove('fade-out')
        contentEl.classList.add('fade-in')
        fadeStartedAt = 0

        document.title = page.title

        const state = { href: target.href, id: createEntryId(), title: page.title, scrollY: 0 }
        if (historyMode === 'push') history.pushState(state, '', target.href)
        else if (historyMode === 'replace') history.replaceState(state, '', target.href)

        if (historyMode !== 'none') window.scrollTo(0, 0)

        if (typeof onNavigate === 'function') onNavigate(page.title)

        return true
    } catch (error) {
        if (signal.aborted || id !== navigationId) return false
        location.href = target.href
        return false
    }
}
