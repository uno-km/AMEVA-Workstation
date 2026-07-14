export interface IFileSystemAdapter {
  stat(path: string): Promise<{ exists: boolean; size: number; isDirectory: boolean }>;
  read(path: string): Promise<string | null>;
  write(path: string, content: string): Promise<void>;
  move(sourcePath: string, destPath: string, backupPath?: string): Promise<void>;
  hash(path: string): Promise<string | null>;
  remove(path: string): Promise<void>;
  list(path: string): Promise<string>;
}
