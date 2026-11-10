/* ------------------------------------------------------------------ *
 * Comment section for the Connect 4 page.
 *
 * Sign-in uses Google Identity Services to obtain an ID token, which the
 * Cloudflare Worker in ./api verifies with Google's public keys. The Worker
 * returns its own session token; we keep that in localStorage and send it as
 * `Authorization: Bearer ...`. (Cookies are off the table: the API is on
 * workers.dev and the page is on github.io, so any cookie would be a
 * third-party cookie that Safari and Firefox block.)
 *
 * >>> EDIT THE TWO CONSTANTS BELOW <<<
 * ------------------------------------------------------------------ */
(() => {
  "use strict";

  const API_BASE = "https://connect4-comments.davidbai20100918.workers.dev";
  const GOOGLE_CLIENT_ID =
    "936884831568-1gg6772dcb4rcnet3vbkn83els9qhntr.apps.googleusercontent.com";

  const STORAGE_KEY = "connect4.comments.session";
  const GSI_SRC = "https://accounts.google.com/gsi/client";

  const root = document.getElementById("comments");
  if (!root) return;

  const authBox = root.querySelector("[data-auth]");
  const form = root.querySelector("[data-form]");
  const input = root.querySelector("[data-input]");
  const listEl = root.querySelector("[data-list]");
  const statusEl = root.querySelector("[data-status]");
  const countEl = root.querySelector("[data-count]");
  const submitBtn = form.querySelector("button[type='submit']");

  let session = readSession();
  let posting = false;
  let googleReady = false;

  /* ---------------- session plumbing ---------------- */

  function readSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      if (!saved || typeof saved.token !== "string") return null;
      const payload = decodeJwtPayload(saved.token);
      if (!payload || !payload.exp || payload.exp * 1000 < Date.now()) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return saved;
    } catch {
      return null;
    }
  }

  function writeSession(next) {
    session = next;
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  }

  function decodeJwtPayload(token) {
    try {
      const part = token.split(".")[1];
      const padded = part + "=".repeat((4 - (part.length % 4)) % 4);
      return JSON.parse(
        atob(padded.replace(/-/g, "+").replace(/_/g, "/"))
      );
    } catch {
      return null;
    }
  }

  /* ---------------- rendering ---------------- */

  function renderAuth() {
    authBox.replaceChildren();

    if (session) {
      const chip = document.createElement("div");
      chip.className = "comments-user";
      chip.appendChild(avatar(session.name, session.picture, "avatar"));

      const name = document.createElement("span");
      name.className = "who-name";
      name.textContent = session.name || "Player";
      chip.appendChild(name);

      const out = document.createElement("button");
      out.type = "button";
      out.className = "comments-signout";
      out.textContent = "Sign out";
      out.addEventListener("click", signOut);
      chip.appendChild(out);

      authBox.appendChild(chip);
      form.hidden = false;
      return;
    }

    form.hidden = true;
    const mount = document.createElement("div");
    authBox.appendChild(mount);
    mountGoogleButton(mount);
  }

  function avatar(name, picture, extraClass) {
    if (picture) {
      const img = document.createElement("img");
      img.className = `${extraClass} avatar`.trim();
      img.src = picture;
      img.alt = "";
      img.width = 34;
      img.height = 34;
      img.referrerPolicy = "no-referrer";
      img.addEventListener("error", () => img.replaceWith(fallback(name, extraClass)));
      return img;
    }
    return fallback(name, extraClass);
  }

  function fallback(name, extraClass) {
    const span = document.createElement("span");
    span.className = `${extraClass} avatar--fallback`.trim();
    span.textContent = (String(name || "?").trim()[0] || "?").toUpperCase();
    return span;
  }

  function renderComments(rows) {
    listEl.replaceChildren();

    if (!rows.length) {
      const empty = document.createElement("li");
      empty.className = "comments-empty";
      empty.textContent = "No comments yet. Be the first to say something nice.";
      listEl.appendChild(empty);
      if (countEl) countEl.textContent = "";
      return;
    }

    if (countEl) {
      countEl.textContent = `${rows.length} comment${rows.length === 1 ? "" : "s"}`;
    }

    for (const row of rows) {
      const item = document.createElement("li");
      item.className = "comment";

      item.appendChild(avatar(row.name, row.picture, "avatar"));

      const body = document.createElement("div");
      const meta = document.createElement("div");
      meta.className = "comment-meta";

      const who = document.createElement("strong");
      who.textContent = row.name || "Player";
      meta.appendChild(who);

      const when = document.createElement("time");
      when.dateTime = toIso(row.created_at);
      when.textContent = formatDate(row.created_at);
      meta.appendChild(when);

      if (row.mine) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "comment-delete";
        remove.textContent = "Delete";
        remove.addEventListener("click", () => removeComment(row.id, remove));
        meta.appendChild(remove);
      }

      const text = document.createElement("p");
      text.className = "comment-body";
      text.textContent = row.body;

      body.appendChild(meta);
      body.appendChild(text);
      item.appendChild(body);
      listEl.appendChild(item);
    }
  }

  function setStatus(message, isError = false) {
    statusEl.textContent = message || "";
    statusEl.classList.toggle("comments-status--error", Boolean(isError));
  }

  /* ---------------- dates ---------------- */

  function toIso(value) {
    // SQLite datetime('now') yields "YYYY-MM-DD HH:MM:SS" in UTC.
    if (!value) return "";
    return value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  }

  function formatDate(value) {
    const date = new Date(toIso(value));
    if (Number.isNaN(date.getTime())) return "";
    const diff = Date.now() - date.getTime();
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  /* ---------------- google sign-in ---------------- */

  function loadGoogleScript() {
    if (window.google?.accounts?.id) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Failed to load Google sign-in"));
      document.head.appendChild(script);
    });
  }

  async function mountGoogleButton(mount) {
    if (API_BASE.includes("YOUR-SUBDOMAIN") || GOOGLE_CLIENT_ID.includes("YOUR_CLIENT_ID")) {
      setStatus(
        "Comments are not configured yet — paste your Worker URL and Google client ID into comment-section.js.",
        true
      );
      return;
    }

    try {
      await loadGoogleScript();
    } catch {
      setStatus("Could not load Google sign-in. Check your connection or an ad blocker.", true);
      return;
    }

    if (!googleReady) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      googleReady = true;
    }

    if (mount.isConnected) {
      window.google.accounts.id.renderButton(mount, {
        type: "standard",
        theme: "filled_black",
        size: "large",
        shape: "pill",
        text: "signin_with",
        logo_alignment: "left",
      });
    }
  }

  async function handleCredential({ credential }) {
    if (!credential) return;
    setStatus("Signing in…");

    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(data.error || "Sign-in failed. Please try again.", true);
        return;
      }

      writeSession({
        token: data.token,
        name: data.user?.name || "Player",
        picture: data.user?.picture || null,
      });
      setStatus("");
      renderAuth();
      input.focus();
    } catch {
      setStatus("Could not reach the comment server.", true);
    }
  }

  function signOut() {
    writeSession(null);
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
    setStatus("");
    renderAuth();
  }

  /* ---------------- comments ---------------- */

  async function loadComments() {
    try {
      const headers = session
        ? { Authorization: `Bearer ${session.token}` }
        : undefined;
      const response = await fetch(`${API_BASE}/comments`, {
        cache: "no-store",
        headers,
      });
      if (!response.ok) throw new Error(String(response.status));
      const rows = await response.json();
      renderComments(Array.isArray(rows) ? rows : []);
    } catch {
      setStatus("Could not load comments right now.", true);
    }
  }

  async function removeComment(id, button) {
    if (!session) return;
    if (!confirm("Delete this comment? This cannot be undone.")) return;

    button.disabled = true;
    try {
      const response = await fetch(`${API_BASE}/comments/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.token}` },
      });

      if (response.status === 401) {
        writeSession(null);
        renderAuth();
        setStatus("Your session expired. Please sign in again.", true);
        return;
      }
      if (!response.ok) {
        setStatus("Could not delete that comment.", true);
        button.disabled = false;
        return;
      }
      await loadComments();
    } catch {
      setStatus("Could not reach the comment server.", true);
      button.disabled = false;
    }
  }

  async function postComment(event) {
    event.preventDefault();
    if (posting || !session) return;

    const text = input.value.trim();
    if (!text) {
      setStatus("Write something first.", true);
      input.focus();
      return;
    }

    posting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "Posting…";
    setStatus("");

    try {
      const response = await fetch(`${API_BASE}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ body: text }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        // Session expired or was tampered with — force a fresh sign-in.
        writeSession(null);
        renderAuth();
        setStatus("Your session expired. Please sign in again.", true);
        return;
      }

      if (!response.ok) {
        setStatus(data.error || "Could not post that comment.", true);
        return;
      }

      input.value = "";
      await loadComments();
    } catch {
      setStatus("Could not reach the comment server.", true);
    } finally {
      posting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "Post comment";
    }
  }

  /* ---------------- boot ---------------- */

  form.addEventListener("submit", postComment);
  input.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      form.requestSubmit();
    }
  });

  renderAuth();
  loadComments();
})();
