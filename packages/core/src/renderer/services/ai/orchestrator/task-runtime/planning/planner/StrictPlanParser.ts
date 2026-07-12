/**
 * @file orchestrator/task-runtime/planning/planner/StrictPlanParser.ts
 * @system AMEVA OS Desktop Workstation
 */

import { PlanParsingError } from '../domain/PlanningErrors';

export interface ParseResult {
  success: boolean;
  parsedData?: any;
  parseErrors: string[];
}

export class StrictPlanParser {
  /**
   * LLM 출력을 방어적으로 파싱합니다.
   * - 코드 펜스 제거
   * - 앞뒤 텍스트 제거
   * - JSON.parse 중첩 방지
   */
  public parse(rawOutput: string): ParseResult {
    let jsonStr = rawOutput.trim();
    const errors: string[] = [];

    // 1. 코드펜스 제거
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      jsonStr = match[1].trim();
    } else {
      // 코드펜스가 없더라도 { 또는 [ 로 시작하는 지점부터 자르기
      const firstBrace = jsonStr.indexOf('{');
      const firstBracket = jsonStr.indexOf('[');
      const startIdx = (firstBrace !== -1 && firstBracket !== -1)
        ? Math.min(firstBrace, firstBracket)
        : Math.max(firstBrace, firstBracket);
        
      if (startIdx !== -1) {
        jsonStr = jsonStr.substring(startIdx);
      }
    }

    try {
      const parsedData = JSON.parse(jsonStr);
      
      // Prototype pollution 방어
      if (this.hasPrototypePollution(parsedData)) {
        throw new PlanParsingError('Prototype pollution detected in planner output');
      }

      // Depth 방어
      if (this.getMaxDepth(parsedData) > 10) {
        throw new PlanParsingError('JSON structure is too deep.');
      }

      // 기본 구조 방어 (tasks 필드 또는 배열 확인)
      if (typeof parsedData !== 'object' || parsedData === null) {
        throw new PlanParsingError('JSON root must be an object or array.');
      }
      
      let tasksArray = parsedData;
      if (!Array.isArray(parsedData)) {
        if (!Array.isArray(parsedData.tasks)) {
           throw new PlanParsingError('JSON must contain a valid tasks array.');
        }
        tasksArray = parsedData.tasks;
      }

      return {
        success: true,
        parsedData: tasksArray,
        parseErrors: []
      };
    } catch (error: any) {
      errors.push(`JSON Parse/Validation failed: ${error.message}`);
      return {
        success: false,
        parseErrors: errors
      };
    }
  }

  private getMaxDepth(obj: any, currentDepth = 1): number {
    if (typeof obj !== 'object' || obj === null) return currentDepth;
    let max = currentDepth;
    for (const key in obj) {
       const depth = this.getMaxDepth(obj[key], currentDepth + 1);
       if (depth > max) max = depth;
    }
    return max;
  }

  private hasPrototypePollution(obj: any): boolean {
    if (typeof obj !== 'object' || obj === null) return false;
    if (obj.hasOwnProperty('__proto__') || obj.hasOwnProperty('constructor') || obj.hasOwnProperty('prototype')) {
      return true;
    }
    for (const key in obj) {
      if (this.hasPrototypePollution(obj[key])) return true;
    }
    return false;
  }
}
