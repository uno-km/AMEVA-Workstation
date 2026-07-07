export interface PluginMetadata {
  id: string
  name: string
  description: string
  scriptUrl: string
  version: string
  type: 'tool' | 'feature' | 'collab'
}

export interface MarketplaceModalProps {
  isOpen: boolean
  onClose: () => void
  installedPlugins: string[]
  onInstallPlugin: (id: string, scriptUrl: string) => Promise<void>
  onUninstallPlugin: (id: string) => void
  isProPlan?: boolean
}
