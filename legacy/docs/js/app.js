(function () {
  const ORDINALS = ["1st", "2nd", "3rd"];

  let entries = [];
  let currentEmail = "";
  let codesUnlocked = false;
  let hasPin = false;
  let pinMode = "setup";
  let pinBuffer = "";
  let pendingPin = "";

  const screens = {
    loading: document.getElementById("screen-loading"),
    login: document.getElementById("screen-login"),
    register: document.getElementById("screen-register"),
    app: document.getElementById("screen-app"),
  };

  const tabPanels = {
    codes: document.getElementById("tab-codes"),
    add: document.getElementById("tab-add"),
  };

  function ordinal(n) {
    if (n <= 3) return ORDINALS[n - 1];
    return n + "th";
  }

  function showScreen(name) {
    Object.values(screens).forEach((el) => el?.classList.add("hidden"));
    screens[name]?.classList.remove("hidden");
  }

  function switchTab(tabName) {
    if (!codesUnlocked && tabName === "add") return;
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      const active = btn.dataset.tab === tabName;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    Object.entries(tabPanels).forEach(([key, panel]) => {
      panel?.classList.toggle("active", key === tabName);
    });
  }

  function showToast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => t.classList.remove("show"), 2500);
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function formatEntryForShare(entry) {
    const lines = [entry.name, ""];
    entry.codes.forEach((code, i) => {
      lines.push(`${ordinal(i + 1)} code: ${code}`);
    });
    if (entry.notes) lines.push("", `Notes: ${entry.notes}`);
    return lines.join("\n");
  }

  async function shareEntry(entry) {
    const text = formatEntryForShare(entry);
    if (navigator.share) {
      try {
        await navigator.share({ title: entry.name, text });
        showToast("Shared");
        return;
      } catch (err) {
        if (err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied for sharing");
    } catch {
      showToast("Share not available");
    }
  }

  async function loadEntries() {
    entries = await CloudApi.listEntries();
    renderList();
  }

  async function enterApp(email, pinKnown) {
    currentEmail = email;
    document.getElementById("user-email").textContent = email;
    showScreen("app");
    switchTab("codes");
    resetForm();
    try {
      await loadEntries();
    } catch (err) {
      showToast(err.message || "Could not load codes");
    }
    if (pinKnown === undefined) {
      try {
        const me = await CloudApi.me();
        hasPin = !!me.has_pin;
      } catch {
        hasPin = false;
      }
    } else {
      hasPin = !!pinKnown;
    }
    lockCodes();
  }

  function prefillLoginEmail() {
    const last = CloudApi.getLastEmail();
    const loginEmail = document.getElementById("login-email");
    if (loginEmail && last && !loginEmail.value) {
      loginEmail.value = last;
    }
  }

  async function tryAutoLogin() {
    if (!CloudApi.getToken()) return false;
    try {
      const user = await CloudApi.me();
      await enterApp(user.email, user.has_pin);
      return true;
    } catch {
      CloudApi.clearSession();
      return false;
    }
  }

  const codesContainer = document.getElementById("codes-container");
  const entryForm = document.getElementById("entry-form");
  const entryIdInput = document.getElementById("entry-id");
  const nameInput = document.getElementById("entry-name");
  const notesInput = document.getElementById("entry-notes");
  const formTitle = document.getElementById("form-title");
  const btnCancel = document.getElementById("btn-cancel");
  const entriesList = document.getElementById("entries-list");
  const entryCount = document.getElementById("entry-count");
  const searchInput = document.getElementById("search");

  function createCodeRow(value = "", index = null) {
    const row = document.createElement("div");
    row.className = "code-row";
    const idx = index ?? codesContainer.children.length + 1;
    row.innerHTML = `
      <span class="code-row-label">${ordinal(idx)}</span>
      <input type="text" class="code-input" inputmode="text" value="${escapeAttr(value)}" placeholder="Code" autocomplete="off">
      <button type="button" class="btn-remove-code" aria-label="Remove">×</button>
    `;
    row.querySelector(".btn-remove-code").addEventListener("click", () => {
      if (codesContainer.children.length > 1) {
        row.remove();
        renumberRows();
      }
    });
    return row;
  }

  function renumberRows() {
    [...codesContainer.children].forEach((row, i) => {
      row.querySelector(".code-row-label").textContent = ordinal(i + 1);
    });
    const disable = codesContainer.children.length <= 1;
    [...codesContainer.querySelectorAll(".btn-remove-code")].forEach((b) => {
      b.disabled = disable;
    });
  }

  function resetForm() {
    entryIdInput.value = "";
    nameInput.value = "";
    notesInput.value = "";
    codesContainer.innerHTML = "";
    codesContainer.appendChild(createCodeRow());
    renumberRows();
    formTitle.textContent = "Add a code";
    btnCancel.classList.add("hidden");
  }

  function fillForm(entry) {
    entryIdInput.value = entry.id;
    nameInput.value = entry.name;
    notesInput.value = entry.notes || "";
    codesContainer.innerHTML = "";
    (entry.codes.length ? entry.codes : [""]).forEach((c, i) =>
      codesContainer.appendChild(createCodeRow(c, i + 1))
    );
    renumberRows();
    formTitle.textContent = "Edit entry";
    btnCancel.classList.remove("hidden");
    switchTab("add");
    nameInput.focus();
  }

  function getCodesFromForm() {
    return [...codesContainer.querySelectorAll(".code-input")]
      .map((i) => i.value.trim())
      .filter(Boolean);
  }

  function renderList() {
    const sorted = [...entries].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
    entriesList.innerHTML = "";
    if (!sorted.length) {
      entriesList.innerHTML = `
        <div class="empty-state">
          <svg class="empty-mark" viewBox="0 0 512 512" aria-hidden="true"><use href="#logo-mark"></use></svg>
          <span class="empty-title">No codes yet</span>
          Add a gate or port name to get started.
        </div>`;
      entryCount.textContent = "0";
      return;
    }
    sorted.forEach((entry) => {
      const card = document.createElement("article");
      card.className = "entry-card";
      card.dataset.id = entry.id;
      card.dataset.name = entry.name.toLowerCase();
      const codesHtml = entry.codes
        .map(
          (code, i) => `
        <li>
          <span class="code-label">${ordinal(i + 1)}</span>
          <code class="code-value">${escapeHtml(code)}</code>
          <button type="button" class="btn-copy" data-copy="${escapeAttr(code)}">Copy</button>
        </li>`
        )
        .join("");
      card.innerHTML = `
        <div class="entry-header">
          <h3 class="entry-name">${escapeHtml(entry.name)}</h3>
        </div>
        <ol class="code-list">${codesHtml}</ol>
        ${entry.notes ? `<p class="entry-notes">${escapeHtml(entry.notes)}</p>` : ""}
        <div class="entry-footer">
          <button type="button" class="btn btn-secondary btn-sm btn-edit">Edit</button>
          <button type="button" class="btn btn-secondary btn-sm btn-share">Share</button>
          <button type="button" class="btn btn-ghost btn-sm btn-delete">Delete</button>
        </div>
      `;
      card.querySelector(".btn-edit").addEventListener("click", () => {
        if (!codesUnlocked) return showToast("Enter PIN to reveal codes");
        fillForm(entry);
      });
      card.querySelector(".btn-share").addEventListener("click", () => {
        if (!codesUnlocked) return showToast("Enter PIN to reveal codes");
        shareEntry(entry);
      });
      card.querySelector(".btn-delete").addEventListener("click", async () => {
        if (!confirm("Delete this entry?")) return;
        try {
          await CloudApi.deleteEntry(entry.id);
          entries = entries.filter((e) => e.id !== entry.id);
          renderList();
          showToast("Deleted");
        } catch (err) {
          showToast(err.message);
        }
      });
      card.querySelectorAll(".btn-copy").forEach((btn) => {
        btn.addEventListener("click", async () => {
          if (!codesUnlocked) return showToast("Enter PIN to reveal codes");
          try {
            await navigator.clipboard.writeText(btn.dataset.copy);
            showToast("Copied");
          } catch {
            showToast("Copy failed");
          }
        });
      });
      entriesList.appendChild(card);
    });
    applySearch();
  }

  function applySearch() {
    const q = (searchInput?.value || "").trim().toLowerCase();
    let visible = 0;
    entriesList.querySelectorAll(".entry-card").forEach((card) => {
      const show = !q || card.dataset.name.includes(q);
      card.classList.toggle("hidden-by-search", !show);
      if (show) visible++;
    });
    const total = entries.length;
    entryCount.textContent = q && total ? `${visible}/${total}` : String(total);
  }

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
      if (tab === "add" && !entryIdInput.value) resetForm();
    });
  });

  document.getElementById("btn-go-register")?.addEventListener("click", () => {
    showScreen("register");
  });

  document.getElementById("btn-go-login")?.addEventListener("click", () => {
    showScreen("login");
  });

  document.getElementById("login-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    if (!email || !password) return showToast("Enter email and password");
    btn.disabled = true;
    try {
      CloudApi.clearSession();
      const data = await CloudApi.login(email, password);
      CloudApi.setSession(data.token, data.email);
      await enterApp(data.email, data.has_pin);
      showToast("Signed in");
    } catch (err) {
      showToast(err.message || "Login failed");
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById("register-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value;
    const confirm = document.getElementById("register-confirm").value;
    if (password.length < 6) return showToast("Password: min 6 characters");
    if (password !== confirm) return showToast("Passwords do not match");
    btn.disabled = true;
    try {
      CloudApi.clearSession();
      const data = await CloudApi.register(email, password);
      CloudApi.setSession(data.token, data.email);
      await enterApp(data.email, data.has_pin);
      showToast("Account created");
    } catch (err) {
      if (err.message === "Email already registered.") {
        showToast("Account exists — use Sign in");
        document.getElementById("login-email").value = email;
        showScreen("login");
      } else {
        showToast(err.message || "Registration failed");
      }
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById("btn-add-code")?.addEventListener("click", () => {
    codesContainer.appendChild(createCodeRow());
    renumberRows();
    codesContainer.lastElementChild.querySelector("input").focus();
  });

  btnCancel?.addEventListener("click", () => {
    resetForm();
    switchTab("codes");
  });

  entryForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const codes = getCodesFromForm();
    const notes = notesInput.value.trim();
    if (!name) return showToast("Name is required");

    const id = entryIdInput.value ? Number(entryIdInput.value) : null;
    const payload = { name, codes, notes };

    try {
      if (id) {
        const updated = await CloudApi.updateEntry(id, payload);
        const idx = entries.findIndex((x) => x.id === id);
        if (idx >= 0) entries[idx] = updated;
        showToast("Updated in cloud");
      } else {
        const created = await CloudApi.createEntry(payload);
        entries.push(created);
        showToast("Saved to cloud");
      }
      resetForm();
      renderList();
      switchTab("codes");
    } catch (err) {
      showToast(err.message || "Save failed");
    }
  });

  searchInput?.addEventListener("input", applySearch);

  document.getElementById("btn-logout")?.addEventListener("click", () => {
    const email = currentEmail || CloudApi.getLastEmail();
    CloudApi.clearSession();
    entries = [];
    currentEmail = "";
    codesUnlocked = false;
    hasPin = false;
    pinBuffer = "";
    pendingPin = "";
    document.getElementById("screen-app")?.classList.remove("codes-locked");
    document.getElementById("pin-overlay")?.classList.add("hidden");
    document.getElementById("login-password").value = "";
    if (email) document.getElementById("login-email").value = email;
    showScreen("login");
    showToast("Signed out");
  });

  const pwdDialog = document.getElementById("password-dialog");
  document.getElementById("btn-settings")?.addEventListener("click", () => {
    document.getElementById("password-form").reset();
    document.getElementById("password-error").classList.add("hidden");
    pwdDialog.showModal();
  });
  document.getElementById("btn-close-dialog")?.addEventListener("click", () =>
    pwdDialog.close()
  );

  document.getElementById("password-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = document.getElementById("password-error");
    const current = document.getElementById("current-password").value;
    const newP = document.getElementById("new-password").value;
    const confirm = document.getElementById("confirm-password").value;

    try {
      await CloudApi.changePassword(current, newP, confirm);
      pwdDialog.close();
      showToast("Password changed");
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove("hidden");
    }
  });

  function updatePinDots() {
    document.querySelectorAll("#pin-dots span").forEach((dot, i) => {
      dot.classList.toggle("filled", i < pinBuffer.length);
    });
  }

  function setPinError(msg) {
    const el = document.getElementById("pin-error");
    const card = document.querySelector(".pin-card");
    if (!el) return;
    if (!msg) {
      el.classList.add("hidden");
      el.textContent = "";
      return;
    }
    el.textContent = msg;
    el.classList.remove("hidden");
    card?.classList.add("shake");
    setTimeout(() => card?.classList.remove("shake"), 400);
  }

  function showPinUi(mode) {
    pinMode = mode;
    pinBuffer = "";
    updatePinDots();
    setPinError("");
    const title = document.getElementById("pin-title");
    const hint = document.getElementById("pin-hint");
    const forgot = document.getElementById("btn-forgot-pin");
    const resetWrap = document.getElementById("pin-reset-wrap");
    resetWrap?.classList.add("hidden");
    if (mode === "setup") {
      if (title) title.textContent = "Create a PIN";
      if (hint) hint.textContent = "Choose 4 digits to reveal your codes.";
      forgot?.classList.add("hidden");
    } else if (mode === "confirm") {
      if (title) title.textContent = "Confirm PIN";
      if (hint) hint.textContent = "Enter the same 4 digits again.";
      forgot?.classList.add("hidden");
    } else if (mode === "unlock") {
      if (title) title.textContent = "Enter PIN";
      if (hint) hint.textContent = "Enter your PIN to reveal codes.";
      forgot?.classList.remove("hidden");
    } else if (mode === "reset-setup") {
      if (title) title.textContent = "New PIN";
      if (hint) hint.textContent = "Enter your account password, then a new 4-digit PIN.";
      forgot?.classList.add("hidden");
      resetWrap?.classList.remove("hidden");
    } else if (mode === "reset-confirm") {
      if (title) title.textContent = "Confirm new PIN";
      if (hint) hint.textContent = "Enter the new PIN again.";
      resetWrap?.classList.remove("hidden");
    }
  }

  function setLocked(locked) {
    codesUnlocked = !locked;
    document.getElementById("screen-app")?.classList.toggle("codes-locked", locked);
    document.getElementById("pin-overlay")?.classList.toggle("hidden", !locked);
    document.getElementById("btn-lock")?.classList.toggle("hidden", locked);
  }

  function lockCodes() {
    setLocked(true);
    showPinUi(hasPin ? "unlock" : "setup");
    renderList();
  }

  function unlockCodes() {
    pinBuffer = "";
    pendingPin = "";
    setLocked(false);
    renderList();
    switchTab("codes");
  }

  async function handlePinComplete(pin) {
    if (pinMode === "setup") {
      pendingPin = pin;
      showPinUi("confirm");
      return;
    }
    if (pinMode === "confirm") {
      if (pin !== pendingPin) {
        setPinError("PINs do not match. Try again.");
        pendingPin = "";
        showPinUi("setup");
        return;
      }
      try {
        await CloudApi.setPin(pin, pin);
        hasPin = true;
        unlockCodes();
        showToast("PIN saved");
      } catch (err) {
        setPinError(err.message);
        showPinUi("setup");
      }
      return;
    }
    if (pinMode === "unlock") {
      try {
        await CloudApi.verifyPin(pin);
        unlockCodes();
      } catch {
        setPinError("Wrong PIN");
        pinBuffer = "";
        updatePinDots();
      }
      return;
    }
    if (pinMode === "reset-setup") {
      pendingPin = pin;
      showPinUi("reset-confirm");
      return;
    }
    if (pinMode === "reset-confirm") {
      if (pin !== pendingPin) {
        setPinError("PINs do not match. Try again.");
        pendingPin = "";
        showPinUi("reset-setup");
        return;
      }
      const password = document.getElementById("pin-reset-password")?.value || "";
      if (!password) {
        setPinError("Enter your account password.");
        showPinUi("reset-setup");
        return;
      }
      try {
        await CloudApi.resetPin(password, pin, pin);
        hasPin = true;
        unlockCodes();
        showToast("PIN updated");
      } catch (err) {
        setPinError(err.message);
        showPinUi("reset-setup");
      }
    }
  }

  function addPinDigit(digit) {
    if (pinBuffer.length >= 4) return;
    pinBuffer += digit;
    updatePinDots();
    if (pinBuffer.length === 4) {
      const pin = pinBuffer;
      pinBuffer = "";
      setTimeout(() => handlePinComplete(pin), 80);
    }
  }

  document.getElementById("pin-pad")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.digit) addPinDigit(btn.dataset.digit);
    if (btn.dataset.action === "back") {
      pinBuffer = pinBuffer.slice(0, -1);
      updatePinDots();
    }
    if (btn.dataset.action === "clear") {
      pinBuffer = "";
      updatePinDots();
    }
  });

  document.addEventListener("keydown", (e) => {
    const overlay = document.getElementById("pin-overlay");
    if (!overlay || overlay.classList.contains("hidden")) return;
    const active = document.activeElement;
    if (active && (active.id === "pin-reset-password" || active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
      return;
    }
    if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      addPinDigit(e.key);
    } else if (e.key === "Backspace") {
      e.preventDefault();
      pinBuffer = pinBuffer.slice(0, -1);
      updatePinDots();
    }
  });

  document.getElementById("btn-lock")?.addEventListener("click", () => {
    if (!codesUnlocked) return;
    lockCodes();
    showToast("Codes hidden");
  });

  document.getElementById("btn-forgot-pin")?.addEventListener("click", () => {
    pendingPin = "";
    const resetInput = document.getElementById("pin-reset-password");
    if (resetInput) resetInput.value = "";
    showPinUi("reset-setup");
  });

  codesContainer.appendChild(createCodeRow());
  renumberRows();

  (async function init() {
    showScreen("loading");
    const ok = await tryAutoLogin();
    if (!ok) {
      prefillLoginEmail();
      showScreen("login");
    }
  })();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  }

  const INSTALL_DISMISS_KEY = "gate_install_dismissed";
  let deferredInstall = null;

  function isStandaloneApp() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  function isIosDevice() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  function hideInstallUi() {
    document.getElementById("btn-install")?.classList.add("hidden");
    document.getElementById("btn-install-auth")?.classList.add("hidden");
    document.getElementById("install-auth-footer")?.classList.add("hidden");
    document.getElementById("install-banner")?.classList.add("hidden");
  }

  function refreshInstallUi() {
    if (isStandaloneApp()) {
      hideInstallUi();
      return;
    }
    const dismissed = localStorage.getItem(INSTALL_DISMISS_KEY);
    const banner = document.getElementById("install-banner");
    const bannerText = document.getElementById("install-banner-text");
    const bannerInstall = document.getElementById("btn-install-banner");
    const headerBtn = document.getElementById("btn-install");
    const authBtn = document.getElementById("btn-install-auth");
    const authFooter = document.getElementById("install-auth-footer");

    if (deferredInstall) {
      headerBtn?.classList.remove("hidden");
      authBtn?.classList.remove("hidden");
      authFooter?.classList.remove("hidden");
      if (!dismissed) {
        banner?.classList.remove("hidden");
        if (bannerText) {
          bannerText.textContent = "Add it to your home screen for a full-screen app.";
        }
        bannerInstall?.classList.remove("hidden");
      }
      return;
    }

    if (isIosDevice() && !dismissed) {
      banner?.classList.remove("hidden");
      if (bannerText) {
        bannerText.textContent = "Tap Share, then Add to Home Screen.";
      }
      bannerInstall?.classList.add("hidden");
    }
  }

  async function promptInstall() {
    if (!deferredInstall) {
      refreshInstallUi();
      return;
    }
    deferredInstall.prompt();
    const { outcome } = await deferredInstall.userChoice;
    deferredInstall = null;
    hideInstallUi();
    if (outcome === "accepted") showToast("App installed");
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstall = event;
    refreshInstallUi();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstall = null;
    hideInstallUi();
    showToast("App installed");
  });

  document.getElementById("btn-install")?.addEventListener("click", promptInstall);
  document.getElementById("btn-install-auth")?.addEventListener("click", promptInstall);
  document.getElementById("btn-install-banner")?.addEventListener("click", promptInstall);
  document.getElementById("btn-install-dismiss")?.addEventListener("click", () => {
    localStorage.setItem(INSTALL_DISMISS_KEY, "1");
    document.getElementById("install-banner")?.classList.add("hidden");
  });

  refreshInstallUi();
})();
