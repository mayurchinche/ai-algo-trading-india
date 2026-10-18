// The strategy spec being edited, shared by the Options Wizard and the rule builder in this browser.
export const SPEC_DRAFT_KEY = 'strategy_spec_draft_v1';
export function loadSpecDraft(storage: Pick<Storage, 'getItem'> = localStorage): unknown | null {
 try { return JSON.parse(storage.getItem(SPEC_DRAFT_KEY) ?? 'null'); } catch { return null; }
}
export function saveSpecDraft(spec: unknown, storage: Pick<Storage, 'setItem'> = localStorage) { storage.setItem(SPEC_DRAFT_KEY, JSON.stringify(spec)); }
export function downloadJson(name: string, value: unknown) {
 const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
 const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
}
// Pages ask the app shell to switch tabs; the shell owns navigation state.
export const NAVIGATE_EVENT = 'app:navigate';
export const navigateTo = (tab: string) => window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: tab }));
// Opens the Analysis page for one symbol.
export const ANALYSE_EVENT = 'app:analyse';
export const openAnalysis = (symbol: string) => window.dispatchEvent(new CustomEvent(ANALYSE_EVENT, { detail: symbol }));
