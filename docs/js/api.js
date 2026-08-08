const CloudApi = (() => {
  const TOKEN_KEY = "cloud_auth_token";
  const EMAIL_KEY = "cloud_auth_email";
  const LAST_EMAIL_KEY = "cloud_last_email";

  function baseUrl() {
    const configured = window.APP_CONFIG?.apiUrl ?? "";
    return configured.replace(/\/$/, "");
  }

  function apiPath(path) {
    return `${baseUrl()}/api${path}`;
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getEmail() {
    return localStorage.getItem(EMAIL_KEY);
  }

  function getLastEmail() {
    return localStorage.getItem(LAST_EMAIL_KEY) || "";
  }

  function setSession(token, email) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(EMAIL_KEY, email);
    localStorage.setItem(LAST_EMAIL_KEY, email);
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
  }

  async function parseResponse(res) {
    const text = await res.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        if (!res.ok) {
          throw new Error(
            res.status === 503 || res.status === 502
              ? "Cloud server is waking up. Wait 30 seconds and try again."
              : "Server error. Please try again."
          );
        }
      }
    }
    if (!res.ok) {
      const err = new Error(data.error || "Request failed");
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async function authRequest(method, path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);

    try {
      const res = await fetch(apiPath(path), {
        method,
        headers: { "Content-Type": "application/json" },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      return await parseResponse(res);
    } catch (err) {
      if (err.name === "AbortError") {
        throw new Error("Server is slow to respond. Wait and try again.");
      }
      if (err.message) throw err;
      throw new Error("Cannot reach cloud server. Check your internet.");
    } finally {
      clearTimeout(timer);
    }
  }

  async function request(method, path, body) {
    const headers = { "Content-Type": "application/json" };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch(apiPath(path), {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      return await parseResponse(res);
    } catch (err) {
      if (err.name === "AbortError") {
        throw new Error("Server is slow to respond. Wait and try again.");
      }
      if (err.message) throw err;
      throw new Error("Cannot reach cloud server. Check your internet.");
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    getToken,
    getEmail,
    getLastEmail,
    setSession,
    clearSession,
    register: (email, password) =>
      authRequest("POST", "/auth/register", { email, password }),
    login: (email, password) =>
      authRequest("POST", "/auth/login", { email, password }),
    me: () => request("GET", "/auth/me"),
    changePassword: (current_password, new_password, confirm_password) =>
      request("POST", "/auth/change-password", {
        current_password,
        new_password,
        confirm_password,
      }),
    listEntries: () => request("GET", "/entries"),
    createEntry: (payload) => request("POST", "/entries", payload),
    updateEntry: (id, payload) => request("PUT", `/entries/${id}`, payload),
    deleteEntry: (id) => request("DELETE", `/entries/${id}`),
    importEntries: (entries, replace = false) =>
      request("POST", "/entries/import", { entries, replace }),
    health: () => authRequest("GET", "/health"),
  };
})();
