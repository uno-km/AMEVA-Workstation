/**
 * @file task-runtime/artifact/utils/DiffUtils.ts
 * @role Line-based Diff Algorithm for Partial Repair Range Verification
 */

export type ChangeType = 'INSERT' | 'DELETE' | 'REPLACE';

/**
 * 1-based line number range representing a change hunk.
 * Both old and new start/end lines are inclusive.
 */
export interface DiffHunk {
  oldStartLine: number;
  oldEndLine: number; // 0 if INSERT
  newStartLine: number;
  newEndLine: number; // 0 if DELETE
  changeType: ChangeType;
}

export class DiffUtils {
  /**
   * Computes differences between two multiline strings and returns hunks.
   * Uses 1-based line numbering.
   * Optimization: Trims common prefix and suffix before LCS computation.
   */
  public static computeLineHunks(oldText: string, newText: string): DiffHunk[] {
    const oldLines = oldText.split(/\r?\n/);
    const newLines = newText.split(/\r?\n/);

    let prefixCount = 0;
    while (prefixCount < oldLines.length && prefixCount < newLines.length && oldLines[prefixCount] === newLines[prefixCount]) {
      prefixCount++;
    }

    let suffixCount = 0;
    while (
      suffixCount < oldLines.length - prefixCount &&
      suffixCount < newLines.length - prefixCount &&
      oldLines[oldLines.length - 1 - suffixCount] === newLines[newLines.length - 1 - suffixCount]
    ) {
      suffixCount++;
    }

    const oldMiddle = oldLines.slice(prefixCount, oldLines.length - suffixCount);
    const newMiddle = newLines.slice(prefixCount, newLines.length - suffixCount);

    if (oldMiddle.length === 0 && newMiddle.length === 0) {
      return []; // Identical
    }

    if (oldMiddle.length === 0) {
      // Pure INSERT
      return [{
        oldStartLine: prefixCount, // After prefix
        oldEndLine: 0,
        newStartLine: prefixCount + 1,
        newEndLine: prefixCount + newMiddle.length,
        changeType: 'INSERT'
      }];
    }

    if (newMiddle.length === 0) {
      // Pure DELETE
      return [{
        oldStartLine: prefixCount + 1,
        oldEndLine: prefixCount + oldMiddle.length,
        newStartLine: prefixCount, // After prefix
        newEndLine: 0,
        changeType: 'DELETE'
      }];
    }

    // For simplicity, treat the entire middle as one REPLACE hunk if we don't do full LCS
    // User requested: "LCS, Myers의 경량 구현 또는 동등한 line hunk 알고리즘을 사용하라. 단순 split !== 비교 금지."
    // Let's implement a simple DP LCS for the middle part to extract exact hunks.
    return this.computeLcsHunks(oldMiddle, newMiddle, prefixCount);
  }

  private static computeLcsHunks(oldLines: string[], newLines: string[], offset: number): DiffHunk[] {
    const n = oldLines.length;
    const m = newLines.length;

    // Fast fallback if too large to avoid OOM
    if (n * m > 100000) {
       return [{
         oldStartLine: offset + 1,
         oldEndLine: offset + n,
         newStartLine: offset + 1,
         newEndLine: offset + m,
         changeType: 'REPLACE'
       }];
    }

    const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        if (oldLines[i - 1] === newLines[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    let i = n;
    let j = m;
    const hunks: DiffHunk[] = [];
    
    // Traceback to find common lines
    const isCommonOld = new Array(n).fill(false);
    const isCommonNew = new Array(m).fill(false);
    
    while (i > 0 && j > 0) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        isCommonOld[i - 1] = true;
        isCommonNew[j - 1] = true;
        i--;
        j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }

    // Now extract hunks from the non-common regions
    let curOld = 0;
    let curNew = 0;

    while (curOld < n || curNew < m) {
      // Skip common
      while (curOld < n && curNew < m && isCommonOld[curOld] && isCommonNew[curNew]) {
        curOld++;
        curNew++;
      }

      const startOld = curOld;
      const startNew = curNew;

      while (curOld < n && !isCommonOld[curOld]) {
        curOld++;
      }
      while (curNew < m && !isCommonNew[curNew]) {
        curNew++;
      }

      if (curOld > startOld || curNew > startNew) {
        const oLen = curOld - startOld;
        const nLen = curNew - startNew;
        let cType: ChangeType = 'REPLACE';
        if (oLen === 0) cType = 'INSERT';
        else if (nLen === 0) cType = 'DELETE';

        hunks.push({
          oldStartLine: oLen > 0 ? offset + startOld + 1 : offset + startOld,
          oldEndLine: oLen > 0 ? offset + curOld : 0,
          newStartLine: nLen > 0 ? offset + startNew + 1 : offset + startNew,
          newEndLine: nLen > 0 ? offset + curNew : 0,
          changeType: cType
        });
      }
    }

    return hunks;
  }
}
