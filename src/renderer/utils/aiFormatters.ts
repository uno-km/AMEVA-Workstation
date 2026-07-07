export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)}MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`
}

export interface ThoughtNode {
  id: string
  title: string
  level: number
  isHeader: boolean
  children: ThoughtNode[]
  status: 'completed' | 'running' | 'pending'
}

export function parseThoughtText(text: string, isStreaming: boolean): ThoughtNode[] {
  const lines = text.split('\n')
  const roots: ThoughtNode[] = []
  const stack: ThoughtNode[] = []
  let nodeIdCounter = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    // Detect indentation level (number of spaces or tabs)
    const leadingWhitespace = line.match(/^(\s*)/)?.[0] || ''
    const indentWidth = leadingWhitespace.replace(/\t/g, '    ').length

    const trimmed = line.trim()
    
    // Check if it's a section header, e.g. [Header Name]
    const headerMatch = trimmed.match(/^\[([^\]]+)\]$/)
    
    if (headerMatch) {
      const title = headerMatch[1].trim()
      const node: ThoughtNode = {
        id: `thought_node_${nodeIdCounter++}`,
        title,
        level: 0,
        isHeader: true,
        children: [],
        status: 'completed',
      }
      roots.push(node)
      stack.length = 0 // Clear stack for new section
      stack.push(node)
    } else {
      // It's a step item
      // Clean bullet points: -, *, +, 1., 2. etc.
      const content = trimmed.replace(/^[-*+]\s+|^[0-9]+[.)]\s+/, '').trim()
      if (!content) continue

      let level = 1
      if (indentWidth > 0) {
        level = Math.floor(indentWidth / 2) + 1
      }

      const node: ThoughtNode = {
        id: `thought_node_${nodeIdCounter++}`,
        title: content,
        level,
        isHeader: false,
        children: [],
        status: 'completed',
      }

      // Find parent in stack
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop()
      }

      if (stack.length > 0) {
        stack[stack.length - 1].children.push(node)
      } else {
        roots.push(node)
      }
      stack.push(node)
    }
  }

  // Adjust statuses if streaming
  if (isStreaming) {
    let lastLeaf: ThoughtNode | null = null
    
    function findLastLeaf(nodes: ThoughtNode[]) {
      if (nodes.length === 0) return
      lastLeaf = nodes[nodes.length - 1]
      if (lastLeaf.children && lastLeaf.children.length > 0) {
        findLastLeaf(lastLeaf.children)
      }
    }
    
    findLastLeaf(roots)
    
    if (lastLeaf) {
      (lastLeaf as ThoughtNode).status = 'running'
      
      // Mark parent chain as running
      function markParentChain(nodes: ThoughtNode[]): boolean {
        let hasRunningChild = false
        for (const node of nodes) {
          const childRunning = markParentChain(node.children)
          if (node.status === 'running' || childRunning) {
            node.status = 'running'
            hasRunningChild = true
          }
        }
        return hasRunningChild
      }
      markParentChain(roots)
    }
  }

  return roots
}

export function getThoughtSummary(text: string, isStreaming: boolean) {
  const nodes = parseThoughtText(text, isStreaming)
  let totalSteps = 0
  let completedSteps = 0
  
  function count(items: ThoughtNode[]) {
    for (const n of items) {
      if (!n.isHeader) {
        totalSteps++
        if (n.status === 'completed') {
          completedSteps++
        }
      }
      if (n.children) {
        count(n.children)
      }
    }
  }
  count(nodes)
  
  const activeStep = isStreaming ? completedSteps + 1 : totalSteps
  return { totalSteps, completedSteps, activeStep }
}
