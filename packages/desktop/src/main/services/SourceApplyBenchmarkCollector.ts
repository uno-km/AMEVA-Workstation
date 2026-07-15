import { BenchmarkMetrics } from '../../../../core/src/renderer/services/ai/orchestrator/task-runtime/apply/types.js';

export class SourceApplyBenchmarkCollector {
  private startTime: number = 0;
  private endTime: number = 0;
  
  public start(): void {
    this.startTime = Date.now();
  }

  public stop(success: boolean, errorCategory?: string, parallelCount?: number): BenchmarkMetrics {
    this.endTime = Date.now();
    return {
      durationMs: this.endTime - this.startTime,
      memoryUsage: process.memoryUsage().heapUsed,
      parallelCount: parallelCount || 1,
      success,
      errorCategory
    };
  }
}
