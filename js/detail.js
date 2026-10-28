/*
 * Tixify MPA – Eventdetail: Infos, Karte, Menge, Warenkorb.
 * KI-Kennzeichnung: Toasts statt alert(), sichere Bild-URL (cssUrl), Karten-Popup
 * als Text statt HTML und isLoggedIn() wurden mit Unterstützung von Claude (Anthropic)
 * ergänzt und vom Team geprüft (KI-Log Nr. 17).
 */
import { apiRequest, setupNavigation, updateCartBadge, isLoggedIn } from './api.js';
import { art, showToast, cssUrl } from './common.js';

let currentEvent = null;
let currentQuantity = 1;

function checkAuthStatus() {
  const loggedIn = isLoggedIn();
  const loginHint = document.getElementById('login-hint');
  if (loginHint) loginHint.style.display = loggedIn ? 'none' : 'block';
  return loggedIn;
}

function showLoadError(message) {
  showToast(message, 'error');
  const title = document.getElementById('event-title');
  if (title) title.textContent = message;
  document.getElementById('btn-add-cart')?.setAttribute('disabled', '');
  document.getElementById('btn-checkout')?.setAttribute('disabled', '');
}

async function loadEventDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get('id');

  if (!eventId) {
    showLoadError('Keine Event-ID angegeben.');
    setTimeout(() => { window.location.href = 'index.html'; }, 1500);
    return;
  }

  try {
    currentEvent = await apiRequest(`/events/${encodeURIComponent(eventId)}`, { method: 'GET' });

    if (!currentEvent || !currentEvent.event_id) {
      showLoadError('Event nicht gefunden.');
      return;
    }

    document.title = `Tixify – ${currentEvent.title}`;

    document.getElementById('event-title').textContent = currentEvent.title;

    let formattedDate = 'Datum unbestimmt';
    let formattedTime = '';
    if (currentEvent.event_date) {
      const d = new Date(currentEvent.event_date);
      formattedDate = d.toLocaleDateString('de-DE');
      formattedTime = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    }

    const location = currentEvent.location || 'Ohne Ortsangabe';
    const timeText = formattedTime ? ` · ${formattedTime} Uhr` : '';
    document.getElementById('event-meta').textContent = `${formattedDate} · ${location}${timeText}`;

    const catBadge = document.getElementById('event-category');
    if (catBadge) {
      const cat = currentEvent.category || 'Konzerte';
      catBadge.textContent = cat;
      catBadge.className = `badge badge--${String(cat).toLowerCase().trim().replace(/[^a-z0-9äöüß-]/g, '')}`;
    }

    const artContainer = document.getElementById('event-art');
    if (artContainer) {
      const fallback = art(currentEvent.category || 'Konzerte', currentEvent.event_id);
      artContainer.style.backgroundImage = cssUrl(currentEvent.logo_url, fallback);
    }

    const descElem = document.getElementById('event-description');
    if (descElem) {
      descElem.textContent = currentEvent.description || 'Keine Beschreibung vorhanden.';
    }

    const stock = currentEvent.event_stock ?? currentEvent.stock ?? 0;
    const stockElem = document.getElementById('ticket-stock');
    if (stockElem) {
      stockElem.textContent = `${stock} Tickets`;
    }

    // Sicherstellen, dass die aktuelle Menge das Limit (max. 5 oder aktueller Bestand) nicht überschreitet
    const maxAllowed = Math.min(stock, 5);
    if (currentQuantity > maxAllowed) {
      currentQuantity = Math.max(1, maxAllowed);
      updatePriceDisplay();
    }

    const checkoutBtn = document.getElementById('btn-checkout');
    if (stock <= 0) {
      if (stockElem) stockElem.textContent = 'Ausverkauft';
      if (checkoutBtn) {
        checkoutBtn.disabled = true;
        checkoutBtn.textContent = 'Ausverkauft';
      }
      document.getElementById('btn-add-cart')?.setAttribute('disabled', '');
    }

    renderEventMapAndAddress(currentEvent);
    updatePriceDisplay();
    checkAuthStatus();
  } catch (err) {
    console.error('Fehler beim Laden des Events:', err);
    showLoadError(err.status === 404 ? 'Event nicht gefunden.' : 'Event konnte nicht geladen werden.');
  }
}

