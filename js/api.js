const API_BASE_URL = 'https://tixify-c7a903638236.herokuapp.com/api';

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('tixify_token');

  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    localStorage.removeItem('tixify_token');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Serverfehler aufgetreten');
  }

  return data;
}

export function setupNavigation() {
  // --- Bestehende Login / Logout Logik ---
  const token = localStorage.getItem('token') || localStorage.getItem('tixify_token');
  const user = localStorage.getItem('user');
  const isLoggedIn = Boolean(token || (user && user !== 'null' && user !== '{}'));

  const authLink = document.getElementById('nav-auth-link') || 
                   Array.from(document.querySelectorAll('.nav-menu__link')).find(el => 
                     el.textContent.includes('Login') || el.textContent.includes('Anmelden') || el.textContent.includes('Abmelden')
                   );

  if (authLink) {
    if (isLoggedIn) {
      authLink.textContent = 'Abmelden';
      authLink.href = '#';
      authLink.onclick = (e) => {
        e.preventDefault();
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = 'index.html';
      };
    } else {
      authLink.textContent = 'Anmelden';
      authLink.href = 'login.html';
      authLink.onclick = null;
    }
  }

  let cartLink = document.getElementById('nav-cart-link');
  if (!cartLink) {
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu) {
      const a = document.createElement('a');
      a.href = 'checkout.html';
      a.id = 'nav-cart-link';
      a.className = 'nav-menu__link nav-menu__cart';
      a.innerHTML = `
        🛒 Warenkorb
        <span id="cart-badge" class="cart-badge" style="display: none;">0</span>
      `;
      navMenu.insertBefore(a, navMenu.firstChild);
    }
  }
  updateCartBadge();

  // --- NEU: Globale Header-Suche für alle Seiten ---
  const searchInput = document.getElementById('search-input') || document.querySelector('.search-bar__input');
  const searchBtn = document.querySelector('.search-bar button') || document.getElementById('search-button');

  if (searchInput) {
    const handleGlobalSearch = (e) => {
      e?.preventDefault();
      const term = searchInput.value.trim();

      // Prüfen, ob wir bereits auf index.html / der Startseite sind
      const isHome = window.location.pathname.endsWith('index.html') || 
                     window.location.pathname === '/' || 
                     window.location.pathname.endsWith('/');

      if (!isHome) {
        // Von jeder anderen Seite: Weiterleiten auf index.html mit Query-Parameter
        if (term) {
          window.location.href = `index.html?search=${encodeURIComponent(term)}`;
        } else {
          window.location.href = 'index.html';
        }
      }
      // Wenn wir auf index.html sind, übernimmt das ohnehin der Input-Listener aus home.js
    };

    // Bei Enter-Taste im Suchfeld
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const isHome = window.location.pathname.endsWith('index.html') || 
                       window.location.pathname === '/' || 
                       window.location.pathname.endsWith('/');
        if (!isHome) {
          handleGlobalSearch(e);
        }
      }
    });

    // Bei Klick auf den Such-Button (Lupe / Suchen)
    if (searchBtn) {
      searchBtn.addEventListener('click', (e) => {
        const isHome = window.location.pathname.endsWith('index.html') || 
                       window.location.pathname === '/' || 
                       window.location.pathname.endsWith('/');
        if (!isHome) {
          handleGlobalSearch(e);
        }
      });
    }
  }
}

export async function updateCartBadge() {
  const token = localStorage.getItem('token') || localStorage.getItem('tixify_token');
  const badge = document.getElementById('cart-badge');
  if (!token || !badge) return;

  try {
    const cart = await apiRequest('/cart');
    const totalCount = (cart.items || []).reduce((sum, item) => sum + item.quantity, 0);
    badge.textContent = totalCount;
    badge.style.display = totalCount > 0 ? 'inline-flex' : 'none';
  } catch (e) {
    badge.style.display = 'none';
  }
}