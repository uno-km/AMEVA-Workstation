export type ArtifactKind = 'INLINE_TEXT' | 'INLINE_STRUCTURED' | 'FILE';

export type ArtifactStatus =
  | 'DECLARED'
  | 'STAGED'
  | 'WRITTEN'
  | 'VALIDATED'
  | 'COMMITTING'
  | 'COMMITTED'
  | 'REJECTED'
  | 'CORRUPTED'
  | 'STALE';

export interface ArtifactProvenance {
  missionId: string;
  taskId: string;
  attemptId: string;
  producer?: string; // e.g., toolName 'write_file'
  sourceArtifactIds?: string[];
  modelId?: string;
}

export interface ArtifactManifest {
  artifactId: string;
  missionId: string;
  taskId: string;
  attemptId: string;
  kind: ArtifactKind;
  required: boolean;
  expectedPath?: string;
  stagedPath?: string;
  finalPath?: string;
  format?: string;
  status: ArtifactStatus;
  size?: number;
  contentHash?: string;
  revision: number;
  idempotencyKey?: string;
  createdAt: number;
  updatedAt: number;
  validationErrors?: string[];
  provenance: ArtifactProvenance;
}

export interface ArtifactEvent {
  eventId: string;
  timestamp: number;
  missionId: string;
  taskId: string;
  attemptId: string;
  artifactId: string;
  previousStatus?: ArtifactStatus;
  nextStatus: ArtifactStatus;
  reason: string;
  revision: number;
  contentHash?: string;
}
