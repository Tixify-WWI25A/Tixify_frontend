/*
 * Tixify MPA – Login und Registrierung.
 * KI-Kennzeichnung: Sperre gegen Doppelklick beim Absenden und setupNavigation
 * (mobiles Menü) wurden mit Unterstützung von Claude (Anthropic) ergänzt (KI-Log Nr. 17).
 */
import { apiRequest, setupNavigation } from "./api.js";
import { showToast } from "./common.js";

document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();

  const lock = (form, busy) => {
    const btn = form.querySelector("button[type=submit]");
    if (btn) btn.disabled = busy;
  };

  const registerForm = document.getElementById("register-form");

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("reg-username").value.trim();
      const email = document.getElementById("reg-email").value.trim();
      const password = document.getElementById("reg-password").value;

      lock(registerForm, true);
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

        showToast(
          res.message ||
          "Konto erfolgreich erstellt! Du kannst dich jetzt anmelden.",
          "success"
        );
        registerForm.reset();

        const loginEmail = document.getElementById("login-email");
        if (loginEmail) loginEmail.value = email;
      } catch (err) {
        console.error("Fehler bei Registrierung:", err);
        showToast(err.message || "Registrierung fehlgeschlagen.", "error");
      } finally {
        lock(registerForm, false);
      }
    });
  }

  const loginForm = document.getElementById("login-form");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password").value;

      lock(loginForm, true);
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

          showToast("Erfolgreich angemeldet!", "success");
          setTimeout(() => {
            window.location.href = "index.html";
          }, 1200);
        } else {
          showToast("Login fehlgeschlagen: Kein Token erhalten.", "error");
          lock(loginForm, false);
        }
      } catch (err) {
        console.error("Fehler beim Login:", err);
        showToast(err.message || "Anmeldung fehlgeschlagen. Bitte Daten prüfen.", "error");
        lock(loginForm, false);
      }
    });
  }
});
