// Kauf mit PayPal (UC 1): Die Kasse nutzt die dokumentierten Routen für Bezahlen und Abbruch.
// PayPal selbst wird durch eine kleine Attrappe ersetzt, die die Rückrufe des SDK auslöst.
// KI-Kennzeichnung: mit Unterstützung von Claude (Anthropic) erstellt (KI-Log Nr. 30).
const { test, expect } = require('@playwright/test');
const { mockApi } = require('./helpers/mockApi');

const BASE_URL = process.env.MPA_URL || 'https://tixify-wwi25a.github.io/Tixify_frontend/';

async function openCheckout(page, calls) {
  await mockApi(page, { loggedIn: true });
  // Attrappe des PayPal-SDK: merkt sich die Rückrufe, statt ein PayPal-Fenster zu öffnen
  await page.route(/paypal\.com\/sdk/, (route) => route.fulfill({
    contentType: 'text/javascript',
    body: 'window.paypal = { Buttons: (cfg) => ({ render: () => { window.__pp = cfg; } }) };'
  }));
  await page.route(/\/api\/orders(\/.*)?$/, (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^.*\/api/, '');
    calls.push(`${req.method()} ${path}`);
    const body = path === '/orders' ? { orderId: 11, paypalOrderId: 'PP-TEST-1' } : { orderId: 11 };
    return route.fulfill({ status: path === '/orders' ? 201 : 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(BASE_URL + 'checkout.html');
  await page.waitForFunction(() => window.__pp);
}

test('Bezahlen: Bestellung anlegen, dann Capture über /orders/:id/capture', async ({ page }) => {
  const calls = [];
  await openCheckout(page, calls);
  const paypalId = await page.evaluate(() => window.__pp.createOrder());
  expect(paypalId).toBe('PP-TEST-1');
  await page.evaluate(() => window.__pp.onApprove({ orderID: 'PP-TEST-1' }));
  expect(calls).toEqual(['POST /orders', 'POST /orders/11/capture']);
});

test('Abbruch im PayPal-Fenster gibt die Bestellung über /orders/:id/cancel frei', async ({ page }) => {
  const calls = [];
  await openCheckout(page, calls);
  await page.evaluate(() => window.__pp.createOrder());
  await page.evaluate(() => window.__pp.onCancel());
  expect(calls).toEqual(['POST /orders', 'POST /orders/11/cancel']);
});