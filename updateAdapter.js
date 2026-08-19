const fs = require('fs');
const path = 'c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/packages/core/src/shared/adapters/platformAdapter.ts';
let content = fs.readFileSync(path, 'utf8');

// Replace AIEngineAdapter
content = content.replace(/export interface AIEngineAdapter \{[\s\S]*?\}/, export interface KeychainAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<{ success: boolean; error?: string }>;
  delete(key: string): Promise<{ success: boolean; error?: string }>;
}

export interface MCPAdapter {
  spawn(serverId: string, command: string, args: string[]): Promise<any>;
  call(serverId: string, request: any): Promise<any>;
  kill(serverId: string): Promise<any>;
  getToken(): Promise<string | null>;
}

export interface SettingsAdapter {
  getGpuName(): Promise<string>;
  getPlanStatus(): Promise<boolean>;
  setPlanStatus(isPro: boolean): Promise<any>;
}

export interface AIEngineAdapter {
  runAIStream(prompt: string, modelPath: string, onToken: (token: string) => void): Promise<void>;
  stopAI(): Promise<void>;
  getModels(type?: string): Promise<any[]>;
  generate(params: any): Promise<any>;
  abort(sessionId: string): void;
  checkHealth(): Promise<any>;
  getLogs(): Promise<string>;
  downloadModel(payload: any): Promise<any>;
  onDownloadProgress(callback: (data: any) => void): () => void;
  onToken(sessionId: string, callback: (token: string) => void): () => void;
  onDone(sessionId: string, callback: (data: any) => void): () => void;
  onLog(callback: (data: any) => void): () => void;
});

// Add to PlatformAdapter
content = content.replace(/export interface PlatformAdapter \{[\s\S]*?\}/, export interface PlatformAdapter {
  fs: FileSystemAdapter;
  ai: AIEngineAdapter;
  keychain: KeychainAdapter;
  mcp: MCPAdapter;
  settings: SettingsAdapter;
  isNative: boolean; // Indicates if running natively (Desktop) to allow UI hide/show logic
});

fs.writeFileSync(path, content, 'utf8');