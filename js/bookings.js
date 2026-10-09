import { apiRequest, setupNavigation } from "./api.js";
import { art } from "../js/common.js";

let userOrders = [];

async function loadBookings() {
  const tbody = document.querySelector(".data-table tbody");

  try {
    userOrders = await apiRequest("/orders/my-bookings");

    if (!userOrders || userOrders.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7">Noch keine Buchungen vorhanden.</td></tr>';
      return;
    }

    tbody.innerHTML = userOrders
      .map((o, index) => {
        const firstTicket = o.tickets[0] || {};
        const dateStr = new Date(o.created_at).toLocaleDateString("de-DE");
        const totalFormatted =
          parseFloat(o.total_amount).toFixed(2).replace(".", ",") + " €";

        return `
        <tr>
          <td>#${o.order_id}</td>
          <td>${firstTicket.title || "Event-Ticket"}</td>
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
      })
      .join("");

    document.querySelectorAll(".view-tickets-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const orderIdx = parseInt(
          e.currentTarget.getAttribute("data-index"),
          10,
        );
        renderTicketList(userOrders[orderIdx]);
      });
    });

    if (userOrders.length > 0 && userOrders[0].tickets.length > 0) {
      renderTicketList(userOrders[0]);
    }
  } catch (err) {
    console.error("Fehler beim Laden der Buchungen:", err);
    tbody.innerHTML = `<tr><td colspan="7">Fehler: ${err.message}</td></tr>`;
  }
}

function renderTicketList(order) {
  const container =
    document.getElementById("tickets-container") ||
    document.querySelector(".ticket-item");
  if (!container || !order.tickets) return;

  container.innerHTML = order.tickets
    .map(
      (t, idx) => `
    <div class="ticket-item" style="margin-bottom: 10px;">
      <div class="ticket-item__qr media-placeholder" style="background-image: url('${art("qr")}')"></div>
      <div class="ticket-item__details">
        <b>Ticket ${idx + 1} von ${order.tickets.length}: ${t.ticket_code}</b><br>
        <span class="text-muted">${t.title} · Status: Gültig · Einzelpreis: ${parseFloat(t.price).toFixed(2).replace(".", ",")} €</span>
      </div>
    </div>
  `,
    )
    .join("");
}

document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  loadBookings();
});
