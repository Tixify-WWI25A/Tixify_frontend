// US-07 (CR-01): Jede Kundenseite ist bei 375 px Breite ohne waagerechtes Scrollen bedienbar.
// Prüft den Überlauf der Seite und die Mindestgröße der Bedienelemente (44 px, AK-07-2).
// KI-Kennzeichnung: mit Unterstützung von Claude (Anthropic) erstellt (KI-Log Nr. 27).
const { test, expect } = require('@playwright/test');
const { mockApi } = require('./helpers/mockApi');

const BASE_URL = process.env.MPA_URL || 'https://tixify-wwi25a.github.io/Tixify_frontend/';

const PAGES = [
  { name: 'Startseite', path: 'index.html', loggedIn: false, ready: '.event-card' },
  { name: 'Detailseite', path: 'detail.html?id=2', loggedIn: false, ready: 'h1' },
  { name: 'Anmeldung', path: 'login.html', loggedIn: false, ready: 'form' },
  { name: 'Kasse', path: 'checkout.html', loggedIn: true, ready: '.cart-item__title' },
  { name: 'Meine Buchungen', path: 'bookings.html', loggedIn: true, ready: 'tbody tr' }
];

test.use({ viewport: { width: 375, height: 780 }, isMobile: true, hasTouch: true });

for (const p of PAGES) {
  test(`${p.name}: kein waagerechter Überlauf bei 375 px`, async ({ page }) => {
    await mockApi(page, { loggedIn: p.loggedIn });
    await page.goto(BASE_URL + p.path);
    await expect(page.locator(p.ready).first()).toBeVisible();

    // clientWidth statt innerWidth: im Mobil-Modus wächst innerWidth mit dem Inhalt mit
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'Seite ist breiter als der Bildschirm').toBeLessThanOrEqual(0);
  });
}

test('Startseite: Menü-Button und Suchfeld sind groß genug zum Tippen (44 px)', async ({ page }) => {
  await mockApi(page);
  await page.goto(BASE_URL + 'index.html');
  await expect(page.locator('.event-card').first()).toBeVisible();

  const targets = page.locator('header button:visible, header input:visible');
  const count = await targets.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const box = await targets.nth(i).boundingBox();
    expect(box.height, `Element ${i + 1} im Kopfbereich`).toBeGreaterThanOrEqual(44);
  }
});
