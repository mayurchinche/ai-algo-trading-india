import { apiUrl } from './apiUrl';
// A successful HTTP response containing the SPA shell is a configuration failure, not empty data.
export async function fetchMarketJSON(path: string) {
  let response: Response;
  try { response = await fetch(apiUrl(path), { signal: AbortSignal.timeout(20000) }); }
  catch { throw new Error('Market backend could not be reached. Check connectivity and the deployed API address.'); }
  if (response.status === 404) throw new Error('Market API is missing (404). Deploy the backend to Vercel and rebuild Android with its URL.');
  if (!response.ok) throw new Error(`Market data request failed (HTTP ${response.status}). Observations are paused.`);
  try { return await response.json(); }
  catch { throw new Error('Market backend returned a page instead of JSON. Check the API deployment and mobile backend URL.'); }
}
