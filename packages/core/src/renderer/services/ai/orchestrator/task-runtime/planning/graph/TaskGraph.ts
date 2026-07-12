/**
 * @file orchestrator/task-runtime/planning/graph/TaskGraph.ts
 * @system AMEVA OS Desktop Workstation
 * @role Task DAG 생성, 순환 참조 감지, 위상 정렬 기능 제공
 */

import { TaskDefinition } from '../../domain/types';

export class TaskGraph {
  private nodes: Map<string, TaskDefinition> = new Map();
  private edges: Map<string, Set<string>> = new Map(); // from -> to
  private reverseEdges: Map<string, Set<string>> = new Map(); // to -> from

  constructor(tasks: TaskDefinition[]) {
    tasks.forEach(t => this.addNode(t));
    tasks.forEach(t => {
      t.dependencies.forEach(depId => {
        this.addEdge(depId, t.id);
      });
    });
  }

  private addNode(task: TaskDefinition) {
    this.nodes.set(task.id, task);
    if (!this.edges.has(task.id)) this.edges.set(task.id, new Set());
    if (!this.reverseEdges.has(task.id)) this.reverseEdges.set(task.id, new Set());
  }

  private addEdge(fromId: string, toId: string) {
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) {
      throw new Error(`Edge invalid: missing node ${fromId} or ${toId}`);
    }
    this.edges.get(fromId)!.add(toId);
    this.reverseEdges.get(toId)!.add(fromId);
  }

  /**
   * 순환 참조(Cycle)를 감지합니다. 발견 시 사이클 경로를 반환합니다.
   */
  public detectCycle(): string[] | null {
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);
      path.push(nodeId);

      const neighbors = this.edges.get(nodeId) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          path.push(neighbor);
          return true; // Cycle found
        }
      }
      
      recStack.delete(nodeId);
      path.pop();
      return false;
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        if (dfs(nodeId)) {
          // 순환 경로만 잘라서 반환
          const cycleStart = path.indexOf(path[path.length - 1]);
          return path.slice(cycleStart);
        }
      }
    }
    return null;
  }

  /**
   * 위상 정렬된 Task ID 목록을 반환합니다. Cycle이 있으면 에러 발생.
   */
  public topologicalSort(): string[] {
    if (this.detectCycle()) {
      throw new Error('Graph has cycles, cannot topological sort.');
    }

    const inDegree = new Map<string, number>();
    for (const nodeId of this.nodes.keys()) {
      inDegree.set(nodeId, this.reverseEdges.get(nodeId)!.size);
    }

    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) queue.push(nodeId);
    }

    const result: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      const neighbors = this.edges.get(current) || new Set();
      for (const neighbor of neighbors) {
        inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    return result;
  }

  /**
   * 선행 결과 없이 도달할 수 없는 Task가 있는지 찾습니다.
   * (예: A가 B에 의존하는데 B가 Graph에 없는 경우. 생성자에서 이미 거르지만 재검증용)
   */
  public getMissingDependencies(): { taskId: string; missingDeps: string[] }[] {
    const missing: { taskId: string; missingDeps: string[] }[] = [];
    for (const task of this.nodes.values()) {
      const notFound = task.dependencies.filter(dep => !this.nodes.has(dep));
      if (notFound.length > 0) {
        missing.push({ taskId: task.id, missingDeps: notFound });
      }
    }
    return missing;
  }
}
