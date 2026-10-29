
// NFA US-05: Die Eventliste ist im Browser in unter 1,5 Sekunden sichtbar.
// Gemessen gegen das LIVE-System (GitHub Pages → gateway → catalog auf Heroku), Ende zu Ende.
// KI-Kennzeichnung: mit Unterstützung von Claude (Anthropic) erstellt, vom Team geprüft (KI-Log Nr. 19).
const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.MPA_URL || 'https://tixify-wwi25a.github.io/tixify-frontend-mpa/';
const RUNS = Number(process.env.NFA_RUNS) || 5;
const LIMIT_MS = 1500;

test(`Eventliste in unter 1,5 s sichtbar (${RUNS} Aufrufe, jeweils neuer Browser-Kontext)`, async ({ browser }) => {
  const times = [];
  for (let i = 0; i < RUNS; i++) {
    const context = await browser.newContext(); // ohne Cache, wie ein neuer Besucher
    const page = await context.newPage();
    await page.goto(BASE_URL);
    const nfa = await page.waitForFunction(() => window.__tixifyNfa, null, { timeout: 30000 }).then((h) => h.jsonValue());
    await expect(page.locator('.event-card').first()).toBeVisible();
    times.push(nfa.totalMs);
    console.log(`Aufruf ${i + 1}: Liste nach ${nfa.totalMs} ms sichtbar (Serverantwort ${nfa.apiMs} ms)`);
    await context.close();
  }
  const sorted = [...times].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  console.log(`Median ${median} ms, Maximum ${sorted[sorted.length - 1]} ms, Grenze ${LIMIT_MS} ms`);
  // Jeder einzelne Aufruf muss die Grenze einhalten
  for (const t of times) expect(t).toBeLessThan(LIMIT_MS);
});