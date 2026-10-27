/*
 * Tixify MPA – Meine Buchungen und Tickets.
 * KI-Kennzeichnung: Escaping der Tabellen-/Ticketvorlagen, lokale QR-Erzeugung
 * (statt externem QR-Dienst) und data-label für die mobile Tabelle wurden mit
 * Unterstützung von Claude (Anthropic) erstellt und vom Team geprüft (KI-Log Nr. 17).
 * QR-Bibliothek: qrcode-generator 1.4.4, Kazuhiko Arase, MIT-Lizenz (js/vendor/qrcode.js).
 */
import { apiRequest, setupNavigation, getToken } from './api.js';
import { escapeHtml } from './common.js';

let userOrders = [];

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
    userOrders = await apiRequest('/orders/my-bookings');

    if (!userOrders || userOrders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7">Noch keine Buchungen vorhanden.</td></tr>';
      return;
    }

    tbody.innerHTML = userOrders.map((o, index) => {
      const tickets = o.tickets || [];
      const firstTicket = tickets[0] || {};
      const dateStr = new Date(o.created_at).toLocaleDateString('de-DE');

      return `
        <tr>
          <td data-label="Nr.">#${escapeHtml(o.order_id)}</td>
          <td data-label="Event">${escapeHtml(firstTicket.title || 'Event-Ticket')}</td>
          <td data-label="Datum">${dateStr}</td>
          <td data-label="Tickets">${tickets.length}</td>
          <td data-label="Gesamt">${euro(o.total_amount)}</td>
          <td data-label="Status" class="order-status--paid">${escapeHtml(o.status)}</td>
          <td data-label="">
            <button class="button button--outline button--small view-tickets-btn" data-index="${index}">
              Tickets anzeigen
            </button>
          </td>
        </tr>
      `;
    }).join('');

    document.querySelectorAll('.view-tickets-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const orderIdx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
        renderTicketList(userOrders[orderIdx]);
        document.getElementById('tickets-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    if (userOrders[0].tickets?.length > 0) {
      renderTicketList(userOrders[0]);
    }
  } catch (err) {
    console.error('Fehler beim Laden der Buchungen:', err);
    tbody.innerHTML = `<tr><td colspan="7">Fehler: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderTicketList(order) {
  const container = document.getElementById('tickets-container');
  if (!container || !order || !order.tickets) return;

  container.innerHTML = order.tickets.map((t, idx) => `
    <div class="ticket-item">
      <div class="ticket-item__qr">${qrSvg(t.ticket_code) || escapeHtml(t.ticket_code)}</div>
      <div class="ticket-item__details">
        <b>Ticket ${idx + 1} von ${order.tickets.length}: ${escapeHtml(t.ticket_code)}</b><br>
        <span class="text-muted">${escapeHtml(t.title)} · Status: Gültig · Einzelpreis: ${euro(t.price)}</span>
      </div>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  loadBookings();
});
