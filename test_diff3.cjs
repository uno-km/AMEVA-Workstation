const fs = require('fs');

class DiffUtils {
  static computeLineHunks(oldText, newText) {
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

    if (oldMiddle.length === 0 && newMiddle.length === 0) return [];
    if (oldMiddle.length === 0) return [{ oldStartLine: prefixCount, oldEndLine: 0, newStartLine: prefixCount + 1, newEndLine: prefixCount + newMiddle.length, changeType: 'INSERT' }];
    if (newMiddle.length === 0) return [{ oldStartLine: prefixCount + 1, oldEndLine: prefixCount + oldMiddle.length, newStartLine: prefixCount, newEndLine: 0, changeType: 'DELETE' }];
    return this.computeLcsHunks(oldMiddle, newMiddle, prefixCount);
  }

  static computeLcsHunks(oldLines, newLines, offset) {
    const n = oldLines.length;
    const m = newLines.length;
    if (n * m > 100000) return [{ oldStartLine: offset + 1, oldEndLine: offset + n, newStartLine: offset + 1, newEndLine: offset + m, changeType: 'REPLACE' }];

    const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        if (oldLines[i - 1] === newLines[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
        else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }

    let i = n, j = m;
    const hunks = [];
    const isCommonOld = new Array(n).fill(false);
    const isCommonNew = new Array(m).fill(false);
    
    while (i > 0 && j > 0) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        isCommonOld[i - 1] = true;
        isCommonNew[j - 1] = true;
        i--; j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) i--;
      else j--;
    }

    let curOld = 0, curNew = 0;
    while (curOld < n || curNew < m) {
      while (curOld < n && curNew < m && isCommonOld[curOld] && isCommonNew[curNew]) { curOld++; curNew++; }
      const startOld = curOld, startNew = curNew;
      while (curOld < n && !isCommonOld[curOld]) curOld++;
      while (curNew < m && !isCommonNew[curNew]) curNew++;

      if (curOld > startOld || curNew > startNew) {
        const oLen = curOld - startOld;
        const nLen = curNew - startNew;
        let cType = 'REPLACE';
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

console.log(DiffUtils.computeLineHunks('line1\nline2\nline3\nline4\nline5', 'line 1\nline 2\nline 3\nCHANGED 4\nline 5'));
