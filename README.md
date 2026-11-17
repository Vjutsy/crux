# Crux

Казуальна мобільна веб-гра про скелелазіння для вивчення словацької мови.
Обираєш тему й рівень, лізеш по згенерованій стіні — кожен рух рукою чи ногою відкриває питання зі словацьким словом.

**Грати:** https://vjutsy.github.io/crux/

## Запуск

```bash
npm install
npm run dev      # http://localhost:5173/crux/
npm run check    # типи, лінтер, тести
```

Потрібен Node.js 22+.

## Стек

Phaser 4 · TypeScript · Vite · Zod · IndexedDB (idb-keyval) · vite-plugin-pwa · Vitest · GitHub Actions → GitHub Pages.

Деталі архітектури — у [CLAUDE.md](CLAUDE.md), рішення замовника — у [docs/decisions.md](docs/decisions.md).
