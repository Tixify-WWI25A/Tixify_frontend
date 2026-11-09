// Sicherheit (US-06, KI-Log Nr. 17): Daten aus der API werden als Text angezeigt, nie als HTML ausgeführt.
// Ein Veranstaltungstitel mit Schadcode darf auf keiner Seite Skript ausführen.
// KI-Kennzeichnung: mit Unterstützung von Claude (Anthropic) erstellt (KI-Log Nr. 27).
const { test, expect } = require('@playwright/test');
const { mockApi } = require('./helpers/mockApi');

const BASE_URL = process.env.MPA_URL || 'https://tixify-wwi25a.github.io/Tixify_frontend/';

const PAGES = [
  { name: 'Startseite', path: 'index.html', loggedIn: false, ready: '.event-card' },
  { name: 'Detailseite', path: 'detail.html?id=1', loggedIn: false, ready: 'h1' },
  { name: 'Kasse', path: 'checkout.html', loggedIn: true, ready: '.cart-item__title' },
  { name: 'Meine Buchungen', path: 'bookings.html', loggedIn: true, ready: 'tbody tr' }
];

for (const p of PAGES) {
  test(`${p.name}: Schadcode im Veranstaltungstitel wird nicht ausgeführt`, async ({ page }) => {
    const dialogs = [];
    page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
    await mockApi(page, { loggedIn: p.loggedIn });
    await page.goto(BASE_URL + p.path);
    await expect(page.locator(p.ready).first()).toBeVisible();
    await page.waitForTimeout(300);

    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    expect(dialogs).toEqual([]);
    // Der Titel erscheint als Text, die spitzen Klammern sind sichtbar statt als Tag interpretiert
    await expect(page.getByText('<img src=x', { exact: false }).first()).toBeVisible();
    expect(await page.locator('img[src="x"]').count()).toBe(0);
  });
}
