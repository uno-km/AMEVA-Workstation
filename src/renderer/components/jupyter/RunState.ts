export interface RunState {
  hasRun: boolean
  success: boolean | null
  outputLines: { type: 'stdout' | 'stderr' | 'info'; text: string }[]
  tableData?: any
}
