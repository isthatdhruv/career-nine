Lightweight HTML starter
- Single small HTML file with inline CSS/JS (~5KB uncompressed).
- Optional service worker caches index.html.

Run locally:
1. cd online-Assement
2. python3 -m http.server 8000
3. Open http://localhost:8000 in Chrome (or any browser).

To test under 100 KB/s:
- Chrome DevTools > Network > Throttle > Add custom profile set Download = 100 KB/s.
- Reload the page and verify it loads quickly.

Notes:
- No external fonts or libraries to minimize requests.
- Keep images as inline SVG if needed (no extra network fetches).