import { useProcessStore } from '../stores/useProcessStore';

export interface PluginInterface {
  id: string;
  name: string;
  onActivate: () => void;
  onDeactivate: () => void;
}

/**
 * 플러그인 매니저 훅 (고도화 모듈)
 * 미사용 중이던 activePlugins 상태를 활용하여,
 * 향후 동적 플러그인 로드 및 관리를 위한 기반 아키텍처를 제공합니다.
 */
export function usePluginManager(availablePlugins: PluginInterface[]) {
  const { activePlugins, setActivePlugins } = useProcessStore();

  const togglePlugin = (pluginId: string) => {
    const isActive = activePlugins.includes(pluginId);
    if (isActive) {
      setActivePlugins(activePlugins.filter(id => id !== pluginId));
      const plugin = availablePlugins.find(p => p.id === pluginId);
      if (plugin) plugin.onDeactivate();
    } else {
      setActivePlugins([...activePlugins, pluginId]);
      const plugin = availablePlugins.find(p => p.id === pluginId);
      if (plugin) plugin.onActivate();
    }
  };

  const isPluginActive = (pluginId: string) => activePlugins.includes(pluginId);

  return { togglePlugin, isPluginActive };
}
