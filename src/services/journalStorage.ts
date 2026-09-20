// Never turn corrupt or inaccessible storage into a silently empty trading account.
export function readRecords<T>(key: string): T[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error(`Invalid ${key} journal. Export browser storage before repairing it.`);
  return data as T[];
}
export function writeRecords<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}
export function downloadJSON(name: string, data: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
