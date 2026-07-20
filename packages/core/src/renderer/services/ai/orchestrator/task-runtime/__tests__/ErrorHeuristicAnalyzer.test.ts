import { ErrorHeuristicAnalyzer } from '../workbench/diagnostics/ErrorHeuristicAnalyzer';

describe('ErrorHeuristicAnalyzer', () => {
  it('should match TS1005 rule and extract TS snippet correctly', () => {
    const errorLog = `src/test.ts(3,5): error TS1005: ';' expected.`;
    const code = `function test() {\n  console.log("hello")\n}`;
    const result = ErrorHeuristicAnalyzer.analyze(errorLog, code, 'typescript');
    
    expect(result.matched).toBe(true);
    expect(result.ruleId).toBe('TS1005_SYNTAX');
    expect(result.extractedLineNumber).toBe(3);
    expect(result.extractedSnippet).toContain('>> 3: }');
  });

  it('should match IndentationError for python', () => {
    const errorLog = `  File "test.py", line 4\n    print("hello")\nIndentationError: unexpected indent`;
    const code = `def test():\n    a = 1\n     print("hello")`;
    const result = ErrorHeuristicAnalyzer.analyze(errorLog, code, 'python');
    
    expect(result.matched).toBe(true);
    expect(result.ruleId).toBe('PY_INDENT_ERROR');
    expect(result.extractedLineNumber).toBe(4);
  });

  it('should fallback to LLM for unknown errors and extract snippet', () => {
    const errorLog = `Traceback (most recent call last):\n  File "test.py", line 10, in <module>\nValueError: invalid literal for int()`;
    const code = Array(20).fill('line').map((l, i) => `${l}${i+1}`).join('\n');
    const result = ErrorHeuristicAnalyzer.analyze(errorLog, code, 'python');
    
    expect(result.matched).toBe(false);
    expect(result.analyzerUsed).toBe('LLM_FALLBACK');
    expect(result.extractedLineNumber).toBe(10);
    expect(result.extractedSnippet).toContain('>> 10: line10');
  });

  it('should restrict snippet size for large files', () => {
    const errorLog = `  File "test.py", line 50\nValueError: something went wrong`;
    const code = Array(100).fill('dummy').join('\n');
    const result = ErrorHeuristicAnalyzer.analyze(errorLog, code, 'python');
    
    expect(result.extractedLineNumber).toBe(50);
    // Snippet should be at most 25 lines (+/- 12 lines)
    expect(result.extractedSnippet?.split('\n').length).toBeLessThanOrEqual(25);
  });
});
