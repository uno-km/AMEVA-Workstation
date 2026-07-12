const fs = require('fs');
const path = require('path');

const filesToFix = [
  "task-runtime/__tests__/TaskRuntime.test.ts",
  "task-runtime/planning/__tests__/ActivationAndBudget.test.ts",
  "task-runtime/planning/__tests__/GraphAndCoverage.test.ts",
  "task-runtime/planning/activation/PlanActivationService.ts",
  "task-runtime/planning/domain/HandoverTypes.ts",
  "task-runtime/planning/domain/PlanningTypes.ts",
  "task-runtime/planning/goal/GoalValidator.ts",
  "task-runtime/planning/goal/RequirementExtractor.ts",
  "task-runtime/planning/graph/TaskGraph.ts",
  "task-runtime/planning/planner/PlanNormalizer.ts",
  "task-runtime/planning/validation/PlanValidator.ts",
  "task-runtime/state/TaskStateMachine.ts",
  "task-runtime/store/TaskRuntimeStore.ts"
];

const basePath = path.join(__dirname, 'packages/core/src/renderer/services/ai/orchestrator');

filesToFix.forEach(relPath => {
  const fullPath = path.join(basePath, relPath);
  if (!fs.existsSync(fullPath)) return;
  
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Replace import { Type1, Type2 } with import type { Type1, Type2 }
  // We need to be careful not to replace value imports. 
  // For these specific files, we know which ones to replace based on the IDE errors.
  
  const replacements = [
    ['import { TaskEntity', 'import type { TaskEntity'],
    ['import { TransitionCommand', 'import type { TransitionCommand'],
    ['import { TaskRuntimeState', 'import type { TaskRuntimeState'],
    ['import { TaskPlan', 'import type { TaskPlan'],
    ['import { GoalSpec', 'import type { GoalSpec'],
    ['import { TaskDefinition', 'import type { TaskDefinition'],
    ['import { Requirement', 'import type { Requirement'],
    ['import { PlanStatus', 'import type { PlanStatus'],
    ['import { PlanValidationResult', 'import type { PlanValidationResult'],
    ['import { ValidationIssue', 'import type { ValidationIssue'],
    ['import { TaskStatus', 'import type { TaskStatus'],
    ['import { TaskEvent', 'import type { TaskEvent']
  ];
  
  replacements.forEach(([from, to]) => {
    // Regex to handle spaces like `import { TaskEntity, ... }`
    // It's safer to just replace `import { Type` with `import type { Type` 
    // but wait, what if they are mixed? 
    // Let's use simple string replacement since these files are mostly type-only imports from domain types.
    const regex = new RegExp(`import\\s*\\{\\s*([^}]*?\\b${from.split(' ')[2]}\\b[^}]*?)\\s*\\}\\s*from`, 'g');
    content = content.replace(regex, 'import type { $1 } from');
  });
  
  fs.writeFileSync(fullPath, content, 'utf8');
});

console.log("Imports fixed.");
