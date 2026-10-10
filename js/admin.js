import { apiRequest, setupNavigation } from "./api.js";

let allEvents = [];

const modal = document.getElementById("event-modal");
const form = document.getElementById("event-form");
const modalTitle = document.getElementById("modal-title");
const idInput = document.getElementById("event-id");

async function loadEvents() {
  const tbody = document.getElementById("admin-events-tbody");
  if (!tbody) return;

  try {
    allEvents = await apiRequest("/events");

    if (!allEvents || allEvents.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align: center; padding: 20px;">Keine Events vorhanden.</td></tr>';
      return;
    }

    tbody.innerHTML = allEvents
      .map(
        (e) => `
      <tr>
        <td>#${e.event_id}</td>
        <td>
          <b>${e.title}</b><br>
          <span class="text-muted" style="font-size: 13px;">${e.location || "Ohne Ortsangabe"}</span>
        </td>
        <td>${e.category || "-"}</td>
        <td>${e.event_date ? new Date(e.event_date).toLocaleDateString("de-DE") : "-"}</td>
        <td>${parseFloat(e.price).toFixed(2).replace(".", ",")} €</td>
        <td>${e.event_stock ?? e.stock ?? 0}</td>
        <td style="text-align: right; padding-right: 18px;">
          <div class="action-buttons">
            <button class="button button--outline button--small edit-btn" data-id="${e.event_id}">
              Bearbeiten
            </button>
            <button class="button button--outline button--small button--danger delete-btn" data-id="${e.event_id}">
              Löschen
            </button>
          </div>
        </td>
      </tr>
    `,
      )
      .join("");

    // Listener für Bearbeiten
    document.querySelectorAll(".edit-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = parseInt(e.currentTarget.getAttribute("data-id"), 10);
        const eventData = allEvents.find((item) => item.event_id === id);
        if (eventData) openModalForEdit(eventData);
      });
    });

    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        if (
          confirm(
            `Möchtest du das Event #${id} wirklich unwiderruflich löschen?`,
          )
        ) {
          await deleteEvent(id);
        }
      });
    });
  } catch (err) {
    console.error("Fehler beim Abrufen der Events:", err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Fehler: ${err.message}</td></tr>`;
  }
}

function openModalForCreate() {
  form.reset();
  idInput.value = "";
  modalTitle.textContent = "Neues Event erstellen";
  modal.classList.add("is-open");
}

function openModalForEdit(event) {
  form.reset();
  idInput.value = event.event_id;
  modalTitle.textContent = `Event #${event.event_id} bearbeiten`;

  document.getElementById("event-title").value = event.title || "";
  document.getElementById("event-category").value = event.category || "";
  document.getElementById("event-location").value = event.location || "";

  if (event.event_date) {
    const d = new Date(event.event_date);
    document.getElementById("event-date").value = d.toISOString().split("T")[0];
  } else {
    document.getElementById("event-date").value = "";
  }

  document.getElementById("event-price").value = event.price || "";
  document.getElementById("event-stock").value =
    event.event_stock ?? event.stock ?? "";
  document.getElementById("event-description").value = event.description || "";

  modal.classList.add("is-open");
}

function closeModal() {
  modal.classList.remove("is-open");
}
