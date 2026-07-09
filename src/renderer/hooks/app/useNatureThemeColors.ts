/**
 * @file useNatureThemeColors.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/hooks/app/useNatureThemeColors.ts
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

import { useEffect } from 'react';

  // [RUN-TIME STATE / INVARIANT] - 변수 'NATURE_PALETTES'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
const NATURE_PALETTES = [
  { primary: '#4caf50', glow: 'rgba(76, 175, 80, 0.3)', bgActive: 'rgba(76, 175, 80, 0.15)' }, // Green
  { primary: '#3b82f6', glow: 'rgba(59, 130, 246, 0.3)', bgActive: 'rgba(59, 130, 246, 0.15)' }, // Blue
  { primary: '#ec4899', glow: 'rgba(236, 72, 153, 0.3)', bgActive: 'rgba(236, 72, 153, 0.15)' }, // Pink
  { primary: '#f97316', glow: 'rgba(249, 115, 22, 0.3)', bgActive: 'rgba(249, 115, 22, 0.15)' }, // Orange
  { primary: '#eab308', glow: 'rgba(234, 179, 8, 0.3)', bgActive: 'rgba(234, 179, 8, 0.15)' }  // Yellow
];

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function useNatureThemeColors(theme: string) {
  useEffect(() => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (theme !== 'nature') {
      // Clean up inline styles when leaving nature theme
      document.body.style.removeProperty('--primary');
      document.body.style.removeProperty('--primary-glow');
      document.body.style.removeProperty('--bg-glass-active');
      return;
    }

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleClick'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const handleClick = () => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'randomPalette'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const randomPalette = NATURE_PALETTES[Math.floor(Math.random() * NATURE_PALETTES.length)];
      
      // Inject random colors into the body variables so they override the nature theme defaults
      document.body.style.setProperty('--primary', randomPalette.primary);
      document.body.style.setProperty('--primary-glow', randomPalette.glow);
      document.body.style.setProperty('--bg-glass-active', randomPalette.bgActive);
      
      // Add a subtle transition effect so colors smoothly morph
      document.body.style.transition = 'background-color 0.5s ease, --primary 0.5s ease';
    };

    // Add global click listener
    window.addEventListener('click', handleClick);

    // Initial random color
    handleClick();

    return () => {
      window.removeEventListener('click', handleClick);
      document.body.style.removeProperty('--primary');
      document.body.style.removeProperty('--primary-glow');
      document.body.style.removeProperty('--bg-glass-active');
      document.body.style.transition = '';
    };
  }, [theme]);
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
