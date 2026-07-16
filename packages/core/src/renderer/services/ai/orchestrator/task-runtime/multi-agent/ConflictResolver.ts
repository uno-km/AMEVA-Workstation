/**
 * @file orchestrator/task-runtime/multi-agent/ConflictResolver.ts
 * @system AMEVA OS Desktop Workstation
 * @role Conflict Detection and Resolution
 */

import { ProposedChanges, ImplementationPlan, ReviewReport } from './types.ts';

export type ConflictResolutionPolicy =
  | 'MANUAL_REVIEW_REQUIRED'
  | 'AUTO_MERGE_ALLOWED'
  | 'REJECT_REWORK_REQUIRED'
  | 'STALE_REBASE_REQUIRED'
  | 'SILENT_OVERWRITE_FORBIDDEN';

export interface ConflictResolutionResult {
  hasConflict: boolean;
  policy?: ConflictResolutionPolicy;
  reason?: string;
}

export class ConflictResolver {
  public detectPatchConflict(
    baseRevision: string,
    currentRevision: string,
    patches: ProposedChanges['patches'],
    existingPatches: ProposedChanges['patches']
  ): ConflictResolutionResult {
    if (baseRevision !== currentRevision) {
      return {
        hasConflict: true,
        policy: 'STALE_REBASE_REQUIRED',
        reason: 'Base revision mismatch. Handoff is stale and requires rebase.'
      };
    }

    // Check for same file conflicts
    for (const p of patches) {
      const existing = existingPatches.find(ep => ep.filePath === p.filePath);
      if (existing) {
        // Simple logic for same file hunk overlap
        if (this.hasOverlappingHunks(p.diff, existing.diff)) {
          return {
            hasConflict: true,
            policy: 'MANUAL_REVIEW_REQUIRED',
            reason: `Overlapping hunks detected in ${p.filePath}. Auto-merge forbidden.`
          };
        } else {
          return {
            hasConflict: false,
            policy: 'AUTO_MERGE_ALLOWED',
            reason: `Non-overlapping hunks in ${p.filePath}. Auto-merge allowed.`
          };
        }
      }
    }

    return { hasConflict: false };
  }

  public detectDocumentConflict(filePath: string): ConflictResolutionResult {
    // Documents require manual review if sections conflict
    return {
      hasConflict: true,
      policy: 'MANUAL_REVIEW_REQUIRED',
      reason: `Contextual document conflict in ${filePath}. Manual review required.`
    };
  }

  public detectPlanMismatch(
    plan: ImplementationPlan,
    changes: ProposedChanges
  ): ConflictResolutionResult {
    // If targeted files don't match proposed files
    const proposedFiles = changes.patches.map(p => p.filePath);
    const missing = plan.targetFiles.filter(f => !proposedFiles.includes(f));
    
    if (missing.length > 0) {
      return {
        hasConflict: true,
        policy: 'REJECT_REWORK_REQUIRED',
        reason: `Proposed changes do not match implementation plan target files. Missing: ${missing.join(', ')}`
      };
    }
    return { hasConflict: false };
  }

  private hasOverlappingHunks(diffA: string, diffB: string): boolean {
    // Stub for actual hunk parsing logic
    // For now, if both diffs exist on same file, we treat it as overlap
    // to strictly enforce safety
    return true;
  }
}
