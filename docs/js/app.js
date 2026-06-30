(function () {
  const ORDINALS = ["1st", "2nd", "3rd"];

  let entries = [];
  let currentEmail = "";

  const screens = {
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

  async function enterApp(email) {
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
  }

  async function tryAutoLogin() {
    if (!CloudApi.getToken()) return false;
    try {
      const user = await CloudApi.me();
      await enterApp(user.email);
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
    formTitle.textContent = "Add new";
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
      entriesList.innerHTML =
        '<p class="empty-state">No codes yet.<br>Tap <strong>Add</strong> below to create one.</p>';
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
      card.querySelector(".btn-edit").addEventListener("click", () => fillForm(entry));
      card.querySelector(".btn-share").addEventListener("click", () => shareEntry(entry));
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
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    try {
      const data = await CloudApi.login(email, password);
      CloudApi.setSession(data.token, data.email);
      await enterApp(data.email);
      showToast("Signed in");
    } catch (err) {
      showToast(err.message || "Login failed");
    }
  });

  document.getElementById("register-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value;
    const confirm = document.getElementById("register-confirm").value;
    if (password.length < 6) return showToast("Password: min 6 characters");
    if (password !== confirm) return showToast("Passwords do not match");
    try {
      const data = await CloudApi.register(email, password);
      CloudApi.setSession(data.token, data.email);
      await enterApp(data.email);
      showToast("Account created");
    } catch (err) {
      showToast(err.message || "Registration failed");
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
    CloudApi.clearSession();
    entries = [];
    currentEmail = "";
    document.getElementById("login-password").value = "";
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

  codesContainer.appendChild(createCodeRow());
  renumberRows();

  tryAutoLogin().then((ok) => {
    if (!ok) showScreen("login");
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  }
})();
