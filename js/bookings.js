/*
 * Tixify MPA – Meine Buchungen und Tickets.
 * KI-Kennzeichnung: Escaping der Tabellen-/Ticketvorlagen, lokale QR-Erzeugung
 * (statt externem QR-Dienst) und data-label für die mobile Tabelle wurden mit
 * Unterstützung von Claude (Anthropic) erstellt und vom Team geprüft (KI-Log Nr. 17).
 * QR-Bibliothek: qrcode-generator 1.4.4, Kazuhiko Arase, MIT-Lizenz (js/vendor/qrcode.js).
 */
import { apiRequest, setupNavigation, getToken } from './api.js';
import { escapeHtml } from './common.js';

let displayRows = [];

const euro = (value) => `${(parseFloat(value) || 0).toFixed(2).replace('.', ',')} €`;

/** QR-Code als SVG lokal im Browser erzeugen – der Ticketcode verlässt das Gerät nicht. */
function qrSvg(text) {
  if (typeof window.qrcode !== 'function') return '';
  const qr = window.qrcode(0, 'M');
  qr.addData(String(text));
  qr.make();
  return qr.createSvgTag({ cellSize: 3, margin: 2, scalable: true, alt: `QR-Code ${text}` });
}

async function loadBookings() {
  const tbody = document.querySelector('.data-table tbody');
  if (!tbody) return;

  if (!getToken()) {
    tbody.innerHTML = '<tr><td colspan="7">Bitte <a href="login.html">melde dich an</a>, um deine Buchungen zu sehen.</td></tr>';
    return;
  }

  try {
    const userOrders = await apiRequest('/orders/my-bookings');

    if (!userOrders || userOrders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7">Noch keine Buchungen vorhanden.</td></tr>';
      return;
    }

    displayRows = [];

    // Jede Bestellung durchgehen und bei gemischten Events nach Event aufteilen
    userOrders.forEach((o) => {
      const tickets = o.tickets || [];
      const dateStr = new Date(o.created_at).toLocaleDateString('de-DE');
      const status = o.status || 'COMPLETED';

      // Tickets nach Event gruppieren
      const eventGroups = {};
      tickets.forEach((t) => {
        const eventKey = t.event_id || t.title || t.event_title || 'Event-Ticket';
        if (!eventGroups[eventKey]) {
          eventGroups[eventKey] = {
            title: t.title || t.event_title || 'Event-Ticket',
            tickets: []
          };
        }
        eventGroups[eventKey].tickets.push(t);
      });

      const groupKeys = Object.keys(eventGroups);

      groupKeys.forEach((key, groupIdx) => {
        const group = eventGroups[key];
        // Teilsumme für dieses spezifische Event berechnen
        const groupTotal = group.tickets.reduce((sum, t) => sum + (parseFloat(t.price) || 0), 0);

        displayRows.push({
          originalOrder: o,
          orderId: o.order_id,
          eventTitle: group.title,
          dateStr: dateStr,
          tickets: group.tickets,
          totalAmount: groupTotal > 0 ? groupTotal : (o.total_amount / groupKeys.length),
          status: status,
          isSplit: groupKeys.length > 1,
          subIndex: groupIdx
        });
      });
    });

    if (displayRows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7">Noch keine Buchungen vorhanden.</td></tr>';
      return;
    }

    tbody.innerHTML = displayRows.map((row, index) => {
      return `
        <tr>
          <td data-label="Nr.">#${escapeHtml(row.orderId)}${row.isSplit ? ` (${row.subIndex + 1})` : ''}</td>
          <td data-label="Event">${escapeHtml(row.eventTitle)}</td>
          <td data-label="Datum">${row.dateStr}</td>
          <td data-label="Tickets">${row.tickets.length}</td>
          <td data-label="Gesamt">${euro(row.totalAmount)}</td>
          <td data-label="Status" class="order-status--paid">${escapeHtml(row.status)}</td>
          <td data-label="">
            <button class="button button--outline button--small view-tickets-btn" data-row-index="${index}">
              Tickets anzeigen
            </button>
          </td>
        </tr>
      `;
    }).join('');

    document.querySelectorAll('.view-tickets-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const rowIndex = parseInt(e.currentTarget.getAttribute('data-row-index'), 10);
        const rowData = displayRows[rowIndex];
        renderTicketList(rowData.tickets);
        document.getElementById('tickets-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    // Direkt beim Laden die Tickets des ersten Eintrags anzeigen
    if (displayRows[0]?.tickets?.length > 0) {
      renderTicketList(displayRows[0].tickets);
    }
  } catch (err) {
    console.error('Fehler beim Laden der Buchungen:', err);
    tbody.innerHTML = `<tr><td colspan="7">Fehler: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderTicketList(tickets) {
  const container = document.getElementById('tickets-container');
  if (!container || !tickets) return;

  container.innerHTML = tickets.map((t, idx) => `
    <div class="ticket-item">
      <div class="ticket-item__qr">${qrSvg(t.ticket_code) || escapeHtml(t.ticket_code)}</div>
      <div class="ticket-item__details">
        <b>Ticket ${idx + 1} von ${tickets.length}: ${escapeHtml(t.ticket_code)}</b><br>
        <span class="text-muted">${escapeHtml(t.title || t.event_title || 'Event-Ticket')} · Status: Gültig · Einzelpreis: ${euro(t.price)}</span>
      </div>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  loadBookings();
});