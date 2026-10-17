import { apiRequest, setupNavigation, updateCartBadge } from './api.js';
import { art, showToast } from '../js/common.js';

let currentEvent = null;
let currentQuantity = 1;

function checkAuthStatus() {
  const token = localStorage.getItem('token') || localStorage.getItem('tixify_token');
  const userRaw = localStorage.getItem('user');
  
  let isLoggedIn = Boolean(token && token !== 'null' && token !== 'undefined');
  
  if (!isLoggedIn && userRaw && userRaw !== 'null' && userRaw !== 'undefined') {
    try {
      const parsed = JSON.parse(userRaw);
      isLoggedIn = Boolean(parsed && Object.keys(parsed).length > 0);
    } catch {
      isLoggedIn = false;
    }
  }

  const navText = document.querySelector('.nav-menu')?.textContent.toLowerCase() || '';
  if (navText.includes('anmelden') || navText.includes('login / registrieren')) {
    isLoggedIn = false;
  }

  const loginHint = document.getElementById('login-hint');
  if (loginHint) {
    loginHint.style.display = isLoggedIn ? 'none' : 'block';
  }

  return isLoggedIn;
}

async function loadEventDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get('id');

  if (!eventId) {
    alert('Keine Event-ID angegeben!');
    window.location.href = 'index.html';
    return;
  }

  try {
    currentEvent = await apiRequest(`/events/${eventId}`, { method: 'GET' });

    if (!currentEvent) {
      alert('Event nicht gefunden!');
      return;
    }

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
      catBadge.className = `badge badge--${cat.toLowerCase().trim()}`;
    }

    const artContainer = document.getElementById('event-art');
    if (artContainer) {
      const coverUrl = currentEvent.logo_url || art(currentEvent.category || 'Konzerte', currentEvent.event_id);
      artContainer.style.backgroundImage = `url('${coverUrl}')`;
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

    const checkoutBtn = document.getElementById('btn-checkout');
    if (stock <= 0) {
      if (stockElem) stockElem.textContent = 'Ausverkauft';
      if (checkoutBtn) {
        checkoutBtn.disabled = true;
        checkoutBtn.textContent = 'Ausverkauft';
        checkoutBtn.style.opacity = '0.5';
      }
    }

    renderEventMapAndAddress(currentEvent);
    updatePriceDisplay();
    checkAuthStatus();
  } catch (err) {
    console.error('Fehler beim Laden des Events:', err);
    alert('Event konnte nicht geladen werden.');
  }
}

function renderEventMapAndAddress(eventData) {
  const addressTextEl = document.getElementById('event-address-text');
  const mapContainer = document.getElementById('event-map');

  if (!mapContainer) return;

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
    L.marker(position).addTo(map)
      .bindPopup(eventData.title || 'Veranstaltungsort')
      .openPopup();
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
    if (currentQuantity < stock) {
      currentQuantity++;
      updatePriceDisplay();
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