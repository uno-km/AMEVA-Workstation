export async function keychainGet(key: string): Promise<string | null> {
  if (!window.electronAPI?.keychainGet) return null;
  return window.electronAPI.keychainGet(key);
}

export async function keychainSet(key: string, value: string): Promise<{ success: boolean; error?: string }> {
  if (!window.electronAPI?.keychainSet) return { success: false, error: 'API not available' };
  return window.electronAPI.keychainSet(key, value);
}

export async function keychainDelete(key: string): Promise<{ success: boolean; error?: string }> {
  if (!window.electronAPI?.keychainDelete) return { success: false, error: 'API not available' };
  return window.electronAPI.keychainDelete(key);
}