function renderEventMapAndAddress(eventData) {
  const addressTextEl = document.getElementById('event-address-text');
  const mapContainer = document.getElementById('event-map');

  if (!mapContainer || typeof L === 'undefined') return;

  const fullAddress = eventData.address || eventData.location || 'Keine Adresse angegeben';
  if (addressTextEl) {
    addressTextEl.textContent = fullAddress;
  }

  const lat = parseFloat(eventData.latitude);
  const lng = parseFloat(eventData.longitude);
  const hasValidCoords = !isNaN(lat) && !isNaN(lng);

  const position = hasValidCoords ? [lat, lng] : [51.1657, 10.4515];
  const zoomLevel = hasValidCoords ? 15 : 6;

  if (mapContainer._leaflet_id) {
    mapContainer._leaflet_id = null;
  }

  const map = L.map('event-map').setView(position, zoomLevel);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  if (hasValidCoords) {
    const popup = document.createElement('span');
    popup.textContent = eventData.title || 'Veranstaltungsort';
    L.marker(position).addTo(map).bindPopup(popup).openPopup();
  }
}

function updatePriceDisplay() {
  if (!currentEvent) return;

  const unitPrice = parseFloat(currentEvent.price) || 0;
  const total = unitPrice * currentQuantity;

  const priceElem = document.getElementById('ticket-price');
  if (priceElem) priceElem.textContent = `${unitPrice.toFixed(2).replace('.', ',')} €`;

  const qtyElem = document.getElementById('ticket-quantity');
  if (qtyElem) qtyElem.textContent = currentQuantity;

  const totalElem = document.getElementById('total-price');
  if (totalElem) totalElem.textContent = `${total.toFixed(2).replace('.', ',')} €`;
}

function initQuantityControls() {
  const btnDecrease = document.getElementById('btn-decrease');
  const btnIncrease = document.getElementById('btn-increase');

  btnDecrease?.addEventListener('click', () => {
    if (currentQuantity > 1) {
      currentQuantity--;
      updatePriceDisplay();
    }
  });

  btnIncrease?.addEventListener('click', () => {
    const stock = currentEvent ? (currentEvent.event_stock ?? currentEvent.stock ?? 999) : 999;
    const maxAllowed = Math.min(stock, 5);

    if (currentQuantity < maxAllowed) {
      currentQuantity++;
      updatePriceDisplay();
    } else {
      if (stock < 5) {
        showToast(`Es sind maximal nur noch ${stock} Tickets verfügbar.`, 'error');
      } else {
        showToast('Du kannst maximal 5 Tickets auf einmal auswählen.', 'error');
      }
    }
  });
}

function initCartAndCheckoutButtons() {
  const addCartBtn = document.getElementById('btn-add-cart');
  const checkoutBtn = document.getElementById('btn-checkout');

  async function addItemToCart() {
    if (!checkAuthStatus()) {
      showToast('Bitte melde dich zuerst an!', 'error');
      setTimeout(() => { window.location.href = 'login.html'; }, 1000);
      return false;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');

    await apiRequest('/cart/items', {
      method: 'POST',
      body: JSON.stringify({
        eventId: parseInt(eventId, 10),
        quantity: currentQuantity
      })
    });

    return true;
  }

  addCartBtn?.addEventListener('click', async () => {
    try {
      addCartBtn.disabled = true;
      addCartBtn.textContent = 'Wird hinzugefügt...';

      const success = await addItemToCart();
      if (success) {
        showToast(`${currentQuantity}x Ticket(s) in den Warenkorb gelegt!`, 'success');
        updateCartBadge();
        addCartBtn.textContent = '✓ Im Warenkorb';
        setTimeout(() => {
          addCartBtn.disabled = false;
          addCartBtn.textContent = '🛒 In den Warenkorb';
        }, 2000);
      } else {
        addCartBtn.disabled = false;
        addCartBtn.textContent = '🛒 In den Warenkorb';
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Fehler beim Hinzufügen', 'error');
      addCartBtn.disabled = false;
      addCartBtn.textContent = '🛒 In den Warenkorb';
    }
  });

  checkoutBtn?.addEventListener('click', async () => {
    try {
      checkoutBtn.disabled = true;
      checkoutBtn.textContent = 'Einen Moment...';

      const success = await addItemToCart();
      if (success) {
        window.location.href = 'checkout.html';
      } else {
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = 'Direkt zur Kasse';
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Fehler beim Checkout', 'error');
      checkoutBtn.disabled = false;
      checkoutBtn.textContent = 'Direkt zur Kasse';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  checkAuthStatus();
  initQuantityControls();
  loadEventDetails();
  initCartAndCheckoutButtons();
});