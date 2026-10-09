import { apiRequest, setupNavigation } from "./api.js";

let currentEvent = null;
let currentQuantity = 1;

async function loadEventDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get("id");

  if (!eventId) {
    alert("Keine Event-ID angegeben!");
    window.location.href = "index.html";
    return;
  }

  try {
    currentEvent = await apiRequest(`/events/${eventId}`, { method: "GET" });

    if (!currentEvent) {
      alert("Event nicht gefunden!");
      return;
    }

    document.getElementById("event-title").textContent = currentEvent.title;

    const formattedDate = currentEvent.event_date
      ? new Date(currentEvent.event_date).toLocaleDateString("de-DE")
      : "Datum unbestimmt";
    const location = currentEvent.location || "Ohne Ortsangabe";
    document.getElementById("event-meta").textContent =
      `${formattedDate} · ${location}`;

    const catBadge = document.getElementById("event-category");
    if (catBadge) catBadge.textContent = currentEvent.category || "Event";

    const descElem = document.getElementById("event-description");
    if (descElem)
      descElem.textContent =
        currentEvent.description || "Keine Beschreibung vorhanden.";

    const stock = currentEvent.event_stock ?? currentEvent.stock ?? 0;
    document.getElementById("ticket-stock").textContent = `${stock} Tickets`;

    updatePriceDisplay();
  } catch (err) {
    console.error("Fehler beim Laden des Events:", err);
    alert("Event konnte nicht geladen werden.");
  }
}

function updatePriceDisplay() {
  if (!currentEvent) return;

  const unitPrice = parseFloat(currentEvent.price) || 0;
  const total = unitPrice * currentQuantity;

  document.getElementById("ticket-price").textContent =
    `${unitPrice.toFixed(2).replace(".", ",")} €`;
  document.getElementById("ticket-quantity").textContent = currentQuantity;
  document.getElementById("total-price").textContent =
    `${total.toFixed(2).replace(".", ",")} €`;
}

function initQuantityControls() {
  const btnDecrease = document.getElementById("btn-decrease");
  const btnIncrease = document.getElementById("btn-increase");

  btnDecrease?.addEventListener("click", () => {
    if (currentQuantity > 1) {
      currentQuantity--;
      updatePriceDisplay();
    }
  });

  btnIncrease?.addEventListener("click", () => {
    const stock = currentEvent
      ? (currentEvent.event_stock ?? currentEvent.stock ?? 999)
      : 999;
    if (currentQuantity < stock) {
      currentQuantity++;
      updatePriceDisplay();
    }
  });
}

function initCheckoutButton() {
  const checkoutBtn = document.getElementById("btn-checkout");
  if (!checkoutBtn) return;

  checkoutBtn.addEventListener("click", async () => {
    const token =
      localStorage.getItem("token") || localStorage.getItem("tixify_token");
    if (!token) {
      alert("Bitte melde dich zuerst an!");
      window.location.href = "login.html";
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get("id");

    try {
      await apiRequest("/cart/items", {
        method: "POST",
        body: JSON.stringify({
          eventId: parseInt(eventId, 10),
          quantity: currentQuantity,
        }),
      });

      window.location.href = "checkout.html";
    } catch (err) {
      console.error("Fehler beim Hinzufügen zum Warenkorb:", err);
      alert(err.message || "Konnte nicht zum Warenkorb hinzugefügt werden.");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  initQuantityControls();
  initCheckoutButton();
  loadEventDetails();
});
