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
