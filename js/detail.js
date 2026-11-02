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
let maxAllowedTickets = 5; // Dynamisches Limit (Max. 5 gesamt pro User minus bereits gekaufte Tickets)

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

    // --- ROBUSTE PRÜFUNG & DEBUGGING: Bereits gekaufte Tickets ermitteln ---
    let alreadyBooked = 0;
    if (isLoggedIn()) {
      try {
        const bookings = await apiRequest('/orders/my-bookings', { method: 'GET' });
        console.log('=== BUCHUNGEN API RESPONSE ===', bookings);
        console.log('=== CURRENT EVENT ID ===', eventId);

        if (Array.isArray(bookings) && bookings.length > 0) {
          console.log('=== ERSTE BUCHUNG DETAILS ===', bookings[0]);
          if (Array.isArray(bookings[0].tickets) && bookings[0].tickets.length > 0) {
            console.log('=== ERSTES TICKET OBJEKT ===', bookings[0].tickets[0]);
          }

          for (const order of bookings) {
            if (Array.isArray(order.tickets)) {
              for (const ticket of order.tickets) {
                // Alle denkbaren Felder für die Event-ID im Ticket prüfen
                const tEventId = ticket.event_id ?? ticket.eventId ?? ticket.eventID ?? ticket.id;
                if (tEventId && parseInt(tEventId, 10) === parseInt(eventId, 10)) {
                  alreadyBooked++;
                }
              }
            } else if (Array.isArray(order.items)) {
              for (const item of order.items) {
                const itemEventId = item.event_id ?? item.eventId ?? item.eventID;
                if (itemEventId && parseInt(itemEventId, 10) === parseInt(eventId, 10)) {
                  const itemQty = parseInt(item.quantity ?? item.ticket_count ?? 1, 10);
                  alreadyBooked += itemQty;
                }
              }
            } else {
              const orderEventId = order.event_id ?? order.eventId ?? order.eventID;
              if (orderEventId && parseInt(orderEventId, 10) === parseInt(eventId, 10)) {
                const qty = parseInt(order.quantity ?? order.ticket_count ?? 1, 10);
                alreadyBooked += qty;
              }
            }
          }
        }
        console.log('=== BERECHNET ALREADY BOOKED ===', alreadyBooked);
      } catch (err) {
        console.error('Fehler beim Prüfen der Buchungshistorie:', err);
      }
    }

    // Berechne, wie viele Tickets der User noch kaufen darf (Gesamtlimit 5 minus bereits gekaufte)
    const remainingAllowed = Math.max(0, 5 - alreadyBooked);
    maxAllowedTickets = Math.min(stock, remainingAllowed);

    const addCartBtn = document.getElementById('btn-add-cart');
    const checkoutBtn = document.getElementById('btn-checkout');

    if (stock <= 0) {
      if (stockElem) stockElem.textContent = 'Ausverkauft';
      if (checkoutBtn) {
        checkoutBtn.disabled = true;
        checkoutBtn.textContent = 'Ausverkauft';
      }
      addCartBtn?.setAttribute('disabled', '');
    } else if (alreadyBooked >= 5) {
      if (stockElem) stockElem.textContent = 'Limit von 5 Tickets bereits erreicht';
      if (checkoutBtn) {
        checkoutBtn.disabled = true;
        checkoutBtn.textContent = 'Limit erreicht';
      }
      addCartBtn?.setAttribute('disabled', '');
      showToast('Du hast bereits die maximale Anzahl von 5 Tickets für dieses Event gekauft.', 'error');
    } else if (maxAllowedTickets <= 0) {
      if (checkoutBtn) checkoutBtn.disabled = true;
      addCartBtn?.setAttribute('disabled', '');
    }

    // Aktuelle Menge hart auf das neue erlaubte Maximum deckeln (z.B. max. 2 bei schon 3 gekauften)
    if (currentQuantity > maxAllowedTickets && maxAllowedTickets > 0) {
      currentQuantity = maxAllowedTickets;
    } else if (maxAllowedTickets <= 0) {
      currentQuantity = 1;
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
    if (currentQuantity < maxAllowedTickets) {
      currentQuantity++;
      updatePriceDisplay();
    } else {
      if (maxAllowedTickets <= 0) {
        showToast('Du hast bereits die maximale Anzahl an Tickets für dieses Event erreicht.', 'error');
      } else {
        showToast(`Du kannst maximal noch ${maxAllowedTickets} weitere Tickets für dieses Event auswählen (Gesamtlimit: 5).`, 'error');
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
      addCardBtn.textContent = '🛒 In den Warenkorb';
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