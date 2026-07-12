import { describe, it } from 'node:test';
import assert from 'node:assert';
import { StrictPlanParser } from '../planner/StrictPlanParser';

describe('ParserSecurity', () => {
  const parser = new StrictPlanParser();

  it('should reject prototype pollution attempts', () => {
    const maliciousJson = `
    \`\`\`json
    {
      "__proto__": { "polluted": true },
      "tasks": []
    }
    \`\`\`
    `;
    const result = parser.parse(maliciousJson);
    assert.strictEqual(result.success, false);
    assert.ok(result.parseErrors.some(e => e.toLowerCase().includes('proto')));
  });

  it('should handle large and excessively deep json safely', () => {
    const deepObj = '{ "tasks": [ ' + '{"dependencies":'.repeat(15) + '[]' + '}'.repeat(15) + ' ] }';
    const json = `\`\`\`json\n${deepObj}\n\`\`\``;
    const result = parser.parse(json);
    assert.strictEqual(result.success, false);
    assert.ok(result.parseErrors.some(e => e.includes('deep')));
  });

  it('should reject missing or invalid tasks array', () => {
    const invalidJson = `\`\`\`json\n{ "tasks": {} }\n\`\`\``;
    const result = parser.parse(invalidJson);
    assert.strictEqual(result.success, false);
    assert.ok(result.parseErrors.some(e => e.includes('valid tasks array')));
  });
});
