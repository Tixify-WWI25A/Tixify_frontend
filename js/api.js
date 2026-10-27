/*
 * Tixify MPA – API-Zugriff, Sitzung und Navigation.
 * KI-Kennzeichnung: getToken/getSession/clearSession, der Admin-Link auf die SPA
 * (nur für Admins) und das mobile Menü (Menü-Button) wurden mit Unterstützung
 * von Claude (Anthropic) erstellt, vom Team geprüft und angepasst (KI-Log Nr. 17).
 */
const API_BASE_URL = 'https://tixify-c7a903638236.herokuapp.com/api';

/** Die Eventverwaltung läuft in der Angular-SPA (Admin-Panel), nicht in der MPA. */
export const ADMIN_SPA_URL = 'https://tixify-wwi25a.github.io/tixify-frontend-spa/login';

const TOKEN_KEYS = ['tixify_token', 'token'];
const USER_KEYS = ['tixify_user', 'user'];

function readStorage(key) {
  try {
    const value = localStorage.getItem(key);
    return value && value !== 'null' && value !== 'undefined' ? value : null;
  } catch {
    return null;
  }
}

/** Liest den JWT-Payload, ohne ihn zu prüfen (das macht das Backend). */
function decodeTokenPayload(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(part))));
  } catch {
    return null;
  }
}

/** Gültiges Token oder null. Abgelaufene Tokens werden direkt entfernt. */
export function getToken() {
  const token = TOKEN_KEYS.map(readStorage).find(Boolean) || null;
  if (!token) return null;
  const payload = decodeTokenPayload(token);
  if (payload?.exp && payload.exp * 1000 < Date.now()) {
    clearSession();
    return null;
  }
  return token;
}

/** { token, user, role } der aktuellen Sitzung oder null. */
export function getSession() {
  const token = getToken();
  if (!token) return null;
  const payload = decodeTokenPayload(token) || {};
  let user = null;
  try {
    user = JSON.parse(USER_KEYS.map(readStorage).find(Boolean) || 'null');
  } catch {
    user = null;
  }
  return { token, user, role: payload.role || user?.role || 'customer' };
}

export function isLoggedIn() {
  return Boolean(getToken());
}

export function isAdmin() {
  return getSession()?.role === 'admin';
}

/** Entfernt alle Sitzungsdaten (beide Schlüsselvarianten). */
export function clearSession() {
  try {
    [...TOKEN_KEYS, ...USER_KEYS].forEach((key) => localStorage.removeItem(key));
  } catch {
    /* Speicher nicht verfügbar */
  }
}

export async function apiRequest(endpoint, options = {}) {
  const token = getToken();

  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
  } catch {
    throw new Error('Server nicht erreichbar. Bitte später erneut versuchen.');
  }

  if (response.status === 401 && token) {
    clearSession();
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || 'Serverfehler aufgetreten');
    error.status = response.status;
    throw error;
  }

  return data;
}

function isHomePage() {
  const p = window.location.pathname;
  return p.endsWith('index.html') || p.endsWith('/');
}

/** Menü-Button für schmale Bildschirme (CSS blendet ihn ab 860 px aus). */
function setupMobileMenu() {
  const container = document.querySelector('.site-header__container');
  const nav = document.querySelector('.nav-menu');
  if (!container || !nav || container.querySelector('.nav-toggle')) return;

  nav.id = nav.id || 'main-nav';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'nav-toggle';
  toggle.setAttribute('aria-controls', nav.id);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Menü öffnen');
  toggle.innerHTML = '<span></span><span></span><span></span>';

  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
  };

  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });
  container.insertBefore(toggle, nav);
}

export function setupNavigation() {
  const session = getSession();
  const links = Array.from(document.querySelectorAll('.nav-menu__link'));

  const authLink = document.getElementById('nav-auth-link') ||
    links.find((el) => /Login|Anmelden|Abmelden/.test(el.textContent));

  if (authLink) {
    if (session) {
      authLink.textContent = 'Abmelden';
      authLink.href = 'index.html';
      authLink.onclick = (e) => {
        e.preventDefault();
        clearSession();
        window.location.href = 'index.html';
      };
    } else {
      authLink.textContent = 'Anmelden';
      authLink.href = 'login.html';
      authLink.onclick = null;
    }
  }

  // "Meine Buchungen" nur mit Login
  links.forEach((link) => {
    if ((link.getAttribute('href') || '').endsWith('bookings.html')) link.hidden = !session;
  });

  const navMenu = document.querySelector('.nav-menu');

  // "Eventverwaltung" nur für Admins – verlinkt auf das Admin-Panel der SPA.
  // Nur Komfort: Die Rechte prüft das Backend (requireAdmin).
  if (navMenu && session?.role === 'admin' && !document.getElementById('nav-admin-link')) {
    const adminLink = document.createElement('a');
    adminLink.href = ADMIN_SPA_URL;
    adminLink.id = 'nav-admin-link';
    adminLink.className = 'nav-menu__link';
    adminLink.textContent = 'Eventverwaltung ↗';
    adminLink.title = 'Öffnet das Admin-Panel (eigene Anmeldung)';
    navMenu.insertBefore(adminLink, authLink && authLink.parentElement === navMenu ? authLink : null);
  }
  if (navMenu && !document.getElementById('nav-cart-link')) {
    const a = document.createElement('a');
    a.href = 'checkout.html';
    a.id = 'nav-cart-link';
    a.className = 'nav-menu__link nav-menu__cart';
    if (window.location.pathname.endsWith('checkout.html')) a.classList.add('nav-menu__link--active');
    a.innerHTML = 'Warenkorb <span id="cart-badge" class="cart-badge" style="display: none;">0</span>';
    navMenu.insertBefore(a, navMenu.firstChild);
  }

  setupMobileMenu();
  updateCartBadge();

  // Globale Header-Suche: auf Unterseiten zur Startseite weiterleiten,
  // auf der Startseite übernimmt home.js die Filterung.
  const searchInput = document.getElementById('search-input') || document.querySelector('.search-bar__input');
  const searchBtn = document.querySelector('.search-bar button') || document.getElementById('search-button');

  if (searchInput && !isHomePage()) {
    const go = (e) => {
      e?.preventDefault();
      const term = searchInput.value.trim();
      window.location.href = term ? `index.html?search=${encodeURIComponent(term)}` : 'index.html';
    };
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') go(e);
    });
    searchBtn?.addEventListener('click', go);
  }
}

export async function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (!getToken() || !badge) return;

  try {
    const cart = await apiRequest('/cart');
    const totalCount = (cart.items || []).reduce((sum, item) => sum + item.quantity, 0);
    badge.textContent = totalCount;
    badge.style.display = totalCount > 0 ? 'inline-flex' : 'none';
  } catch {
    badge.style.display = 'none';
  }
}
