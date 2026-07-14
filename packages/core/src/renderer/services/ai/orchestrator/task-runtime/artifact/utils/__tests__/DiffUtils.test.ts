import { describe, it, expect } from 'vitest';
import { DiffUtils } from '../DiffUtils';

describe('DiffUtils', () => {
  it('identifies identical text', () => {
    const hunks = DiffUtils.computeLineHunks('a\nb\nc', 'a\nb\nc');
    expect(hunks).toHaveLength(0);
  });

  it('identifies single line replace', () => {
    const hunks = DiffUtils.computeLineHunks('a\nb\nc', 'a\nx\nc');
    expect(hunks).toEqual([
      { oldStartLine: 2, oldEndLine: 2, newStartLine: 2, newEndLine: 2, changeType: 'REPLACE' }
    ]);
  });

  it('identifies line insert in middle', () => {
    const hunks = DiffUtils.computeLineHunks('a\nc', 'a\nb\nc');
    expect(hunks).toEqual([
      { oldStartLine: 1, oldEndLine: 0, newStartLine: 2, newEndLine: 2, changeType: 'INSERT' }
    ]);
  });

  it('identifies line delete in middle', () => {
    const hunks = DiffUtils.computeLineHunks('a\nb\nc', 'a\nc');
    expect(hunks).toEqual([
      { oldStartLine: 2, oldEndLine: 2, newStartLine: 1, newEndLine: 0, changeType: 'DELETE' }
    ]);
  });

  it('identifies multiple disconnected changes', () => {
    const hunks = DiffUtils.computeLineHunks('1\n2\n3\n4\n5\n6\n7', '1\nx\n3\n4\n5\ny\n7');
    expect(hunks).toEqual([
      { oldStartLine: 2, oldEndLine: 2, newStartLine: 2, newEndLine: 2, changeType: 'REPLACE' },
      { oldStartLine: 6, oldEndLine: 6, newStartLine: 6, newEndLine: 6, changeType: 'REPLACE' }
    ]);
  });

  it('identifies changes at start and end', () => {
    const hunks = DiffUtils.computeLineHunks('1\n2\n3', 'x\n2\ny');
    expect(hunks).toEqual([
      { oldStartLine: 1, oldEndLine: 1, newStartLine: 1, newEndLine: 1, changeType: 'REPLACE' },
      { oldStartLine: 3, oldEndLine: 3, newStartLine: 3, newEndLine: 3, changeType: 'REPLACE' }
    ]);
  });

  it('handles insert in empty file', () => {
    const hunks = DiffUtils.computeLineHunks('', 'hello\nworld');
    // For empty file split(/\r?\n/) returns [''], length 1
    // Wait! Let's check how it handles it.
    // If old is '', lines=['']. new is 'a\nb', lines=['a', 'b'].
    expect(hunks.length).toBe(1);
    expect(hunks[0].changeType).toBe('REPLACE');
  });

  it('handles delete all', () => {
    const hunks = DiffUtils.computeLineHunks('a\nb\nc', '');
    expect(hunks.length).toBe(1);
    expect(hunks[0].changeType).toBe('REPLACE');
  });
});
