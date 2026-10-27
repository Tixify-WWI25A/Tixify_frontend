/*
 * Tixify MPA – Kasse: Warenkorb, Ticketinhaber, PayPal-Sandbox, Bestätigung.
 * KI-Kennzeichnung: Überarbeitung von Aufbau und Darstellung (Fortschrittsanzeige,
 * Warenkorbliste, Übersicht mit Weiter-Button, mobile Summenleiste), Escaping der
 * Vorlagen und die PayPal-Ladeprüfung wurden mit Unterstützung von Claude (Anthropic)
 * erstellt und vom Team geprüft (KI-Log Nr. 17).
 * Unser Code: Ablauf createOrder (POST /orders → paypalOrderId) und onApprove (Capture).
 */
import { apiRequest, setupNavigation, getSession, updateCartBadge } from './api.js';
import { art, showToast, escapeHtml, cssUrl } from './common.js';

const MAX_PER_EVENT = 5; // gleiche Grenze wie MAX_TICKETS_PER_EVENT in tixify-orders

let cartData = { items: [] };
let currentStep = 1;
let isUpdating = false;

const euro = (value) => `${(parseFloat(value) || 0).toFixed(2).replace('.', ',')} €`;
const $ = (id) => document.getElementById(id);

function formatEventDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' Uhr';
}

async function initCheckout() {
  if (!getSession()) {
    showToast('Bitte melde dich an, um zur Kasse zu gehen.', 'error');
    setTimeout(() => { window.location.href = 'login.html'; }, 1000);
    return;
  }

  loadUserData();
  initStepNavigation();
  await loadCart();
  initPayPal();
}

function loadUserData() {
  const user = getSession()?.user || {};
  const userName = user.name || user.username || user.email?.split('@')[0] || 'Kunde';
  const userEmail = user.email || 'Keine E-Mail hinterlegt';

  $('billing-name-display').textContent = userName;
  $('billing-email-display').textContent = userEmail;
  $('billing-avatar').textContent = userName.trim().charAt(0).toUpperCase() || 'K';
  $('billing-name').value = userName;
  $('billing-email').value = userEmail;
}

function setProceedEnabled(enabled) {
  ['btn-to-payment', 'btn-to-payment-mobile'].forEach((id) => {
    const btn = $(id);
    if (btn) btn.disabled = !enabled;
  });
}

function renderEmptyCart() {
  $('cart-items-container').innerHTML = `
    <div class="card-box cart-empty">
      <div class="cart-empty__icon" aria-hidden="true">🎟️</div>
      <h3>Dein Warenkorb ist leer</h3>
      <p class="text-muted">Such dir ein Event aus und leg Tickets in den Warenkorb.</p>
      <a href="index.html" class="button">Events entdecken</a>
    </div>`;
  $('order-summary-list').innerHTML = '<p class="text-muted">Noch keine Tickets ausgewählt.</p>';
  $('order-total-price').textContent = euro(0);
  $('mobilebar-total').textContent = euro(0);
  $('cart-count').textContent = '';
  setProceedEnabled(false);
  updateMobileBar();
}

async function loadCart() {
  try {
    cartData = (await apiRequest('/cart')) || { items: [] };
  } catch (err) {
    console.error('Fehler beim Abrufen des Warenkorbs:', err);
    $('cart-items-container').innerHTML = `<div class="card-box"><p class="text-error">Warenkorb konnte nicht geladen werden: ${escapeHtml(err.message)}</p></div>`;
    setProceedEnabled(false);
    return;
  }

  const items = cartData.items || [];
  if (items.length === 0) {
    renderEmptyCart();
    updateCartBadge();
    return;
  }

  const grandTotal = items.reduce((sum, i) => sum + (parseFloat(i.price) || 0) * i.quantity, 0);
  const ticketCount = items.reduce((sum, i) => sum + i.quantity, 0);

  $('cart-items-container').innerHTML = items.map((item) => {
    const id = escapeHtml(item.event_id);
    const title = escapeHtml(item.title);
    const imageStyle = cssUrl(item.logo_url, art(item.category || 'Konzerte', item.event_id));
    const maxQty = Math.min(MAX_PER_EVENT, Number(item.event_stock) || MAX_PER_EVENT);
    const meta = [formatEventDate(item.event_date), item.location || 'Ohne Ortsangabe'].filter(Boolean).map(escapeHtml).join(' · ');

    return `
      <article class="cart-item" data-event-id="${id}">
        <a href="detail.html?id=${encodeURIComponent(item.event_id)}" class="cart-item__img" style="background-image: ${escapeHtml(imageStyle)};" aria-label="Details zu ${title}"></a>
        <div class="cart-item__info">
          <a href="detail.html?id=${encodeURIComponent(item.event_id)}" class="cart-item__title">${title}</a>
          <span class="text-muted">${meta}</span>
          <span class="text-muted">${euro(item.price)} pro Ticket</span>
        </div>
        <div class="cart-item__controls">
          <div class="quantity-control" role="group" aria-label="Anzahl Tickets für ${title}">
            <button type="button" class="btn-qty-minus" data-id="${id}" aria-label="Ein Ticket weniger">−</button>
            <span class="qty-display" aria-live="polite">${escapeHtml(item.quantity)}</span>
            <button type="button" class="btn-qty-plus" data-id="${id}" aria-label="Ein Ticket mehr" ${item.quantity >= maxQty ? 'disabled' : ''}>+</button>
          </div>
          <button type="button" class="btn-delete-item" data-id="${id}">Entfernen</button>
        </div>
        <div class="cart-item__price">${euro((parseFloat(item.price) || 0) * item.quantity)}</div>
      </article>`;
  }).join('');

  $('order-summary-list').innerHTML = items.map((item) => `
    <div class="summary-item">
      <div>
        <div class="summary-item__title">${escapeHtml(item.title)}</div>
        <small class="text-muted">${escapeHtml(item.quantity)} × ${euro(item.price)}</small>
      </div>
      <div class="summary-item__price">${euro((parseFloat(item.price) || 0) * item.quantity)}</div>
    </div>`).join('');

  $('cart-count').textContent = `${ticketCount} ${ticketCount === 1 ? 'Ticket' : 'Tickets'}`;
  $('order-total-price').textContent = euro(grandTotal);
  $('mobilebar-total').textContent = euro(grandTotal);
  setProceedEnabled(true);
  updateMobileBar();
  attachCartItemEvents();
  updateCartBadge();
}

