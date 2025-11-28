export function getDelayMs() {
    const val = getComputedStyle(document.documentElement).getPropertyValue('--page-transition-duration').trim() || '0.35s'
    if (val.endsWith('ms')) return parseFloat(val)
    if (val.endsWith('s')) return parseFloat(val) * 1000
    const n = parseFloat(val)
    return isNaN(n) ? 350 : n
}

export async function fetchPageContent(href) {
    const res = await fetch(href, { cache: 'no-store' })
    if (!res.ok) throw new Error('Fetch failed')
    const txt = await res.text()
    const parser = new DOMParser()
    const doc = parser.parseFromString(txt, 'text/html')
    const newContent = doc.querySelector('#content')
    return {
        html: newContent ? newContent.innerHTML : null,
        className: newContent ? newContent.className : '',
        title: doc.title || document.title
    }
}

export async function loadPage(href, addToHistory = true) {
    const contentEl = document.getElementById('content')
    if (!contentEl) {
        location.href = href
        return false
    }

    const delay = getDelayMs()

    // animate out
    contentEl.classList.add('fade-out')
    contentEl.classList.remove('fade-in')

    try {
        const { html, className, title } = await fetchPageContent(href)
        // wait for exit animation
        await new Promise(r => setTimeout(r, delay))
        if (html === null) {
            location.href = href
            return false
        }

        // replace content
        contentEl.innerHTML = html
        contentEl.className = className || ''
        contentEl.classList.remove('fade-out')
        contentEl.classList.add('fade-in')

        document.title = title

        if (addToHistory) history.pushState({ url: href }, '', href)

        return true
    } catch (err) {
        location.href = href
        return false
    }
}