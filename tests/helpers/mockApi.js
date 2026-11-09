// Testhilfe: ersetzt die Antworten des Backends durch feste Testdaten, damit die
// Oberflächentests unabhängig vom Live-System und von dessen Daten laufen.
// KI-Kennzeichnung: mit Unterstützung von Claude (Anthropic) erstellt (KI-Log Nr. 27).

// Titel mit Schadcode: würde ihn eine Seite als HTML einfügen, setzt er window.__xss.
const XSS_TITLE = '<img src=x onerror="window.__xss=1">Konzert <script>window.__xss=1</script>';

function event(id, title) {
  return {
    event_id: id,
    title,
    description: title,
    category: 'Konzerte',
    location: 'Mosbach <b>Halle</b>',
    address: 'Lohrtalweg 10, Mosbach',
    latitude: null,
    longitude: null,
    event_date: '2026-12-12T19:00:00.000Z',
    price: '25.00',
    event_stock: 120,
    logo_url: ''
  };
}

const EVENTS = [event(1, XSS_TITLE), event(2, 'Jazz-Abend mit einem sehr langen Titel, der auf schmalen Bildschirmen umbrechen muss')];

function fakeToken(role = 'customer') {
  const payload = Buffer.from(JSON.stringify({ user_id: 7, email: 'kunde@test.de', role, exp: 4102444800 })).toString('base64url');
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.signatur`;
}

/** Leitet alle Aufrufe an die API auf Testdaten um und blockiert fremde Skripte (PayPal, Karten). */
async function mockApi(page, { loggedIn = false } = {}) {
  if (loggedIn) {
    const token = fakeToken();
    await page.addInitScript((t) => {
      localStorage.setItem('tixify_token', t);
      localStorage.setItem('tixify_user', JSON.stringify({ id: 7, name: 'Testkunde', email: 'kunde@test.de', role: 'customer' }));
    }, token);
  }

  await page.route(/paypal\.com|tile\.openstreetmap|unpkg\.com/, (route) => route.abort());

  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^.*\/api/, '');
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/events') return json(EVENTS);
    const m = path.match(/^\/events\/(\d+)$/);
    if (m) return json(EVENTS.find((e) => e.event_id === Number(m[1])) || EVENTS[0]);
    if (path === '/cart') return json({ items: EVENTS.map((e) => ({ ...e, quantity: 2 })) });
    if (path === '/orders/my-bookings') {
      return json([{
        order_id: 11,
        status: 'COMPLETED',
        created_at: '2026-11-01T10:00:00.000Z',
        total_amount: '50.00',
        tickets: [
          { ticket_id: 1, event_id: 1, event_title: XSS_TITLE, ticket_code: 'TIX-AAAA-1111', price: '25.00' },
          { ticket_id: 2, event_id: 1, event_title: XSS_TITLE, ticket_code: 'TIX-AAAA-2222', price: '25.00' }
        ]
      }]);
    }
    return json({});
  });
}

module.exports = { mockApi, XSS_TITLE };
