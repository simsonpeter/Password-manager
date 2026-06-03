(function () {
  const ORDINALS = ["1st", "2nd", "3rd"];

  function ordinal(n) {
    if (n <= 3) return ORDINALS[n - 1];
    return n + "th";
  }

  function showToast(message) {
    let toast = document.querySelector(".toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove("show"), 2000);
  }

  const form = document.getElementById("entry-form");
  const formTitle = document.getElementById("form-title");
  const entryIdInput = document.getElementById("entry-id");
  const nameInput = document.getElementById("entry-name");
  const notesInput = document.getElementById("entry-notes");
  const codesContainer = document.getElementById("codes-container");
  const btnAddCode = document.getElementById("btn-add-code");
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
      <input type="text" class="code-input" value="${escapeAttr(value)}" placeholder="Enter code" autocomplete="off">
      <button type="button" class="btn-remove-code" title="Remove code" aria-label="Remove code">×</button>
    `;
    row.querySelector(".btn-remove-code").addEventListener("click", () => {
      if (codesContainer.children.length > 1) {
        row.remove();
        renumberCodeRows();
      }
    });
    return row;
  }

  function escapeAttr(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function renumberCodeRows() {
    [...codesContainer.children].forEach((row, i) => {
      row.querySelector(".code-row-label").textContent = ordinal(i + 1);
    });
    updateRemoveButtons();
  }

  function updateRemoveButtons() {
    const rows = codesContainer.children;
    const disable = rows.length <= 1;
    [...rows].forEach((row) => {
      row.querySelector(".btn-remove-code").disabled = disable;
    });
  }

  function resetForm() {
    entryIdInput.value = "";
    nameInput.value = "";
    notesInput.value = "";
    codesContainer.innerHTML = "";
    codesContainer.appendChild(createCodeRow());
    updateRemoveButtons();
    formTitle.textContent = "Add entry";
    btnCancel.classList.add("hidden");
  }

  function fillForm(entry) {
    entryIdInput.value = entry.id;
    nameInput.value = entry.name;
    notesInput.value = entry.notes || "";
    codesContainer.innerHTML = "";
    const codes = entry.codes.length ? entry.codes : [""];
    codes.forEach((code, i) => codesContainer.appendChild(createCodeRow(code, i + 1)));
    updateRemoveButtons();
    formTitle.textContent = "Edit entry";
    btnCancel.classList.remove("hidden");
    nameInput.focus();
  }

  function getCodesFromForm() {
    return [...codesContainer.querySelectorAll(".code-input")]
      .map((input) => input.value.trim())
      .filter(Boolean);
  }

  async function api(method, url, body) {
    const opts = { method, headers: { "Content-Type": "application/json" } };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  function renderEntryCard(entry) {
    const article = document.createElement("article");
    article.className = "entry-card";
    article.dataset.id = entry.id;
    article.dataset.name = entry.name.toLowerCase();

    const codesHtml = entry.codes
      .map(
        (code, i) => `
      <li>
        <span class="code-label">${ordinal(i + 1)} code</span>
        <code class="code-value">${escapeHtml(code)}</code>
        <button type="button" class="btn-copy" data-copy="${escapeAttr(code)}" title="Copy">📋</button>
      </li>`
      )
      .join("");

    article.innerHTML = `
      <div class="entry-header">
        <h3 class="entry-name">${escapeHtml(entry.name)}</h3>
        <div class="entry-actions">
          <button type="button" class="btn-icon btn-edit" data-id="${entry.id}" title="Edit">✏️</button>
          <button type="button" class="btn-icon btn-delete" data-id="${entry.id}" title="Delete">🗑️</button>
        </div>
      </div>
      <ol class="code-list">${codesHtml}</ol>
      ${entry.notes ? `<p class="entry-notes">${escapeHtml(entry.notes)}</p>` : ""}
    `;
    bindEntryCardEvents(article);
    return article;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function bindEntryCardEvents(card) {
    card.querySelector(".btn-edit")?.addEventListener("click", async () => {
      const id = card.dataset.id;
      const entries = await api("GET", "/api/entries");
      const entry = entries.find((e) => String(e.id) === String(id));
      if (entry) fillForm(entry);
    });

    card.querySelector(".btn-delete")?.addEventListener("click", async () => {
      if (!confirm("Delete this entry?")) return;
      await api("DELETE", `/api/entries/${card.dataset.id}`);
      card.remove();
      updateEntryCount();
      ensureEmptyState();
      showToast("Entry deleted");
    });

    card.querySelectorAll(".btn-copy").forEach((btn) => {
      btn.addEventListener("click", () => {
        navigator.clipboard.writeText(btn.dataset.copy).then(() => {
          showToast("Copied to clipboard");
        });
      });
    });
  }

  function updateEntryCount() {
    const count = entriesList.querySelectorAll(".entry-card:not(.hidden-by-search)").length;
    const total = entriesList.querySelectorAll(".entry-card").length;
    entryCount.textContent = searchInput?.value ? `${count}/${total}` : total;
  }

  function ensureEmptyState() {
    const hasCards = entriesList.querySelector(".entry-card");
    let empty = document.getElementById("empty-state");
    if (!hasCards && !empty) {
      empty = document.createElement("p");
      empty.id = "empty-state";
      empty.className = "empty-state";
      empty.textContent = "No entries yet. Add your first gate or port name above.";
      entriesList.appendChild(empty);
    } else if (hasCards && empty) {
      empty.remove();
    }
  }

  function upsertCard(entry) {
    const existing = entriesList.querySelector(`[data-id="${entry.id}"]`);
    const card = renderEntryCard(entry);
    if (existing) {
      existing.replaceWith(card);
    } else {
      const empty = document.getElementById("empty-state");
      if (empty) empty.remove();
      entriesList.prepend(card);
    }
    updateEntryCount();
  }

  btnAddCode?.addEventListener("click", () => {
    codesContainer.appendChild(createCodeRow());
    updateRemoveButtons();
    codesContainer.lastElementChild.querySelector("input").focus();
  });

  btnCancel?.addEventListener("click", resetForm);

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const codes = getCodesFromForm();
    const notes = notesInput.value.trim();

    if (!name) {
      showToast("Name is required");
      return;
    }

    const payload = { name, codes, notes };
    const id = entryIdInput.value;

    try {
      let entry;
      if (id) {
        entry = await api("PUT", `/api/entries/${id}`, payload);
        showToast("Entry updated");
      } else {
        entry = await api("POST", "/api/entries", payload);
        showToast("Entry saved");
      }
      upsertCard(entry);
      resetForm();
    } catch (err) {
      showToast(err.message);
    }
  });

  searchInput?.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    entriesList.querySelectorAll(".entry-card").forEach((card) => {
      const match = !q || card.dataset.name.includes(q);
      card.classList.toggle("hidden-by-search", !match);
    });
    updateEntryCount();
  });

  document.querySelectorAll(".entry-card").forEach(bindEntryCardEvents);
  document.querySelectorAll(".btn-copy").forEach((btn) => {
    btn.addEventListener("click", () => {
      navigator.clipboard.writeText(btn.dataset.copy).then(() => {
        showToast("Copied to clipboard");
      });
    });
  });

  const passwordDialog = document.getElementById("password-dialog");
  const passwordForm = document.getElementById("password-form");
  const passwordError = document.getElementById("password-error");

  document.getElementById("btn-change-password")?.addEventListener("click", () => {
    passwordForm.reset();
    passwordError.classList.add("hidden");
    passwordDialog.showModal();
  });

  document.getElementById("btn-close-dialog")?.addEventListener("click", () => {
    passwordDialog.close();
  });

  passwordForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const current = document.getElementById("current-password").value;
    const newPassword = document.getElementById("new-password").value;
    const confirm = document.getElementById("confirm-password").value;

    try {
      await api("POST", "/api/change-password", {
        current_password: current,
        new_password: newPassword,
        confirm_password: confirm,
      });
      passwordDialog.close();
      showToast("Password updated");
    } catch (err) {
      passwordError.textContent = err.message;
      passwordError.classList.remove("hidden");
    }
  });

  if (codesContainer && !codesContainer.children.length) {
    codesContainer.appendChild(createCodeRow());
    updateRemoveButtons();
  }

  setTimeout(() => {
    document.querySelectorAll(".flash").forEach((el) => {
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 300);
    });
  }, 4000);
})();
