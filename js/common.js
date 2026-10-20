const u = (x) => 'data:image/svg+xml,' + encodeURIComponent(x);

export function art(c, s = 0) {
  if (c === 'qr') {
    let r = '';
    for (let i = 0; i < 169; i++) {
      if ((i * 7 + (i % 13) * 5 + (i >> 2)) % 3 === 0) {
        r += `<rect x="${(i % 13) * 10}" y="${((i / 13) | 0) * 10}" width="10" height="10"/>`;
      }
    }
    return u(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 130"><rect width="130" height="130" fill="#fff"/><g fill="#111">${r}</g></svg>`);
  }

  if (c === 'map') {
    return u(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200"><rect width="600" height="200" fill="#ECE7DA"/><path d="M0 150Q200 110 330 160T600 120" stroke="#B9D2EA" stroke-width="26" fill="none"/><g stroke="#fff" stroke-width="9" fill="none"><path d="M0 60H600M120 0V200M360 0L420 200M0 120L600 40"/></g><g fill="#D5E3C8"><rect x="140" y="70" width="90" height="40"/><rect x="450" y="90" width="100" height="60"/></g><path d="M300 70a16 16 0 1 1 .1 0L300 100z" fill="#3B3FA8"/><circle cx="300" cy="54" r="6" fill="#fff"/></svg>`);
  }

  const palettes = {
    Konzerte: ['#120a3a', '#5b3fd0', '#b99cff'],
    Sport: ['#0c2a4d', '#2f6fb5', '#9fd0ff'],
    Theater: ['#2a0a2e', '#8a2f6d', '#f0b7a4'],
    Comedy: ['#0f0f2e', '#3b3fa8', '#ffd9a0'],
    Festivals: ['#3a1a5e', '#d9667a', '#ffc27a'],
  };

  const P = palettes[c] || ['#120a3a', '#5b3fd0', '#b99cff'];

  let b = '';
  for (let i = 0; i < 5; i++) {
    const x = 60 + i * 120 + ((s * 53) % 40);
    b += `<polygon points="${x},0 ${x - 70 + i * 10},400 ${x + 90 - i * 10},400" fill="${P[2]}" opacity=".13"/>`;
  }

  let cr = '';
  for (let i = 0; i < 34; i++) {
    const x = i * 18 + ((i * s * 7) % 9);
    const h = 24 + ((i * 29 + s * 11) % 26);
    cr += `<circle cx="${x}" cy="${372 - h / 2}" r="9"/><rect x="${x - 10}" y="${379 - h / 2}" width="20" height="${h + 30}" rx="9"/>`;
  }

  return u(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P[0]}"/><stop offset="1" stop-color="${P[1]}"/></linearGradient></defs><rect width="600" height="400" fill="url(#g)"/>${b}<g fill="#0a0620" opacity=".92">${cr}</g></svg>`);
}

export function paint() {
  document.querySelectorAll('.media-placeholder').forEach((el) => {
    const category = el.dataset.art || (el.classList.contains('hero-banner') ? 'Festivals' : 'Konzerte');
    if (el.classList.contains('hero-banner')) {
  el.style.backgroundImage =
    'url("https://cdn.pixabay.com/photo/2016/10/29/09/50/abstract-1780253_1280.png")';
} else {
  el.style.backgroundImage = `url("${art(category, +el.dataset.seed || 0)}")`;
}
  });
}

document.addEventListener('DOMContentLoaded', paint);

export function setupHeaderSearch() {
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-button') || document.querySelector('.search-bar button');

  function executeSearch() {
    const query = (searchInput?.value || '').trim();
    const isHomePage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/');

    if (isHomePage) {
      const url = new URL(window.location);
      if (query) {
        url.searchParams.set('search', query);
      } else {
        url.searchParams.delete('search');
      }
      window.history.replaceState({}, '', url);

      document.getElementById('events-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.location.href = `index.html?search=${encodeURIComponent(query)}`;
    }
  }

  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeSearch();
      }
    });
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      executeSearch();
    });
  }
}

export function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  
  const icon = type === 'success' ? '✓' : '✕';
  toast.innerHTML = `<span style="font-size: 14px;">${icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('toast--visible');
  });

  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}