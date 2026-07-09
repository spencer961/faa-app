// Shared "Client Mode" — when set from the dashboard, the whole app locks
// to a single client so a screen-share never exposes other clients.
export const getClientMode = () => {
  try { const v = localStorage.getItem('faa_client_mode'); return v ? parseInt(v) : null } catch { return null }
}
