export interface IFileSystemAdapter {
  stat(path: string): Promise<{ exists: boolean; size: number; isDirectory: boolean }>;
  read(path: string): Promise<string | null>;
  move(sourcePath: string, destPath: string, backupPath?: string): Promise<void>;
  hash(path: string): Promise<string | null>;
  remove(path: string): Promise<void>;
}
