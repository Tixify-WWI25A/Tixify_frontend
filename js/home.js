import { apiRequest, setupNavigation } from "./api.js";
import { art } from "../js/common.js";

let allEvents = [];
let activeTopCategory = "Alle";
let maxEventPrice = 150;
let currentPage = 1;
const EVENTS_PER_PAGE = 6; // 6 Events pro Seite (2 Zeilen à 3 Karten)
let currentFilteredEvents = [];

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
      listContainer.innerHTML = `<div class="card-box">Fehler beim Laden: ${err.message}</div>`;
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
    uniqueLocations.map(loc => `<option value="${loc}">${loc}</option>`).join('');
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

function renderEvents(events) {
  const listContainer = document.getElementById("events-container");
  const countHeading = document.getElementById("event-count-heading");

  countHeading.textContent = `${events.length} ${events.length === 1 ? "Veranstaltung" : "Veranstaltungen"}`;

  if (events.length === 0) {
    listContainer.innerHTML =
      '<div class="card-box">Keine Events gefunden.</div>';
    return;
  }

  listContainer.innerHTML = events
    .map((e) => {
      const d = new Date(e.event_date);
      const day = d.getDate();
      const month = d.toLocaleString("de-DE", { month: "short" });
      const time = d.toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const priceFormatted = parseFloat(e.price).toFixed(2).replace(".", ",");

      const isSoldOut = e.event_stock === 0;
      const badgeWarning = isSoldOut
        ? '<span class="badge badge--warning">Ausverkauft</span>'
        : e.event_stock < 10
          ? `<span class="badge badge--warning">Nur noch ${e.event_stock}</span>`
          : "";

      return `
      <a href="detail.html?id=${e.event_id}" class="event-card">
        <div class="media-placeholder event-card__thumbnail" style="background-image: url('${art("Konzerte", e.event_id)}')"></div>
        <div class="event-card__date">
          <b>${day}</b><small>${month}</small>
        </div>
        <div>
          <h3>${e.title}</h3>
          <div class="text-muted">${e.location} · ${time} Uhr</div>
          <div style="margin-top: 6px;">
            <span class="badge">Event</span>
            ${badgeWarning}
          </div>
        </div>
        <div class="event-card__pricing">
          <b>ab ${priceFormatted} €</b>
          <button class="button button--small" ${isSoldOut ? 'disabled style="opacity:.4"' : ""}>Tickets</button>
        </div>
      </a>
    `;
    })
    .join("");
}

function applyFilters() {
  const search = document.getElementById("search-input").value.toLowerCase();
  const nameFilter = document
    .getElementById("filter-title")
    .value.toLowerCase();
  const maxPrice = parseFloat(document.getElementById("filter-price").value);
  const location = document.getElementById("filter-location").value;

  const filtered = allEvents.filter((e) => {
    const matchesSearch =
      e.title.toLowerCase().includes(search) ||
      e.location.toLowerCase().includes(search);
    const matchesName = e.title.toLowerCase().includes(nameFilter);
    const matchesPrice = parseFloat(e.price) <= maxPrice;
    const matchesLoc = location === "Alle Orte" || e.location === location;
    return matchesSearch && matchesName && matchesPrice && matchesLoc;
  });

  renderEvents(filtered);
}

document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  loadEvents();

  document.getElementById("filter-price").addEventListener("input", (e) => {
    document.getElementById("price-value").textContent = e.target.value;
    applyFilters();
  });
  document
    .getElementById("filter-title")
    .addEventListener("input", applyFilters);
  document
    .getElementById("search-input")
    .addEventListener("input", applyFilters);
  document
    .getElementById("filter-location")
    .addEventListener("change", applyFilters);

  document.getElementById("btn-reset-filter").addEventListener("click", () => {
    document.getElementById("filter-title").value = "";
    document.getElementById("search-input").value = "";
    document.getElementById("filter-price").value = 150;
    document.getElementById("price-value").textContent = 150;
    document.getElementById("filter-location").selectedIndex = 0;
    renderEvents(allEvents);
  });
});
