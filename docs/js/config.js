(function () {
  const host = window.location.hostname;
  const isGitHubPages = host.endsWith("github.io");

  window.APP_CONFIG = {
    // Empty string = API on same server (Render). Set your Render URL for GitHub Pages.
    apiUrl: isGitHubPages ? "https://gate-port-codes.onrender.com" : "",
  };
})();
