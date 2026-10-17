import { apiRequest, setupNavigation } from './api.js';
import { art, showToast } from '../js/common.js';

let cartData = { items: [] };
let currentUser = null;
let isUpdating = false;

async function initCheckout() {
  const token = localStorage.getItem('token') || localStorage.getItem('tixify_token');
  if (!token) {
    showToast('Bitte melde dich an, um zur Kasse zu gehen.', 'error');
    window.location.href = 'login.html';
    return;
  }

  await loadUserData();
  await loadCart();
  initStepNavigation();
  initPayPal();
}

async function loadUserData() {
  const nameDisplay = document.getElementById('billing-name-display');
  const emailDisplay = document.getElementById('billing-email-display');
  const avatarElem = document.getElementById('billing-avatar');
  const nameInput = document.getElementById('billing-name');
  const emailInput = document.getElementById('billing-email');

  try {
    const userRaw = localStorage.getItem('user') || localStorage.getItem('tixify_user');
    if (userRaw && userRaw !== 'null' && userRaw !== 'undefined') {
      try {
        currentUser = JSON.parse(userRaw);
      } catch (e) {
        currentUser = null;
      }
    }

    if (!currentUser) {
      const token = localStorage.getItem('token') || localStorage.getItem('tixify_token');
      if (token && token.includes('.')) {
        const payloadBase64 = token.split('.')[1];
        currentUser = JSON.parse(atob(payloadBase64));
      }
    }

    const userName = currentUser?.name || currentUser?.username || currentUser?.email?.split('@')[0] || 'Kunde';
    const userEmail = currentUser?.email || 'Keine E-Mail hinterlegt';
    const initialLetter = userName.trim().charAt(0).toUpperCase() || 'K';

    if (nameDisplay) nameDisplay.textContent = userName;
    if (emailDisplay) emailDisplay.textContent = userEmail;
    if (avatarElem) avatarElem.textContent = initialLetter;

    if (nameInput) nameInput.value = userName;
    if (emailInput) emailInput.value = userEmail;

  } catch (err) {
    console.warn('Benutzerdaten konnten nicht geladen werden:', err);
    if (nameDisplay) nameDisplay.textContent = 'Kunde';
    if (emailDisplay) emailDisplay.textContent = '';
    if (avatarElem) avatarElem.textContent = 'K';
  }
}

async function loadCart() {
  const cartContainer = document.getElementById('cart-items-container');
  const summaryContainer = document.getElementById('order-summary-list');
  const totalPriceElem = document.getElementById('order-total-price');
  const proceedBtn = document.getElementById('btn-to-payment');

  try {
    const res = await apiRequest('/cart');
    cartData = res || { items: [] };

    if (!cartData.items || cartData.items.length === 0) {
      if (cartContainer) {
        cartContainer.innerHTML = `
          <div style="padding: 24px 0; text-align: center;">
            <p class="text-muted" style="margin-bottom: 16px;">Dein Warenkorb ist derzeit leer.</p>
            <a href="index.html" class="button">Jetzt Events entdecken</a>
          </div>
        `;
      }
      if (summaryContainer) summaryContainer.innerHTML = '<p class="text-muted">Keine Artikel im Korb</p>';
      if (totalPriceElem) totalPriceElem.textContent = '0,00 €';
      if (proceedBtn) proceedBtn.disabled = true;
      return;
    }

    if (proceedBtn) proceedBtn.disabled = false;

    let grandTotal = 0;

    if (cartContainer) {
      cartContainer.innerHTML = cartData.items.map(item => {
        const itemTotal = parseFloat(item.price) * item.quantity;
        grandTotal += itemTotal;
        const imgUrl = item.logo_url || art(item.category || 'Konzerte', item.event_id);

        return `
          <div class="cart-item-row" id="cart-row-${item.event_id}" data-event-id="${item.event_id}">
            <div class="cart-item-img" style="background-image: url('${imgUrl}');"></div>
            <div>
              <b style="font-size: 15px;">${item.title}</b><br>
              <span class="text-muted">${item.location || 'Ohne Ortsangabe'} · Einzelpreis: ${parseFloat(item.price).toFixed(2).replace('.', ',')} €</span>
            </div>
            <div class="quantity-control" style="margin: 0;">
              <button type="button" class="btn-qty-minus" data-id="${item.event_id}">−</button>
              <span class="qty-display" data-id="${item.event_id}">${item.quantity}</span>
              <button type="button" class="btn-qty-plus" data-id="${item.event_id}">+</button>
            </div>
            <div class="item-total-price" data-id="${item.event_id}" style="font-weight: 700; min-width: 80px; text-align: right;">
              ${itemTotal.toFixed(2).replace('.', ',')} €
            </div>
            <div>
              <button type="button" class="btn-delete-item" data-id="${item.event_id}">Löschen</button>
            </div>
          </div>
        `;
      }).join('');
    }

    if (summaryContainer) {
      summaryContainer.innerHTML = cartData.items.map(item => `
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <div>
            <div>${item.title}</div>
            <small class="text-muted">${item.quantity} × ${parseFloat(item.price).toFixed(2).replace('.', ',')} €</small>
          </div>
          <div style="font-weight: 600;">
            ${(parseFloat(item.price) * item.quantity).toFixed(2).replace('.', ',')} €
          </div>
        </div>
      `).join('');
    }

    if (totalPriceElem) {
      totalPriceElem.textContent = `${grandTotal.toFixed(2).replace('.', ',')} €`;
    }

    attachCartItemEvents();
  } catch (err) {
    console.error('Fehler beim Abrufen des Warenkorbs:', err);
    if (cartContainer) cartContainer.innerHTML = `<p style="color: red;">Fehler: ${err.message}</p>`;
  }
}

