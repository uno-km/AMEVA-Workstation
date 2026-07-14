/**
 * @file ExcelPlugin.ts
 * @system AMEVA OS Desktop Workstation
 * @location packages/core/src/renderer/plugins/ExcelPlugin.ts
 * @role Excel Viewer & Editor Plugin Lifecycle Manager
 */

import { useUIStore } from '../stores/useUIStore'

export const ExcelPlugin = {
  id: 'excel-viewer',
  name: 'Excel Viewer & Editor',
  onActivate: () => {
    useUIStore.getState().addDynamicMenu({
      id: 'excel-viewer',
      label: '엑셀 열기',
      action: () => {
        useUIStore.getState().setIsExcelModalOpen(true)
      }
    })
  },
  onDeactivate: () => {
    useUIStore.getState().removeDynamicMenu('excel-viewer')
  }
}
