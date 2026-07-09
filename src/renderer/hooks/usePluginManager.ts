/**
 * @file usePluginManager.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/hooks/usePluginManager.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): 최상위 Facade 구조에 통합 마운트.
 * - 소비처 B (src/renderer/contexts/AppContext.tsx): 리액트 Context 훅 목록에 바인딩되어 하위 뷰에 전파.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

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
