const CloudApi = (() => {
  const TOKEN_KEY = "cloud_auth_token";
  const EMAIL_KEY = "cloud_auth_email";

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

  function setSession(token, email) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(EMAIL_KEY, email);
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
  }

  async function request(method, path, body) {
    const headers = { "Content-Type": "application/json" };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(apiPath(path), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || "Request failed");
      err.status = res.status;
      throw err;
    }
    return data;
  }

  return {
    getToken,
    getEmail,
    setSession,
    clearSession,
    register: (email, password) => request("POST", "/auth/register", { email, password }),
    login: (email, password) => request("POST", "/auth/login", { email, password }),
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
    health: () => request("GET", "/health"),
  };
})();
