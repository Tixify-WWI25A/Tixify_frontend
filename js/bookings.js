import { apiRequest, setupNavigation } from './api.js';

let userOrders = [];

async function loadBookings() {
  const tbody = document.querySelector('.data-table tbody');

  try {
    userOrders = await apiRequest('/orders/my-bookings');

    if (!userOrders || userOrders.length === 0) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="7">Noch keine Buchungen vorhanden.</td></tr>';
      return;
    }

    if (tbody) {
      tbody.innerHTML = userOrders.map((o, index) => {
        const firstTicket = o.tickets[0] || {};
        const dateStr = new Date(o.created_at).toLocaleDateString('de-DE');
        const totalFormatted = parseFloat(o.total_amount).toFixed(2).replace('.', ',') + ' €';

        return `
          <tr>
            <td>#${o.order_id}</td>
            <td>${firstTicket.title || 'Event-Ticket'}</td>
            <td>${dateStr}</td>
            <td>${o.tickets.length}</td>
            <td>${totalFormatted}</td>
            <td class="order-status--paid">${o.status}</td>
            <td>
              <button class="button button--outline button--small view-tickets-btn" data-index="${index}">
                Tickets anzeigen
              </button>
            </td>
          </tr>
        `;
      }).join('');

      document.querySelectorAll('.view-tickets-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const orderIdx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
          renderTicketList(userOrders[orderIdx]);
        });
      });
    }

    if (userOrders.length > 0 && userOrders[0].tickets?.length > 0) {
      renderTicketList(userOrders[0]);
    }

  } catch (err) {
    console.error('Fehler beim Laden der Buchungen:', err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="7">Fehler: ${err.message}</td></tr>`;
  }
}

function renderTicketList(order) {
  const container = document.getElementById('tickets-container') || document.querySelector('.ticket-item')?.parentElement;
  if (!container || !order || !order.tickets) return;

  container.innerHTML = order.tickets.map((t, idx) => {
    // Generiert einen echten, scannbaren QR-Code direkt aus dem eindeutigen Ticket-Code
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=4&data=${encodeURIComponent(t.ticket_code)}`;

    return `
      <div class="ticket-item" style="margin-bottom: 10px; display: flex; align-items: center; background: #fff; border: 1px dashed var(--color-accent, #6B4FC4); border-radius: 8px; overflow: hidden;">
        <div style="width: 90px; height: 90px; flex-shrink: 0; background: #fff; display: flex; align-items: center; justify-content: center; padding: 6px; border-right: 1px dashed var(--color-accent, #6B4FC4);">
          <img src="${qrUrl}" alt="QR-Code ${t.ticket_code}" style="width: 100%; height: 100%; object-fit: contain; display: block;" />
        </div>
        <div class="ticket-item__details" style="padding: 12px 16px;">
          <b>Ticket ${idx + 1} von ${order.tickets.length}: ${t.ticket_code}</b><br>
          <span class="text-muted" style="font-size: 13px;">${t.title} · Status: Gültig · Einzelpreis: ${parseFloat(t.price).toFixed(2).replace('.', ',')} €</span>
        </div>
      </div>
    `;
  }).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  loadBookings();
});