function attachCartItemEvents() {
  document.querySelectorAll('.btn-qty-minus').forEach(btn => {
    btn.onclick = async (e) => {
      e.preventDefault();
      if (isUpdating) return;
      const eventId = parseInt(e.currentTarget.dataset.id, 10);
      const currentItem = cartData.items.find(i => i.event_id === eventId);
      if (!currentItem) return;

      if (currentItem.quantity > 1) {
        await changeQuantity(eventId, currentItem.quantity - 1, -1);
      } else {
        await deleteCartItem(eventId);
      }
    };
  });

  document.querySelectorAll('.btn-qty-plus').forEach(btn => {
    btn.onclick = async (e) => {
      e.preventDefault();
      if (isUpdating) return;
      const eventId = parseInt(e.currentTarget.dataset.id, 10);
      const currentItem = cartData.items.find(i => i.event_id === eventId);
      if (!currentItem) return;

      await changeQuantity(eventId, currentItem.quantity + 1, 1);
    };
  });

  document.querySelectorAll('.btn-delete-item').forEach(btn => {
    btn.onclick = async (e) => {
      e.preventDefault();
      if (isUpdating) return;
      const eventId = parseInt(e.currentTarget.dataset.id, 10);
      await deleteCartItem(eventId);
    };
  });
}

async function changeQuantity(eventId, newQty, delta) {
  isUpdating = true;
  disableControlButtons(true);

  const qtyElem = document.querySelector(`.qty-display[data-id="${eventId}"]`);
  if (qtyElem) qtyElem.textContent = newQty;

  try {
    await apiRequest('/cart/items', {
      method: 'POST',
      body: JSON.stringify({
        eventId,
        quantity: newQty,
        delta: delta
      })
    });

    await loadCart();
  } catch (err) {
    showToast(err.message || 'Menge konnte nicht aktualisiert werden.', 'error');
    await loadCart();
  } finally {
    isUpdating = false;
    disableControlButtons(false);
  }
}

async function deleteCartItem(eventId) {
  isUpdating = true;
  disableControlButtons(true);

  try {
    await apiRequest(`/cart/items/${eventId}`, { method: 'DELETE' });
    showToast('Artikel entfernt.', 'success');
    await loadCart();
  } catch (err) {
    showToast(err.message || 'Konnte Artikel nicht löschen.', 'error');
  } finally {
    isUpdating = false;
    disableControlButtons(false);
  }
}

function disableControlButtons(disabled) {
  document.querySelectorAll('.btn-qty-minus, .btn-qty-plus, .btn-delete-item').forEach(b => {
    b.disabled = disabled;
    b.style.opacity = disabled ? '0.5' : '1';
  });
}

function switchStep(stepIndex) {
  [1, 2, 3].forEach(step => {
    const tab = document.getElementById(`step-tab-${step}`);
    const content = document.getElementById(`step-content-${step}`);
    if (tab) {
      if (step === stepIndex) {
        tab.classList.add('checkout-steps__step--active');
      } else {
        tab.classList.remove('checkout-steps__step--active');
      }
    }
    if (content) {
      if (step === stepIndex) {
        content.classList.add('is-active');
      } else {
        content.classList.remove('is-active');
      }
    }
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function initStepNavigation() {
  document.getElementById('btn-to-payment')?.addEventListener('click', () => {
    if (!cartData.items || cartData.items.length === 0) {
      showToast('Dein Warenkorb ist leer!', 'error');
      return;
    }
    switchStep(2);
  });

  document.getElementById('btn-back-to-cart')?.addEventListener('click', () => {
    switchStep(1);
  });
}

function initPayPal() {
  const container = document.getElementById('paypal-button-container');
  if (!container || !window.paypal) return;

  container.innerHTML = '';

  window.paypal.Buttons({
    createOrder: async () => {
      try { l } catch (err) {
        showToast(err.message || 'PayPal Order konnte nicht erstellt werden.', 'error');
        throw err;
      }
    },
    onApprove: async (data) => {
      try {
        const res = await apiRequest('/orders/capture-paypal-order', {
          method: 'POST',
          body: JSON.stringify({ paypalOrderId: data.orderID })
        });

        document.getElementById('confirmed-order-id').textContent = `#${res.orderId}`;
        showToast('Zahlung erfolgreich abgeschlossen!', 'success');
        switchStep(3);
      } catch (err) {
        showToast(err.message || 'Zahlung konnte nicht verarbeitet werden.', 'error');
      }
    },
    onError: (err) => {
      console.error('PayPal Error:', err);
      showToast('Zahlungsvorgang abgebrochen oder fehlgeschlagen.', 'error');
    }
  }).render('#paypal-button-container');
}

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  initCheckout();
});