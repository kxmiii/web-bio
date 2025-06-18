document.addEventListener('DOMContentLoaded', () => {
	document.body.classList.add('loaded')

	document.querySelectorAll('a').forEach(link => {
		if (link.href.includes('.html')) {
			link.addEventListener('click', e => {
				e.preventDefault()
				document.body.classList.remove('loaded')

				setTimeout(() => {
					window.location.href = link.href
				}, 300)
			})
		}
	})
})
