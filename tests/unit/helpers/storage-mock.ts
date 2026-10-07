export function storageGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
export function storageSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* silent */
  }
}
export function storageHas(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}
export function storageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* silent */
  }
}
