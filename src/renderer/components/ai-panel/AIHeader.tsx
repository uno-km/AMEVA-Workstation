import React from 'react';
import { Sparkles, Terminal, Settings2, X } from 'lucide-react';
import type { AISettings } from '../../hooks/useAI';

/**
 * AIHeaderProps 인터페이스 정의
 * 이 인터페이스는 AIHeader 컴포넌트가 부모 컴포넌트로부터 전달받아야 하는 모든 속성(Props)의 타입을 명시합니다.
 * 컴포넌트 간의 결합도를 낮추기 위해 필요한 상태와 콜백 함수만을 명시적으로 주입받도록 설계되었습니다.
 * 예상되는 값: apiType은 'wasm', 'api', 'ollama', 'local' 중 하나이며, gpuOnly는 boolean 값입니다.
 */
export interface AIHeaderProps {
  apiType?: string;
  gpuOnly?: boolean;
  apiProvider?: string;
  isAvailable: boolean;
  models: { name: string; filename: string; path: string; size: number }[];
  settings: AISettings;
  showLogs: boolean;
  setShowLogs: (val: boolean) => void;
  showSettings: boolean;
  setShowSettings: (val: boolean) => void;
  onClose: () => void;
}

/**
 * AIHeader 컴포넌트
 * 이 컴포넌트는 AIPanel의 최상단 헤더 영역을 렌더링하며, 모델 상태 표시자 및 제어 버튼들을 포함합니다.
 * 외부 상태에 직접 의존하지 않고 전달받은 Props만을 사용하여 렌더링되므로, 독립적인 재사용이 가능합니다.
 * 예상되는 값: 유효한 AIHeaderProps 객체가 전달되면 정상적인 ReactNode를 반환합니다.
 */
