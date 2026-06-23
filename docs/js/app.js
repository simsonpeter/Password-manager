(function () {
  const ORDINALS = ["1st", "2nd", "3rd"];

  let sessionPassword = null;
  let entries = [];
  let nextId = 1;

  const screens = {
    setup: document.getElementById("screen-setup"),
    login: document.getElementById("screen-login"),
    forgot: document.getElementById("screen-forgot"),
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
    showToast._t = setTimeout(() => t.classList.remove("show"), 2200);
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
    if (entry.notes) {
      lines.push("", `Notes: ${entry.notes}`);
    }
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

  async function persist() {
    if (!sessionPassword) return;
    const bundle = await CryptoUtil.encrypt(sessionPassword, { entries, nextId });
    Storage.saveBundle(bundle);
  }

  async function unlock(password) {
    const bundle = Storage.loadBundle();
    if (!bundle) return false;
    const data = await CryptoUtil.decrypt(password, bundle);
    if (!data || !Array.isArray(data.entries)) return false;
    sessionPassword = password;
    entries = data.entries;
    nextId = data.nextId || Math.max(0, ...entries.map((e) => e.id)) + 1;
    return true;
  }

  async function initialSetup(password) {
    sessionPassword = password;
    entries = [];
    nextId = 1;
    await persist();
    return true;
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
        entries = entries.filter((e) => e.id !== entry.id);
        await persist();
        renderList();
        showToast("Deleted");
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
      if (tab === "add" && !entryIdInput.value) {
        resetForm();
      }
    });
  });

  document.getElementById("setup-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const p1 = document.getElementById("setup-password").value;
    const p2 = document.getElementById("setup-confirm").value;
    if (p1.length < 6) return showToast("Password: min 6 characters");
    if (p1 !== p2) return showToast("Passwords do not match");
    await initialSetup(p1);
    showScreen("app");
    switchTab("codes");
    resetForm();
    renderList();
    showToast("Ready — your data is encrypted on this device");
  });

  document.getElementById("login-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const p = document.getElementById("login-password").value;
    const ok = await unlock(p);
    if (!ok) return showToast("Wrong password");
    showScreen("app");
    switchTab("codes");
    resetForm();
    renderList();
  });

  document.getElementById("btn-forgot-password")?.addEventListener("click", () => {
    document.getElementById("forgot-restore-form")?.reset();
    showScreen("forgot");
  });

  document.getElementById("btn-back-login")?.addEventListener("click", () => {
    showScreen("login");
  });

  async function restoreBackup(bundle, password) {
    if (!bundle?.salt || !bundle?.data) throw new Error("Invalid file");
    const data = await CryptoUtil.decrypt(password, bundle);
    if (!data) throw new Error("Wrong password");
    if (
      Storage.hasData() &&
      !confirm("Replace all data on this device with the backup?")
    ) {
      return false;
    }
    Storage.saveBundle(bundle);
    await unlock(password);
    showScreen("app");
    switchTab("codes");
    resetForm();
    renderList();
    showToast("Backup restored");
    return true;
  }

  document.getElementById("forgot-restore-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = document.getElementById("forgot-restore-file").files?.[0];
    const password = document.getElementById("forgot-restore-password").value;
    if (!file) return showToast("Choose a backup file");
    try {
      const bundle = JSON.parse(await file.text());
      const ok = await restoreBackup(bundle, password);
      if (ok === false) return;
      if (!ok) showToast("Wrong password for backup");
    } catch (err) {
      if (err.message === "Wrong password") return showToast("Wrong password for backup");
      showToast("Import failed");
    }
  });

  document.getElementById("btn-start-over")?.addEventListener("click", () => {
    const confirmed = confirm(
      "This will permanently delete all codes on this device and let you create a new password.\n\nThis cannot be undone unless you have a backup file. Continue?"
    );
    if (!confirmed) return;
    Storage.clear();
    sessionPassword = null;
    entries = [];
    document.getElementById("login-password").value = "";
    document.getElementById("setup-form")?.reset();
    document.getElementById("forgot-restore-form")?.reset();
    showScreen("setup");
    showToast("App reset — create a new password");
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
    if (id) {
      const idx = entries.findIndex((x) => x.id === id);
      if (idx >= 0) entries[idx] = { id, name, codes, notes };
      showToast("Updated");
    } else {
      entries.push({ id: nextId++, name, codes, notes });
      showToast("Saved");
    }
    await persist();
    resetForm();
    renderList();
    switchTab("codes");
  });

  searchInput?.addEventListener("input", applySearch);

  document.getElementById("btn-logout")?.addEventListener("click", () => {
    sessionPassword = null;
    entries = [];
    document.getElementById("login-password").value = "";
    showScreen("login");
    showToast("Logged out");
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

    if (current !== sessionPassword) {
      errEl.textContent = "Current password is wrong";
      errEl.classList.remove("hidden");
      return;
    }
    if (newP.length < 6) {
      errEl.textContent = "New password: min 6 characters";
      errEl.classList.remove("hidden");
      return;
    }
    if (newP !== confirm) {
      errEl.textContent = "New passwords do not match";
      errEl.classList.remove("hidden");
      return;
    }
    sessionPassword = newP;
    await persist();
    pwdDialog.close();
    showToast("Password changed");
  });

  document.getElementById("btn-export")?.addEventListener("click", () => {
    const bundle = Storage.loadBundle();
    if (!bundle) return showToast("Nothing to export");
    const blob = new Blob([JSON.stringify(bundle)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "gate-port-codes-backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("Backup downloaded");
  });

  document.getElementById("import-file")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const bundle = JSON.parse(await file.text());
      const testPass = prompt("Enter the password for this backup file:");
      if (!testPass) return;
      const ok = await restoreBackup(bundle, testPass);
      if (ok === false) return;
      if (!ok) showToast("Wrong password for backup");
    } catch (err) {
      if (err.message === "Wrong password") return showToast("Wrong password for backup");
      showToast("Import failed");
    }
    e.target.value = "";
  });

  codesContainer.appendChild(createCodeRow());
  renumberRows();

  if (Storage.hasData()) {
    showScreen("login");
  } else {
    showScreen("setup");
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  }
})();
