/**
 * @file constants.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/ai/constants.ts
 * @role Domain-specific local constants for Utility Tabs & Finance views (3-Tier Constants Rule)
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/components/ai/FinanceDashboardView.tsx): 주식별 Mock 뉴스 목록 제공.
 * - 소비처 B (src/renderer/components/AIPanel.tsx): Non-AI 탭 한글 라벨링 및 하이라이트 스타일 제공.
 */

/**
 * [UTILITY_TAB_LABELS]
 * - 자료형: Record<string, string>
 * - 용도: AI 패널이 아닌 각 유틸리티 탭 ID에 대응하는 사용자 친화적 한글 이름 매핑.
 */
export const UTILITY_TAB_LABELS: Record<string, string> = {
  outline: '문서 구조도 (TOC)',
  calculator: '계산기 도구',
  finance: '주식/환율 정보센터',
  'finance-dashboard': '주식/환율 정보센터',
  youtube: 'YouTube 동영상',
  naver: '네이버 포털',
  google: '구글 검색',
  calendar: '스케줄 캘린더',
  'google-drive': '구글 드라이브',
  'google-maps': '구글 지도'
};

/**
 * [HIGHLIGHT_STYLE]
 * - 자료형: React.CSSProperties
 * - 용도: 검색 하이라이팅 `<mark>` 엘리먼트에 강제 주입되는 스타일 정의.
 */
export const HIGHLIGHT_STYLE: React.CSSProperties = {
  backgroundColor: 'rgba(250, 204, 21, 0.4)', // 반투명 옐로우 틴트
  color: '#ffffff',
  borderRadius: '2px',
  borderBottom: '2px solid #facc15', // 확실한 언더라인 표시
  padding: '1px 0px',
  transition: 'background-color 0.15s ease',
  boxShadow: '0 0 4px rgba(250, 204, 21, 0.4)'
};

/**
 * [STOCK_MOCK_NEWS]
 * - 자료형: Record<string, Array<{ id: string; title: string; source: string; time: string; summary: string }>>
 * - 용도: 주식 탭 아코디언 확장 시 노출될 종목/지수별 실시간 금융 뉴스 템플릿 목록.
 */