export const AIHeader: React.FC<AIHeaderProps> = ({
  apiType,
  gpuOnly,
  apiProvider,
  isAvailable,
  models,
  settings,
  showLogs,
  setShowLogs,
  showSettings,
  setShowSettings,
  onClose
}) => {
  /**
   * getApiTypeLabel 함수
   * 현재 설정된 API 타입에 따라 적절한 UI 라벨 문자열을 반환합니다.
   * 이는 렌더링 로직 내에 삼항 연산자가 복잡하게 중첩되는 것을 방지하기 위한 추상화 함수입니다.
   * 예상되는 값: apiType이 'wasm'이면 'WebGPU WASM'을 반환합니다.
   */
  const getApiTypeLabel = (type?: string): string => {
    // API 타입이 'wasm'인지 확인하는 조건문입니다.
    // 'wasm'은 브라우저 내부에서 WebAssembly를 통해 구동됨을 의미합니다.
    // 만약 type === 'wasm' 이 true 라면, WebGPU WASM 문자열을 반환하여 UI에 표시합니다.
    // 예상되는 값: type 파라미터가 'wasm'일 경우 'WebGPU WASM' 반환.
    if (type === 'wasm') {
      return 'WebGPU WASM';
    }
    
    // API 타입이 'api'인지 확인하는 조건문입니다.
    // 'api'는 외부 클라우드 서비스 기능을 사용함을 의미합니다.
    // 만약 type === 'api' 가 true 라면, Cloud API 문자열을 반환합니다.
    // 예상되는 값: type 파라미터가 'api'일 경우 'Cloud API' 반환.
    if (type === 'api') {
      return 'Cloud API';
    }
    
    // API 타입이 'ollama'인지 확인하는 조건문입니다.
    // 'ollama'는 로컬 호스트 백그라운드 서비스인 Ollama를 사용함을 의미합니다.
    // 만약 type === 'ollama' 가 true 라면, Ollama 문자열을 반환합니다.
    // 예상되는 값: type 파라미터가 'ollama'일 경우 'Ollama' 반환.
    if (type === 'ollama') {
      return 'Ollama';
    }
    
    // 위의 어떠한 조건에도 해당하지 않는 경우의 기본 반환값입니다.
    // 기본적으로 애플리케이션에 내장된 Native Core를 사용하는 것으로 간주합니다.
    // 모든 분기 처리에 실패했을 때 안전하게 대비하기 위한 폴백 메커니즘입니다.
    // 예상되는 값: type 파라미터가 'local'이거나 undefined일 경우 'Native Core' 반환.
    return 'Native Core';
  };

  /**
   * getApiTypeBackground 함수
   * API 타입에 따라 배지의 배경 그라데이션 색상을 반환합니다.
   * 시각적 구분을 명확히 하기 위해 각 구동 방식마다 고유한 색상 테마를 부여합니다.
   * 예상되는 값: apiType이 'wasm'이면 파란색 계열의 선형 그라데이션 CSS 문자열을 반환합니다.
   */
  const getApiTypeBackground = (type?: string): string => {
    // API 타입이 'wasm'인지 검사하여 파란색 계열 배경을 적용합니다.
    // 디자인 시스템의 규칙에 따라 WebGPU 기반 처리는 차가운 계열 색상으로 표현합니다.
    // 조건을 만족하면 CSS linear-gradient 값을 즉시 반환합니다.
    // 예상되는 값: type === 'wasm' 일 때 'linear-gradient(135deg, #0284c7, #0369a1)' 반환.
    if (type === 'wasm') {
      return 'linear-gradient(135deg, #0284c7, #0369a1)';
    }

    // API 타입이 'api'인지 검사하여 보라색 계열 배경을 적용합니다.
    // 클라우드 API 호출은 외부에 데이터를 전송하므로 특별한 색상인 보라색으로 강조합니다.
    // 조건을 만족하면 CSS linear-gradient 값을 즉시 반환합니다.
    // 예상되는 값: type === 'api' 일 때 'linear-gradient(135deg, #7c3aed, #6d28d9)' 반환.
    if (type === 'api') {
      return 'linear-gradient(135deg, #7c3aed, #6d28d9)';
    }

    // API 타입이 'ollama'인지 검사하여 주황색 계열 배경을 적용합니다.
    // Ollama 공식 로고 색상과 유사한 주황색을 사용하여 사용자의 인지성을 높입니다.
    // 조건을 만족하면 CSS linear-gradient 값을 즉시 반환합니다.
    // 예상되는 값: type === 'ollama' 일 때 'linear-gradient(135deg, #f97316, #ea580c)' 반환.
    if (type === 'ollama') {
      return 'linear-gradient(135deg, #f97316, #ea580c)';
    }

    // 기본값으로 초록색 계열 배경을 적용하는 구문입니다.
    // 기본 탑재 엔진은 가장 안전하고 기본적인 방식이므로 안정성을 상징하는 초록색을 사용합니다.
    // 다른 모든 조건이 거짓일 때 최종적으로 반환되는 값입니다.
    // 예상되는 값: 그 외 모든 경우 'linear-gradient(135deg, #16a34a, #15803d)' 반환.
    return 'linear-gradient(135deg, #16a34a, #15803d)';
  };

  /**
   * getModelDescription 함수
   * 현재 연결된 모델의 상태나 제공자 정보를 설명하는 문자열을 생성합니다.
   * 복잡한 삼항 연산자를 해체하여 가독성을 높이고 유지보수를 용이하게 만듭니다.
   * 예상되는 값: apiType이 'api'이고 apiProvider가 'openai'이면 'OpenAI GPT 연결됨' 반환.
   */
  const getModelDescription = (): string => {
    // API 타입이 'api'인 경우 클라우드 제공자 정보를 분석하는 조건문입니다.
    // 내부적으로 어떤 벤더의 API를 사용하는지에 따라 상세 문자열을 분기 처리합니다.
    // 이 조건문이 참이면 내부의 추가적인 분기 로직이 실행됩니다.
    // 예상되는 값: apiType === 'api' 일 경우 내부 블록 진입.
    if (apiType === 'api') {
      // 제공자가 'gemini'인지 확인하는 조건문입니다.
      // Google 시스템 API가 선택되었음을 사용자에게 명확히 고지합니다.
      // 조건이 일치하면 해당하는 문자열을 조립하여 반환합니다.
      // 예상되는 값: apiProvider === 'gemini' 일 때 'Google Gemini 연결됨' 반환.
      if (apiProvider === 'gemini') return 'Google Gemini 연결됨';
      
      // 제공자가 'anthropic'인지 확인하는 조건문입니다.
      // Claude 모델을 사용 중임을 인터페이스를 통해 사용자에게 안내하기 위한 처리입니다.
      // 조건이 일치하면 해당하는 문자열을 조립하여 반환합니다.
      // 예상되는 값: apiProvider === 'anthropic' 일 때 'Anthropic Claude 연결됨' 반환.
      if (apiProvider === 'anthropic') return 'Anthropic Claude 연결됨';
      
      // 제공자가 'openai'인지 확인하는 조건문입니다.
      // 가장 보편적인 외부 모델의 연결 상태를 표시하는 구문입니다.
      // 조건이 일치하면 해당하는 문자열을 조립하여 반환합니다.
      // 예상되는 값: apiProvider === 'openai' 일 때 'OpenAI GPT 연결됨' 반환.
      if (apiProvider === 'openai') return 'OpenAI GPT 연결됨';
      
      // 알 수 없거나 커스텀된 클라우드 제공자일 경우의 기본 반환값입니다.
      // 시스템에 명시적으로 등록되지 않은 제공자 문자열에 대한 예외 처리입니다.
      // 조건 분기에 모두 실패했을 때 반환됩니다.
      // 예상되는 값: 제공자가 식별되지 않으면 'Custom Cloud API 연결됨' 반환.
      return 'Custom Cloud API 연결됨';
    }

    // API 타입이 'ollama'인 경우를 처리하는 조건문입니다.
    // 별도의 상세 모델명 파싱 없이 백그라운드 서비스 동작 중임을 포괄적으로 안내합니다.
    // 이 조건문이 참이면 즉시 문자열을 반환하고 함수 실행을 종료합니다.
    // 예상되는 값: apiType === 'ollama' 일 때 'Ollama 서비스' 반환.
    if (apiType === 'ollama') {
      return 'Ollama 로컬 백그라운드 서비스';
    }

    // 모델 리스트가 사용 가능한 상태인지 확인하는 조건문입니다.
    // 로컬 시스템에 모델 파일들이 정상적으로 로드되었는지 여부를 판단합니다.
    // 참일 경우, 현재 설정된 경로와 일치하는 모델 객체를 탐색합니다.
    // 예상되는 값: isAvailable === true 일 때 모델 검색 로직 실행.
    if (isAvailable) {
      const activeModel = models.find(m => m.path === settings.modelPath);
      // 탐색된 활성 모델 객체가 존재하는지 확인하는 조건문입니다.
      // 설정 파일의 경로와 일치하는 모델 객체를 찾았다면 그 이름을 반환합니다.
      // 만약 배열 내에 해당 객체가 없다면 기본 안내 문구를 반환합니다.
      // 예상되는 값: activeModel이 존재하면 해당 객체의 name 속성값 반환, 아니면 '모델을 선택하세요' 반환.
      if (activeModel) {
        return activeModel.name;
      }
      return '모델을 선택하세요';
    }

    // 모델 파일이 준비되지 않았거나 시스템 초기화 중일 때의 기본 반환값입니다.
    // 사용자에게 시스템이 현재 모델 데이터를 사용할 수 없는 상태임을 명시적으로 알립니다.
    // 모든 조건을 통과하고 남은 마지막 실행 흐름입니다.
    // 예상되는 값: isAvailable이 거짓인 경우 '검색 필요' 반환.
    return '로컬 모델 검색 필요';
  };

  // 로컬 구동 여부를 판단하여 배지 렌더링에 사용할 논리 변수입니다.
  const isLocalEngine = apiType === 'local' || apiType === 'ollama';

  return (
    <div style={{
      padding: '14px 16px 10px',
      borderBottom: '1px solid var(--border-muted)',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      flexShrink: 0,
      flexWrap: 'nowrap',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      <div style={{
        width: '28px', height: '28px', borderRadius: '8px',
        background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 12px var(--primary-glow)',
        flexShrink: 0,
      }}>
        <Sparkles size={14} color="#fff" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.3px', flexShrink: 0 }}>
            AMEVA <span style={{ color: 'var(--primary)' }}>AI</span>
          </span>
          <span style={{
            fontSize: '8px', fontWeight: 800, padding: '1px 4px', borderRadius: '4px',
            color: '#fff',
            flexShrink: 0,
            background: getApiTypeBackground(apiType)
          }}>
            {getApiTypeLabel(apiType)}
          </span>
          
          {/* 로컬 또는 Ollama 엔진일 때만 하드웨어 가속 상태를 렌더링하는 조건부 렌더링 블록입니다. */}
          {/* 외부 클라우드를 사용할 때는 로컬 자원을 쓰지 않으므로 이 배지를 숨겨야 합니다. */}
          {/* 예상되는 값: isLocalEngine이 참일 때 span 요소 렌더링. */}
          {isLocalEngine && (
            <span style={{
              fontSize: '8px', fontWeight: 800, padding: '1px 4px', borderRadius: '4px',
              color: '#fff',
              flexShrink: 0,
              background: gpuOnly
                ? 'linear-gradient(135deg, #a855f7, #7c3aed)'
                : 'linear-gradient(135deg, #4b5563, #374151)',
            }}>
              {/* gpuOnly 속성에 따라 GPU 가속 여부 문자열을 다르게 출력하는 삼항 연산자입니다. */}
              {gpuOnly ? 'GPU 가속' : 'CPU 연산'}
            </span>
          )}
        </div>
        <div style={{ fontSize: '9px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
          {getModelDescription()}
        </div>
      </div>

      {/* 로컬 엔진일 경우에만 터미널 로그 보기 버튼을 렌더링하는 조건부 블록입니다. */}
      {/* 클라우드 통신일 경우 내부 시스템 로그가 제한적이므로 버튼 노출을 제한합니다. */}
      {/* 예상되는 값: isLocalEngine이 참일 때 button 요소 렌더링. */}
      {isLocalEngine && (
        <button
          onClick={() => setShowLogs(!showLogs)}
          style={{
            background: showLogs ? 'var(--bg-glass-active)' : 'transparent',
            border: 'none', cursor: 'pointer',
            color: showLogs ? 'var(--primary)' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center',
            padding: '4px', borderRadius: '5px', transition: 'all 0.15s',
            marginRight: '2px',
            flexShrink: 0,
          }}
          title="시스템 터미널 로그 감시"
        >
          <Terminal size={14} />
        </button>
      )}
      <button
        onClick={() => setShowSettings(!showSettings)}
        style={{
          background: showSettings ? 'var(--bg-glass-active)' : 'transparent',
          border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
          padding: '4px', borderRadius: '5px', transition: 'all 0.15s',
          flexShrink: 0,
        }}
        title="환경 설정 메뉴"
      >
        <Settings2 size={14} />
      </button>
      <button
        onClick={onClose}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
          padding: '4px', borderRadius: '5px',
          flexShrink: 0,
        }}
        title="패널 닫기"
      >
        <X size={14} />
      </button>
    </div>
  );
};
