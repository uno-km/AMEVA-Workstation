/**
 * @file debug-sidecar/mock.ts
 * @system AMEVA OS Desktop Workstation
 * @role Mock browser APIs in Node.js environment before any imports are evaluated
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

if (typeof globalThis.window === 'undefined') {
  const mockStorage = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (key: string) => mockStorage.get(key) || null,
    setItem: (key: string, value: string) => { mockStorage.set(key, value); },
    removeItem: (key: string) => { mockStorage.delete(key); },
    clear: () => { mockStorage.clear(); },
    key: (index: number) => Array.from(mockStorage.keys())[index] || null,
    get length() { return mockStorage.size; }
  };

  const mockElectronAPI = {
    llmAddLog: (data: any) => {},
    executeTerminal: async (cmd: string, cwd?: string) => {
      try {
        const { stdout, stderr } = await execAsync(cmd, { cwd, shell: 'powershell.exe' });
        return { stdout, stderr, newCwd: cwd || process.cwd() };
      } catch (err: any) {
        return { stdout: err.stdout || '', stderr: err.stderr || err.message, newCwd: cwd || process.cwd() };
      }
    }
  };

  (globalThis as any).window = {
    electronAPI: mockElectronAPI,
    dispatchEvent: () => true,
    addEventListener: () => {}
  };
  (globalThis as any).localStorage = mockLocalStorage;
  (globalThis as any).CustomEvent = class CustomEvent {
    constructor(public type: string, public detail?: any) {}
  };

  // Mock IndexedDB to prevent ReferenceErrors and write warnings
  const mockIDBRequest = () => {
    const req: any = {
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null,
      result: {
        objectStoreNames: {
          contains: () => true
        },
        createObjectStore: () => ({}),
        transaction: () => ({
          objectStore: () => ({
            put: () => ({ onsuccess: null, onerror: null }),
            add: () => ({ onsuccess: null, onerror: null }),
            get: () => ({ onsuccess: null, onerror: null }),
            getAll: () => ({ onsuccess: null, onerror: null }),
            delete: () => ({ onsuccess: null, onerror: null }),
            clear: () => ({ onsuccess: null, onerror: null }),
            openCursor: () => ({ onsuccess: null, onerror: null })
          }),
          oncomplete: null,
          onerror: null,
          abort: () => {}
        }),
        close: () => {}
      },
      error: null
    };
    setTimeout(() => {
      if (req.onsuccess) req.onsuccess();
    }, 10);
    return req;
  };

  (globalThis as any).indexedDB = {
    open: mockIDBRequest
  };
}