export const STOCK_MOCK_NEWS: Record<string, Array<{
  id: string;
  title: string;
  source: string;
  time: string;
  summary: string;
}>> = {
  '^GSPC': [
    {
      id: 'gspc-1',
      title: 'S&P 500, 연준 금리 인하 기대감에 사상 최고가 랠리 지속',
      source: '블룸버그 파이낸셜',
      time: '10분 전',
      summary: '제롬 파월 연준 의장의 완화적 발언으로 금리 인하 사이클 도래 확신이 선 미국 증시가 테크 중심의 매수세에 힘입어 사상 최고치 경신 행진을 달리고 있습니다.'
    },
    {
      id: 'gspc-2',
      title: '인플레이션 지표 둔화 속 월가 기관들 "추가 상승 여력 충분"',
      source: '로이터 통신',
      time: '1시간 전',
      summary: '근원 소비자물가지수(CPI)가 예상을 하회하면서 거시 경제 불확실성이 해소되는 양상입니다. 골드만삭스를 비롯한 주요 IB는 S&P 500의 연말 목표치를 상향 조정했습니다.'
    }
  ],
  '^IXIC': [
    {
      id: 'ixic-1',
      title: '나스닥, 빅테크 강세 업고 20,000포인트 돌파 가시화',
      source: 'WSJ 테크',
      time: '5분 전',
      summary: '엔비디아, 애플, 마이크로소프트의 삼각 편대가 전반적인 인공지능(AI) 반도체 붐을 견인하고 있습니다. 나스닥 100 지수는 전일 대비 1.8% 상승 마감했습니다.'
    },
    {
      id: 'ixic-2',
      title: '중소형 기술주로도 AI 온기 확산... 중저가 반도체 장비 수요 급증',
      source: '마켓워치',
      time: '2시간 전',
      summary: '초대형 AI 가속기 위주의 상승장이 레거시 반도체 공급망 부품 사들로 넓어지며 나스닥 내 중소형 테크 스타트업들의 기업 가치가 동반 우상향하고 있습니다.'
    }
  ],
  '^KS11': [
    {
      id: 'ks11-1',
      title: '코스피, 외국인·기관 쌍끌이 매수에 2,800선 안착 시도',
      source: '연합인포맥스',
      time: '15분 전',
      summary: '반도체 대장주의 2분기 깜짝 실적(어닝서프라이즈) 예고에 힘입어 코스피가 외인들의 강력한 현물 순매수세를 바탕으로 견고한 흐름을 지속하고 있습니다.'
    },
    {
      id: 'ks11-2',
      title: '정부 "밸류업 가이드라인 강화 계획"... 주주 환원 우수 기업 세제 혜택',
      source: '한국경제',
      time: '3시간 전',
      summary: '금융당국이 코리아 디스카운트 해소를 위해 연말까지 배당 소득 분리과세 법안을 추진하겠다고 발표하면서, 저PBR 금융 및 지주사 위주로 강한 수급 유입이 발생했습니다.'
    }
  ],
  'AAPL': [
    {
      id: 'aapl-1',
      title: '애플, 자체 온디바이스 AI "Apple Intelligence" 출시 후 기기 교체 수요 급증',
      source: '테크크런치',
      time: '2분 전',
      summary: '아이폰 16 시리즈에 기본 탑재되는 신형 신경망 코어와 개인 맞춤형 AI 비서 기능이 얼리어답터를 넘어 대중 시장의 스마트폰 신규 교체 사이클을 강하게 자극하고 있습니다.'
    },
    {
      id: 'aapl-2',
      title: '애플 비전 프로 2세대 양산 돌입... 경량화 및 가격 접근성 향상',
      source: '9to5Mac',
      time: '45분 전',
      summary: '공급망 정보에 따르면 1세대 모델의 단점이었던 착용 무게를 15% 줄이고, 디스플레이 해상도를 강화한 보급형 공간 컴퓨터 헤드셋이 내년 상반기 조기 공개 예정입니다.'
    }
  ],
  'NVDA': [
    {
      id: 'nvda-1',
      title: '엔비디아, 차세대 블랙웰(Blackwell) 가속기 연말 출하량 전량 완판',
      source: 'DigiTimes',
      time: '1분 전',
      summary: 'TSMC의 CoWoS 어드밴스드 패키징 라인을 독점하다시피 한 엔비디아가 세계 하이퍼스케일 클라우드사(MS, 구글, 메타)들의 사전 예약 폭주로 향후 3개 분기 물량을 선점했습니다.'
    },
    {
      id: 'nvda-2',
      title: '자율주행용 칩 세트 "DRIVE Thor" 중국 자율차 신흥 거점 탑재 속도',
      source: '오토카 뉴스',
      time: '1시간 전',
      summary: '미국의 대중국 반도체 규제 우회 규격을 만족하면서도 차량 내 연산 처리 능력을 극대화한 신형 로보택시용 컴퓨터 모듈이 주요 전기차 브랜드 모델에 표준 탑재 계약을 맺었습니다.'
    }
  ],
  'TSLA': [
    {
      id: 'tsla-1',
      title: '테슬라 FSD V12, 규제당국 승인 임박에 자율주행 택시 사업 가시화',
      source: '일렉트렉',
      time: '8분 전',
      summary: '완전 엔드-투-엔드 신경망으로 교체된 Full Self-Driving 소프트웨어가 마일당 개입 횟수를 획기적으로 낮추면서 조만간 샌프란시스코 내 로보택시 면허 발급 가능성이 커졌습니다.'
    },
    {
      id: 'tsla-2',
      title: '기가팩토리 상하이, 3분기 생산 공정 최적화 완료... 모델 Y 주행거리 업그레이드',
      source: '시나파이낸스',
      time: '1.5시간 전',
      summary: '리튬인산철(LFP) 블레이드 배터리 장착 비율을 늘리고 기가캐스팅 설비를 고도화하여 조립 원가를 8% 추가 절감했습니다. 업그레이드된 차량은 주행 가능거리가 5% 상승합니다.'
    }
  ],
  'MSFT': [
    {
      id: 'msft-1',
      title: '마이크로소프트, GitHub Copilot 유료 구독자 200만 명 돌파',
      source: '인포월드',
      time: '12분 전',
      summary: '개발 환경의 차세대 AI 어시스턴트 유료 도입 증가세가 연 40% 이상의 가파른 성장을 견인하며, 클라우드 부문 마진을 기존 예측치보다 2.5%p 상향 개선시켰습니다.'
    },
    {
      id: 'msft-2',
      title: 'Azure AI, OpenAI 최신 모델 GPT-4o 멀티모달 서비스 전면 상용화',
      source: 'ZDNet',
      time: '2시간 전',
      summary: '음성, 비디오 실시간 인터랙션이 내장된 신규 API 엔드포인트를 글로벌 리전에 우선 배포하며 금융권 및 고객센터 자동화 솔루션 계약 수주를 대거 확보했습니다.'
    }
  ]
};

/**
 * [DEFAULT_MOCK_NEWS]
 * - 자료형: Array<{ id: string; title: string; source: string; time: string; summary: string }>
 * - 용도: 개별 뉴스 템플릿이 정의되지 않은 종목/지수에 매핑하는 기본 금융 뉴스 목록.
 */
export const DEFAULT_MOCK_NEWS = [
  {
    id: 'default-1',
    title: '글로벌 자금 흐름, 채권 시장에서 고위험 테크 주식으로 대거 이동',
    source: '파이낸셜 타임스',
    time: '20분 전',
    summary: '기준금리 인하 기조가 본격화됨에 따라 머니마켓펀드(MMF)에 묶여있던 대기성 자금이 글로벌 우량 성장주와 고배당 상장지수펀드(ETF)로 유입되기 시작했습니다.'
  },
  {
    id: 'default-2',
    title: '원자재 시장 요동... 공급망 긴장 및 에너지 수요 반등에 원유 상승',
    source: 'CNBC',
    time: '2시간 전',
    summary: '지정학적 리스크 확산에 따른 글로벌 해상 운송 병목 현상과 제조업 가동률 회복세가 맞물려 서부 텍사스산 원유(WTI) 가격이 배럴당 80달러선 재진입을 모색하고 있습니다.'
  }
];
