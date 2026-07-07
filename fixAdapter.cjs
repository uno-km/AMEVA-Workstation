const fs = require('fs');

let content = fs.readFileSync('src/renderer/services/ipc/electronApiAdapter.ts', 'utf-8');

const wrappers = `
/**
 * keychainGet
 */
export async function keychainGet(key: string): Promise<string | null> {
  if (!window.electronAPI?.keychainGet) return null;
  return window.electronAPI.keychainGet(key);
}

/**
 * keychainSet
 */
export async function keychainSet(key: string, value: string): Promise<void> {
  if (!window.electronAPI?.keychainSet) return;
  return window.electronAPI.keychainSet(key, value);
}

/**
 * keychainDelete
 */
export async function keychainDelete(key: string): Promise<void> {
  if (!window.electronAPI?.keychainDelete) return;
  return window.electronAPI.keychainDelete(key);
}

// ──────────────────────────────────────────────
`;

content = content.replace('// ──────────────────────────────────────────────\n// 파일 시스템 관련 어댑터 메서드', wrappers + '// 파일 시스템 관련 어댑터 메서드');

fs.writeFileSync('src/renderer/services/ipc/electronApiAdapter.ts', content, 'utf-8');
console.log("Added keychain wrappers to electronApiAdapter.ts");
