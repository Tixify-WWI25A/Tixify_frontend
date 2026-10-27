/*
 * Tixify MPA – Startseite: Eventliste, Filter, Sortierung, Seiten.
 * KI-Kennzeichnung: Das Escaping der Kartenvorlage (escapeHtml/cssUrl) und die
 * Kategorie-Leiste als Buttons (setActiveTopCategory) wurden mit
 * Unterstützung von Claude (Anthropic) ergänzt und vom Team geprüft (KI-Log Nr. 17).
 */
import { apiRequest, setupNavigation } from "./api.js";
import { art, escapeHtml, cssUrl } from "./common.js";

let allEvents = [];
let activeTopCategory = "Alle";
let maxEventPrice = 150;
let currentPage = 1;
const EVENTS_PER_PAGE = 6; // 6 Events pro Seite (2 Zeilen à 3 Karten)
let currentFilteredEvents = [];

function setActiveTopCategory(active) {
  document.querySelectorAll('.category-bar__link').forEach((l) => {
    const isActive = l === active;
    l.classList.toggle('category-bar__link--active', isActive);
    l.setAttribute('aria-pressed', String(isActive));
  });
}

async function loadEvents() {
  const listContainer = document.getElementById("events-container");

  try {
    allEvents = await apiRequest("/events");
    initPriceFilter(allEvents);
    populateLocationDropdown(allEvents);

    // URL-Suchparameter prüfen (z. B. index.html?search=Rock)
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get("search");
    if (searchQuery) {
      const searchInput = document.getElementById("search-input");
      if (searchInput) {
        searchInput.value = searchQuery;
      }
    }

    applyFilters();

    // Falls per URL gesucht wurde: Sanft zu den Events scrollen
    if (searchQuery) {
      setTimeout(() => {
        document.getElementById("events-container")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }
  } catch (err) {
    if (listContainer) {
      listContainer.innerHTML = `<div class="card-box">Fehler beim Laden: ${escapeHtml(err.message)}</div>`;
    }
  }
}

/**
 * Ermittelt den Höchstpreis aller Events und skaliert den Slider dynamisch
 */
function initPriceFilter(events) {
  if (!events || events.length === 0) return;

  const prices = events.map(e => parseFloat(e.price)).filter(p => !isNaN(p));
  if (prices.length === 0) return;

  // Höchstpreis auf volle 10er-Stelle aufrunden (z. B. 199.99 € -> 200 €)
  maxEventPrice = Math.ceil(Math.max(...prices) / 10) * 10;

  const priceSlider = document.getElementById('filter-price');
  const priceValue = document.getElementById('price-value');

  if (priceSlider) {
    priceSlider.max = maxEventPrice;
    priceSlider.value = maxEventPrice;
  }
  if (priceValue) {
    priceValue.textContent = maxEventPrice;
  }
}

/**
 * Füllt das Dropdown dynamisch mit den tatsächlich in der Datenbank vorkommenden Orten
 */
function populateLocationDropdown(events) {
  const locSelect = document.getElementById('filter-location');
  if (!locSelect) return;

  const uniqueLocations = [...new Set(events.map(e => e.location).filter(Boolean))].sort();

  locSelect.innerHTML = '<option value="Alle Orte">Alle Orte</option>' +
    uniqueLocations.map(loc => `<option value="${escapeHtml(loc)}">${escapeHtml(loc)}</option>`).join('');
}

/**
 * Filtert und sortiert alle Events und stößt das Rendering der Paginierung an
 */
function applyFilters() {
  const searchInput = document.getElementById('search-input');
  const search = (searchInput?.value || '').trim().toLowerCase();

  const nameInput = document.getElementById('filter-title');
  const nameFilter = (nameInput?.value || '').trim().toLowerCase();

  const priceInput = document.getElementById('filter-price');
  const maxPrice = priceInput ? parseFloat(priceInput.value) : Infinity;

  const locSelect = document.getElementById('filter-location');
  const location = locSelect ? locSelect.value : 'Alle Orte';

  const filterDateInput = document.getElementById('filter-date');
  const filterDateVal = filterDateInput ? filterDateInput.value : '';

  const sortSelect = document.getElementById('sort-select');
  const sortOption = sortSelect ? sortSelect.value : 'date-asc';

  // Ausgewählte Checkbox- bzw. Chip-Kategorien
  const selectedCheckboxes = Array.from(
    document.querySelectorAll('.form-field input[type="checkbox"]:checked, .category-filter-group input[type="checkbox"]:checked')
  ).map(cb => cb.value.toLowerCase());

  let filtered = allEvents.filter(e => {
    const title = (e.title || '').toLowerCase();
    const loc = (e.location || '').toLowerCase();
    const cat = (e.category || 'Event').toLowerCase();

    // 1. Suche über Suchfeld (Titel, Ort, Kategorie)
    const matchesSearch = !search || title.includes(search) || loc.includes(search) || cat.includes(search);

    // 2. Namensfilter aus der Sidebar
    const matchesName = !nameFilter || title.includes(nameFilter);

    // 3. Preis-Filter
    const matchesPrice = parseFloat(e.price) <= maxPrice;

    // 4. Ort-Filter
    const matchesLoc = location === 'Alle Orte' || e.location === location;

    // 5. Datumsfilter (ab gewähltem Datum)
    let matchesDate = true;
    if (filterDateVal) {
      const selectedDate = new Date(filterDateVal);
      selectedDate.setHours(0, 0, 0, 0);
      matchesDate = new Date(e.event_date) >= selectedDate;
    }

    // 6. Kategorie-Filter (obere Leiste)
    const matchesTopCategory = (activeTopCategory === 'Alle') || (cat === activeTopCategory.toLowerCase());

    // 7. Kategorie-Filter (Sidebar-Auswahl)
    const matchesCheckboxCategory = selectedCheckboxes.length === 0 || selectedCheckboxes.includes(cat);

    return matchesSearch && matchesName && matchesPrice && matchesLoc && matchesDate && matchesTopCategory && matchesCheckboxCategory;
  });

  // 8. Sortierung anwenden
  filtered.sort((a, b) => {
    if (sortOption === 'price-asc') return parseFloat(a.price) - parseFloat(b.price);
    if (sortOption === 'price-desc') return parseFloat(b.price) - parseFloat(a.price);
    if (sortOption === 'date-desc') return new Date(b.event_date) - new Date(a.event_date);
    return new Date(a.event_date) - new Date(b.event_date); // Standard: date-asc
  });

  currentFilteredEvents = filtered;
  currentPage = 1; // Bei jeder Filteränderung zurück auf Seite 1
  renderPaginatedEvents();
}

/**
 * Berechnet den aktuellen Ausschnitt und rendert Cards sowie Buttons
 */
function renderPaginatedEvents() {
  const countHeading = document.getElementById('event-count-heading');
  if (countHeading) {
    countHeading.textContent = `${currentFilteredEvents.length} ${currentFilteredEvents.length === 1 ? 'Veranstaltung' : 'Veranstaltungen'}`;
  }

  const totalPages = Math.ceil(currentFilteredEvents.length / EVENTS_PER_PAGE) || 1;
  if (currentPage > totalPages) currentPage = totalPages;

  const startIndex = (currentPage - 1) * EVENTS_PER_PAGE;
  const pageEvents = currentFilteredEvents.slice(startIndex, startIndex + EVENTS_PER_PAGE);

  renderEventsList(pageEvents);
  renderPaginationControls(totalPages);
}

/**
 * Erzeugt die HTML-Karten für die übergebenen Events
 */
function renderEventsList(events) {
  const listContainer = document.getElementById('events-container');
  if (!listContainer) return;

  if (events.length === 0) {
    listContainer.innerHTML = '<div class="card-box" style="grid-column: 1 / -1; padding: 24px; text-align: center;">Keine Events gefunden, die deinen Filterkriterien entsprechen.</div>';
    return;
  }

  listContainer.innerHTML = events.map(e => {
    const d = new Date(e.event_date);
    const day = d.getDate();
    const month = d.toLocaleString('de-DE', { month: 'short' });
    const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const priceFormatted = parseFloat(e.price).toFixed(2).replace('.', ',');

    const isSoldOut = e.event_stock === 0;
    const badgeWarning = isSoldOut
      ? '<span class="badge badge--warning">Ausverkauft</span>'
      : (e.event_stock < 10 ? `<span class="badge badge--warning">Nur noch ${escapeHtml(e.event_stock)}</span>` : '');

    const eventCategory = e.category || 'Event';
    const categoryClass = 'badge--' + String(eventCategory).toLowerCase().trim().replace(/[^a-z0-9äöüß-]/g, '');

    // Eigene logo_url bevorzugen, sonst Fallback auf das generierte SVG art()
    const fallbackArt = art(eventCategory, e.event_id);
    const imageStyle = cssUrl(e.logo_url, fallbackArt);

    return `
      <a href="detail.html?id=${encodeURIComponent(e.event_id)}" class="event-card">
        <div class="media-placeholder event-card__thumbnail" style="background-image: ${escapeHtml(imageStyle)}; background-size: cover; background-position: center;" role="img" aria-label="Eventbild"></div>
        <div class="event-card__date">
          <b>${day}</b><small>${month}</small>
        </div>
        <div>
          <h3>${escapeHtml(e.title)}</h3>
          <div class="text-muted">${escapeHtml(e.location || 'Ohne Ortsangabe')} · ${time} Uhr</div>
          <div style="margin-top: 6px;">
            <span class="badge ${categoryClass}">${escapeHtml(eventCategory)}</span>
            ${badgeWarning}
          </div>
        </div>
        <div class="event-card__pricing">
          <b>ab ${priceFormatted} €</b>
          <span class="button button--small${isSoldOut ? ' is-disabled' : ''}" aria-hidden="true">${isSoldOut ? 'Ausverkauft' : 'Tickets'}</span>
        </div>
      </a>
    `;
  }).join('');
}

/**
 * Baut die Paginierungs-Buttons
 */
function renderPaginationControls(totalPages) {
  const container = document.getElementById('pagination-container');
  if (!container) return;

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = `<button class="page-btn" id="prev-page-btn" ${currentPage === 1 ? 'disabled' : ''}>&larr;</button>`;

  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn ${i === currentPage ? 'is-active' : ''}" data-page="${i}">${i}</button>`;
  }

  html += `<button class="page-btn" id="next-page-btn" ${currentPage === totalPages ? 'disabled' : ''}>&rarr;</button>`;
  container.innerHTML = html;

  // Event Listener für Seiten-Klicks
  container.querySelectorAll('.page-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      currentPage = parseInt(e.target.dataset.page, 10);
      renderPaginatedEvents();
      document.getElementById('events-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  document.getElementById('prev-page-btn')?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderPaginatedEvents();
      document.getElementById('events-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  document.getElementById('next-page-btn')?.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      renderPaginatedEvents();
      document.getElementById('events-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  loadEvents();

  // Slider & Display
  const priceSlider = document.getElementById('filter-price');
  if (priceSlider) {
    priceSlider.addEventListener('input', (e) => {
      const priceVal = document.getElementById('price-value');
      if (priceVal) priceVal.textContent = e.target.value;
      applyFilters();
    });
  }

  // Filter-Inputs & Selects
  document.getElementById('filter-title')?.addEventListener('input', applyFilters);
  document.getElementById('filter-location')?.addEventListener('change', applyFilters);
  document.getElementById('filter-date')?.addEventListener('change', applyFilters);
  document.getElementById('sort-select')?.addEventListener('change', applyFilters);

  // Suche
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyFilters();
      }
    });
  }

  const searchBtn = document.querySelector('.search-bar button') || document.getElementById('search-button');
  if (searchBtn) {
    searchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      applyFilters();
    });
  }

  // Kategorie-Chips in der Sidebar
  document.querySelectorAll('.form-field input[type="checkbox"], .category-filter-group input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', applyFilters);
  });

  // Obere Kategorie-Leiste
  document.querySelectorAll('.category-bar__link').forEach(link => {
    link.addEventListener('click', () => {
      setActiveTopCategory(link);
      activeTopCategory = link.textContent.trim();
      applyFilters();
    });
  });

  // Reset Button
  document.getElementById('btn-reset-filter')?.addEventListener('click', () => {
    const titleIn = document.getElementById('filter-title');
    if (titleIn) titleIn.value = '';

    const searchIn = document.getElementById('search-input');
    if (searchIn) searchIn.value = '';

    const dateIn = document.getElementById('filter-date');
    if (dateIn) dateIn.value = '';

    // Slider auf dynamischen Maximalwert zurücksetzen
    if (priceSlider) priceSlider.value = maxEventPrice;
    const priceVal = document.getElementById('price-value');
    if (priceVal) priceVal.textContent = maxEventPrice;

    const locSelect = document.getElementById('filter-location');
    if (locSelect) locSelect.selectedIndex = 0;

    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) sortSelect.selectedIndex = 0;

    // Checkboxen abwählen
    document.querySelectorAll('.form-field input[type="checkbox"], .category-filter-group input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
    });

    // Top-Leiste auf 'Alle'
    setActiveTopCategory(document.querySelector('.category-bar__link'));
    activeTopCategory = 'Alle';

    applyFilters();
  });
});