function attachCartItemEvents() {
  const container = $('cart-items-container');
  container.onclick = async (e) => {
    const btn = e.target.closest('button[data-id]');
    if (!btn || isUpdating) return;
    const eventId = parseInt(btn.dataset.id, 10);
    const item = cartData.items.find((i) => i.event_id === eventId);
    if (!item) return;

    if (btn.classList.contains('btn-qty-plus')) await changeQuantity(eventId, 1);
    else if (btn.classList.contains('btn-qty-minus')) {
      if (item.quantity > 1) await changeQuantity(eventId, -1);
      else await deleteCartItem(eventId, item.title);
    } else if (btn.classList.contains('btn-delete-item')) await deleteCartItem(eventId, item.title);
  };
}

async function withLock(fn) {
  isUpdating = true;
  const container = $('cart-items-container');
  container.setAttribute('aria-busy', 'true');
  container.querySelectorAll('button').forEach((b) => { b.disabled = true; });
  try {
    await fn();
  } finally {
    isUpdating = false;
    container.removeAttribute('aria-busy');
    await loadCart();
  }
}

function changeQuantity(eventId, delta) {
  return withLock(async () => {
    try {
      await apiRequest('/cart/items', { method: 'POST', body: JSON.stringify({ eventId, delta }) });
    } catch (err) {
      showToast(err.message || 'Menge konnte nicht geändert werden.', 'error');
    }
  });
}

function deleteCartItem(eventId, title) {
  return withLock(async () => {
    try {
      await apiRequest(`/cart/items/${eventId}`, { method: 'DELETE' });
      showToast(`„${title}“ entfernt.`, 'success');
    } catch (err) {
      showToast(err.message || 'Konnte Artikel nicht entfernen.', 'error');
    }
  });
}

function updateMobileBar() {
  const bar = $('checkout-mobilebar');
  if (bar) bar.hidden = currentStep !== 1 || !(cartData.items || []).length;
}

function switchStep(step) {
  currentStep = step;
  [1, 2, 3].forEach((n) => {
    const tab = $(`step-tab-${n}`);
    tab.classList.toggle('is-active', n === step);
    tab.classList.toggle('is-done', n < step);
    if (n === step) tab.setAttribute('aria-current', 'step');
    else tab.removeAttribute('aria-current');
    $(`step-content-${n}`).classList.toggle('is-active', n === step);
  });

  // Weiter-Button nur im Warenkorb; nach dem Kauf keine Übersicht mehr
  $('btn-to-payment').hidden = step !== 1;
  $('checkout-layout').classList.toggle('is-finished', step === 3);
  updateMobileBar();

  window.scrollTo({ top: 0, behavior: 'smooth' });
  $(`step-content-${step}`).querySelector('h2')?.focus?.();
}

function goToPayment() {
  if (!cartData.items || cartData.items.length === 0) {
    showToast('Dein Warenkorb ist leer.', 'error');
    return;
  }
  switchStep(2);
}

function initStepNavigation() {
  $('btn-to-payment')?.addEventListener('click', goToPayment);
  $('btn-to-payment-mobile')?.addEventListener('click', goToPayment);
  $('btn-back-to-cart')?.addEventListener('click', () => switchStep(1));
}

function initPayPal() {
  const container = $('paypal-button-container');
  if (!container) return;
  if (!window.paypal) {
    container.innerHTML = '<p class="text-error">PayPal konnte nicht geladen werden. Bitte Seite neu laden oder Werbeblocker prüfen.</p>';
    return;
  }

  container.innerHTML = '';

  window.paypal.Buttons({
    style: { layout: 'vertical', shape: 'rect', label: 'pay' },
    createOrder: async () => {
      try {
        const res = await apiRequest('/orders', { method: 'POST' });
        return res.paypalOrderId;
      } catch (err) {
        showToast(err.message || 'PayPal-Bestellung konnte nicht erstellt werden.', 'error');
        throw err;
      }
    },
    onApprove: async (data) => {
      try {
        const res = await apiRequest('/orders/capture-paypal-order', {
          method: 'POST',
          body: JSON.stringify({ paypalOrderId: data.orderID })
        });

        $('confirmed-order-id').textContent = `#${res.orderId}`;
        showToast('Zahlung erfolgreich abgeschlossen!', 'success');
        cartData = { items: [] };
        updateCartBadge();
        switchStep(3);
      } catch (err) {
        showToast(err.message || 'Zahlung konnte nicht verarbeitet werden.', 'error');
      }
    },
    onCancel: () => {
      showToast('Zahlung abgebrochen – dein Warenkorb ist noch da.', 'error');
    },
    onError: (err) => {
      console.error('PayPal-Fehler:', err);
      showToast('Zahlung fehlgeschlagen. Bitte erneut versuchen.', 'error');
    }
  }).render('#paypal-button-container');
}

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  initCheckout();
});
