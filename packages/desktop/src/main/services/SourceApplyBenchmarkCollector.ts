import { BenchmarkMetrics } from '../../../../core/src/renderer/services/ai/orchestrator/task-runtime/apply/types.js';

export class SourceApplyBenchmarkCollector {
  private startTimeMs: number = 0;
  private scenarioName: string = '';
  private memoryStart: number = 0;
  private fileCount: number = 0;

  public start(scenarioName: string, fileCount: number = 1): void {
    this.scenarioName = scenarioName;
    this.fileCount = fileCount;
    this.startTimeMs = Date.now();
    this.memoryStart = process.memoryUsage().heapUsed;
  }

  public stop(success: boolean, errorCategory?: string, parallelCount: number = 1): BenchmarkMetrics {
    const durationMs = Date.now() - this.startTimeMs;
    const memoryUsed = process.memoryUsage().heapUsed - this.memoryStart;
    
    return {
      scenarioName: this.scenarioName,
      fileCount: this.fileCount,
      durationMs,
      memoryUsage: Math.max(0, memoryUsed),
      parallelCount,
      success,
      errorCategory
    };
  }
}
