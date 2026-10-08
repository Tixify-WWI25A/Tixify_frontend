const API_BASE_URL = "http://localhost:3000/api";

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem("tixify_token");

  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem("tixify_token");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Serverfehler aufgetreten");
  }

  return data;
}

export function setupNavigation() {
  const token = localStorage.getItem("tixify_token");
  const authLink = document.querySelector('.nav-menu a[href*="login.html"]');

  if (!authLink) return;

  if (token) {
    authLink.textContent = "Abmelden";
    authLink.href = "#";
    authLink.addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.removeItem("tixify_token");
      window.location.href = "index.html";
    });
  } else {
    authLink.textContent = "Anmelden";
    authLink.href = "login.html";
  }
}
