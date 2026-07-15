import { WorkbenchSession, CodeChangePlan } from '../domain/WorkbenchTypes';
import { IFileSystemAdapter } from '../../artifact/IFileSystemAdapter';

export class CodeModifier {
  public async applyModifications(
    session: WorkbenchSession, 
    plan: CodeChangePlan, 
    fs: IFileSystemAdapter
  ): Promise<void> {
    for (const mod of plan.modifications) {
      // For Phase 6.2, all paths are relative to isolatedWorkspace.
      // Wait, we need to construct the absolute path in the isolated workspace.
      // But in the Workbench domain, the adapter takes absolute paths or paths relative to the host adapter context.
      // Assuming IFileSystemAdapter expects absolute paths for safety:
      const targetPath = `${session.isolatedWorkspace}/${mod.logicalPath}`.replace(/\/\//g, '/');
      
      if (mod.operation === 'CREATE' || mod.operation === 'UPDATE') {
        if (mod.content !== undefined) {
          await fs.write(targetPath, mod.content);
        }
      } else if (mod.operation === 'DELETE') {
        if (await fs.exists(targetPath)) {
          await fs.remove(targetPath);
        }
      }
    }
  }
}
