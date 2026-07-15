import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import crypto from 'crypto';
import { SourceApplyService } from '../SourceApplyService';

describe('SourceApplyService', () => {
  let service: SourceApplyService;
  let testRoot: string;
  let allowedWorkspaceRoot: string;
  let artifactStorageRef: string;

  beforeEach(async () => {
    service = new SourceApplyService();
    testRoot = path.join(__dirname, 'test-temp-' + crypto.randomUUID());
    allowedWorkspaceRoot = path.join(testRoot, 'workspace');
    artifactStorageRef = path.join(testRoot, 'artifacts', 'test-artifact.ts');

    await fsp.mkdir(allowedWorkspaceRoot, { recursive: true });
    await fsp.mkdir(path.dirname(artifactStorageRef), { recursive: true });
    await fsp.writeFile(artifactStorageRef, 'console.log("hello new world");', 'utf8');
  });

  afterEach(async () => {
    if (fs.existsSync(testRoot)) {
      await fsp.rm(testRoot, { recursive: true, force: true });
    }
  });

  it('Phase 6.4.1A-3: MUST block createPreview', async () => {
    await expect(service.createPreview()).rejects.toThrow('Preview creation moved to Renderer Phase');
  });

  it('Phase 6.4.1A-3: MUST block executeApply', async () => {
    await expect(service.executeApply()).rejects.toThrow('Phase 6.4.1B Required');
  });

  it('Phase 6.4.1A-3: MUST block rollbackApply', async () => {
    await expect(service.rollbackApply()).rejects.toThrow('Phase 6.4.1B Required');
  });
});
