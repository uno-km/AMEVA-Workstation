export interface IArtifactReader {
  read(path: string): Promise<string | null>;
  readBytes(path: string): Promise<Uint8Array | null>;
  exists(path: string): Promise<boolean>;
  getSize(path: string): Promise<number>;
  getHash(path: string): Promise<string | null>;
}
