import { apiRequest } from "./api.js";

document.addEventListener("DOMContentLoaded", () => {
  const registerForm = document.getElementById("register-form");

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("reg-username").value.trim();
      const email = document.getElementById("reg-email").value.trim();
      const password = document.getElementById("reg-password").value;

      try {
        const res = await apiRequest("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            name: name,
            username: name,
            email: email,
            password: password,
          }),
        });

        alert(
          res.message ||
            "Konto erfolgreich erstellt! Du kannst dich jetzt anmelden.",
        );
        registerForm.reset();

        const loginEmail = document.getElementById("login-email");
        if (loginEmail) loginEmail.value = email;
      } catch (err) {
        console.error("Fehler bei Registrierung:", err);
        alert(err.message || "Registrierung fehlgeschlagen.");
      }
    });
  }

  const loginForm = document.getElementById("login-form");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password").value;

      try {
        const res = await apiRequest("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });

        if (res.token) {
          localStorage.setItem("tixify_token", res.token);
          localStorage.setItem("token", res.token);

          const userData = res.user || {
            email: email,
            name: email.split("@")[0],
          };
          const userString = JSON.stringify(userData);

          localStorage.setItem("tixify_user", userString);
          localStorage.setItem("user", userString);

          alert("Erfolgreich angemeldet!");
          window.location.href = "index.html";
        } else {
          alert("Login fehlgeschlagen: Kein Token erhalten.");
        }
      } catch (err) {
        console.error("Fehler beim Login:", err);
        alert(err.message || "Anmeldung fehlgeschlagen. Bitte Daten prüfen.");
      }
    });
  }
});
