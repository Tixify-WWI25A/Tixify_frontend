# Tixify MPA (Kundenshop)

**Der Touchpoint für Kunden:** Veranstaltungen suchen, Tickets kaufen, mit PayPal (Sandbox) bezahlen und die Tickets mit QR-Code abrufen. Gebaut als **Multi-Page-Application** mit HTML, CSS und JavaScript ohne Framework.

Live: https://tixify-wwi25a.github.io/Tixify_frontend/
Studienprojekt (DHBW Mosbach, WWI25A): Es fließt kein echtes Geld, bezahlt wird in der PayPal-Sandbox.

| Repo | Aufgabe |
|---|---|
| **Tixify_frontend** | **MPA für Kunden (dieses Repo)** |
| tixify-frontend-spa | Admin-SPA (Angular) |
| Tixify_backend | gateway (BFF) und identity: einzige Adresse beider Frontends |
| tixify-catalog | Events, GraphQL, Reservierungen |
| tixify-orders | Warenkorb, PayPal, Bestellungen, Mails |

## Seiten

Jede Ansicht ist eine eigene HTML-Seite mit eigenem JavaScript-Modul. Ein Seitenwechsel lädt die Seite neu (MPA-Prinzip).

| Seite | Skript | Inhalt |
|---|---|---|
| `index.html` | `js/home.js` | Startseite: Suche, Filter (Kategorie, Ort, Datum, Preis), Sortierung, 6 Events pro Seite |
| `detail.html` | `js/detail.js` | Eventdetails mit Karte, Mengenauswahl (höchstens 5 Tickets pro Kunde und Event), in den Warenkorb |
| `login.html` | `js/login.js` | Anmelden und Registrieren |
| `checkout.html` | `js/checkout.js` | Warenkorb, Übersicht, Bezahlen mit dem PayPal JavaScript SDK |
| `bookings.html` | `js/bookings.js` | „Meine Buchungen“ mit einem QR-Code pro Ticket (lokal im Browser erzeugt) |

Gemeinsam genutzt:

- `js/api.js`: `apiRequest()` ruft das gateway auf (`https://tixify-c7a903638236.herokuapp.com/api`), hängt das JWT als `Authorization: Bearer …` an und wirft bei Fehlern die Meldung des Backends. Abgelaufene Tokens werden gelöscht.
- `js/common.js`: Kopfbereich, Toasts, `escapeHtml`, `safeUrl` und `cssUrl` (Schutz vor XSS: Daten aus der API werden nie ungeprüft als HTML eingefügt).
- `css/styles.css`: ein Stylesheet für alle Seiten, Farbvariablen für helles und dunkles Farbschema.

## Kauf mit PayPal

`checkout.js` nutzt drei Callbacks des PayPal SDK:

| Callback | Aufruf an das Backend | Ergebnis |
|---|---|---|
| `createOrder` | `POST /api/orders` | orders reserviert die Tickets im catalog (15 Min.) und legt die PayPal-Order mit dem Betrag aus dem catalog an |
| `onApprove` | `POST /api/orders/:id/capture` | Zahlung einziehen, Tickets erzeugen, Weiterleitung zu „Meine Buchungen“ |
| `onCancel` | `POST /api/orders/:id/cancel` | Tickets sofort wieder frei, Warenkorb bleibt |

Der Betrag kommt immer aus dem Backend, nie aus dem Browser.

## Responsiv

Umbruchpunkte bei 860 px und 600 px. Unter 600 px gibt es einen Menü-Button, Tabellen werden zu Karten, alle Bedienelemente sind mindestens 44 px hoch.

## Tests

Browser-Tests mit Playwright (13 Tests):

| Datei | Prüft |
|---|---|
| `tests/xss.spec.js` | Event mit Schadcode im Titel wird als Text angezeigt, nichts wird ausgeführt |
| `tests/mobile.spec.js` | Darstellung bei 375 px ohne horizontales Scrollen |
| `tests/checkout.spec.js` | Bezahlen und Abbrechen im Checkout (Backend und PayPal simuliert) |
| `tests/nfa.spec.js` | Ladezeit der Eventliste live (Grenze 1,5 s) |

```bash
npm install
npx playwright install chromium
npm test
```

## Deployment

`.github/workflows/pages.yml` veröffentlicht die Seiten bei jedem Push auf `main` auf GitHub Pages. `.github/workflows/nfa.yml` misst danach die Ladezeit gegen die Live-Seite.

## KI-Einsatz

Die Erstfassungen der Seiten wurden mit Gemini erstellt (KI-Log Nr. 10, 13, 15, 16, 25), die Überarbeitung mit XSS-Schutz, mobiler Ansicht und neuer Kasse mit Claude (Nr. 48). Die Höchstmenge und „Meine Buchungen“ entstanden mit Gemini (Nr. 50), die Tests mit Claude (Nr. 52, 63, 68). Das Team hat jede Änderung im Browser getestet und bewertet. Jede Datei nennt im Kopfkommentar die zugehörigen Nummern im KI-Log der Projektdokumentation.
