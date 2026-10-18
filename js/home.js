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
