import { apiRequest } from "./api.js";

let currentCartItems = [];
let cartTotal = 0;

document.addEventListener("DOMContentLoaded", async () => {
  prefillUserData();
  await loadCartFromServer();
  initPayPal();
});

function prefillUserData() {
  const nameInput = document.getElementById("buyer-name");
  const emailInput = document.getElementById("buyer-email");
  const storedUser =
    localStorage.getItem("tixify_user") || localStorage.getItem("user");

  if (storedUser) {
    try {
      const user = JSON.parse(storedUser);
      const name = user.name || user.username || "";
      const email = user.email || "";

      if (nameInput) nameInput.value = name;
      if (emailInput) emailInput.value = email;
    } catch (e) {
      console.error("Fehler beim Parsen der Benutzerdaten:", e);
    }
  } else {
    if (nameInput) nameInput.placeholder = "Name eingeben";
    if (emailInput) emailInput.placeholder = "E-Mail eingeben";
  }
}

async function loadCartFromServer() {
  try {
    const cart = await apiRequest("/cart", { method: "GET" });
    currentCartItems = cart.items || cart || [];

    const sidebar = document.querySelector("aside.card-box");
    if (!sidebar || currentCartItems.length === 0) return;

    let itemsHtml = "<h2>Deine Bestellung</h2>";
    cartTotal = 0;

    currentCartItems.forEach((item) => {
      const lineTotal = item.quantity * Number(item.price);
      cartTotal += lineTotal;
      itemsHtml += `
        <div class="summary-row"><span>${item.title || item.event_title}</span></div>
        <div class="summary-row text-muted">
          <span>${item.quantity} × ${Number(item.price).toFixed(2)} €</span>
          <span>${lineTotal.toFixed(2)} €</span>
        </div>
      `;
    });

    itemsHtml += `
      <div class="summary-row summary-row--total" style="margin-top: 12px; border-top: 1px solid #eee; padding-top: 8px;">
        <span>Gesamt</span>
        <span>${cartTotal.toFixed(2)} €</span>
      </div>
    `;
    sidebar.innerHTML = itemsHtml;
  } catch (err) {
    console.error("Warenkorb konnte nicht geladen werden:", err);
  }
}

function initPayPal() {
  const container = document.getElementById("paypal-button-container");
  if (!container || typeof paypal === "undefined") {
    return;
  }

  paypal
    .Buttons({
      createOrder: async () => {
        const res = await apiRequest("/orders/create-paypal-order", {
          method: "POST",
          body: JSON.stringify({
            amount: cartTotal,
            items: currentCartItems,
          }),
        });
        return res.paypalOrderId;
      },
      onApprove: async (data) => {
        const captureResult = await apiRequest("/orders/capture-paypal-order", {
          method: "POST",
          body: JSON.stringify({ paypalOrderId: data.orderID }),
        });

        document
          .getElementById("step-payment")
          ?.classList.remove("checkout-steps__step--active");
        document
          .getElementById("step-confirmation")
          ?.classList.add("checkout-steps__step--active");

        document.getElementById("checkout-main-content").innerHTML = `
        <div class="card-box">
          <h2 class="order-status--paid">Buchung erfolgreich!</h2>
          <p>Bestellnummer #${captureResult.orderId}. Deine Tickets wurden ausgestellt.</p>
          <a href="bookings.html" class="button" style="margin-top: 12px;">Zu meinen Buchungen</a>
        </div>
      `;
      },
      onError: (err) => {
        console.error("PayPal Checkout Fehler:", err);
        alert("Die Zahlung konnte nicht abgeschlossen werden.");
      },
    })
    .render("#paypal-button-container");
}
