const Storage = (() => {
  const KEY = "gate_port_codes_v1";

  function hasData() {
    return !!localStorage.getItem(KEY);
  }

  function loadBundle() {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function saveBundle(bundle) {
    localStorage.setItem(KEY, JSON.stringify(bundle));
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  return { hasData, loadBundle, saveBundle, clear, KEY };
})();
