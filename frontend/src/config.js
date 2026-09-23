// Single source of truth for the backend URLs — every page imports these
// instead of reading import.meta.env directly, so the trailing-slash fix
// only has to live in one place.
//
// .replace strips any trailing slash: "https://x.onrender.com/" and
// "https://x.onrender.com" must behave identically, since code elsewhere
// does `${API_URL}/api/seats` — a stray slash in the env var would silently
// turn that into a double-slash URL ("...//api/seats") that Express treats
// as a completely different, unmatched route and returns 404 for.
function stripTrailingSlash(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

export const API_URL    = stripTrailingSlash(import.meta.env.VITE_API_URL)    || 'http://localhost:5000';
export const SOCKET_URL = stripTrailingSlash(import.meta.env.VITE_SOCKET_URL) || 'http://localhost:5000';
