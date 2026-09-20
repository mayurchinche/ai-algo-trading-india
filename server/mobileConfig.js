export function validateMobileApiBase(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Mobile build requires VITE_API_BASE_URL set to the deployed HTTPS Vercel origin.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || ['localhost', '127.0.0.1', 'your-app.example'].includes(url.hostname)) throw new Error('VITE_API_BASE_URL must be a deployed HTTPS origin without credentials, path or query.');
  return url.origin;
}
