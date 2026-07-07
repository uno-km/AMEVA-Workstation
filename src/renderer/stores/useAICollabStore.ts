import { create } from 'zustand';
import type { PeerState } from '../../shared/types';

export interface CollabState {
  peers: PeerState[];
  setPeers: (peers: PeerState[]) => void;
  clearPeers: () => void;
}

/**
 * 투 트랙(Two-Track) 아키텍처 중 협업(Collaboration) 트랙을 담당.
 * 다중 사용자의 커서, 포커스 등 메타데이터를 전역 스토어로 관리하여
 * 최상단 App.tsx부터 깊은 컴포넌트까지 Props Drilling 없이 사용할 수 있게 고도화.
 */
export const useAICollabStore = create<CollabState>((set) => ({
  peers: [],
  setPeers: (peers) => set({ peers }),
  clearPeers: () => set({ peers: [] }),
}));
