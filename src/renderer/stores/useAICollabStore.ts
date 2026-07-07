import { create } from 'zustand';

export interface CollabUser {
  id: string;
  name: string;
  color: string;
  status: 'online' | 'offline';
  cursorPosition?: { x: number; y: number };
}

export interface CollabState {
  // Yjs Awareness 상태와 동기화되는 접속 유저 목록
  connectedUsers: Record<string, CollabUser>;
  
  // 상태 업데이트 메서드 (Yjs 이벤트 리스너에서 호출됨)
  updateUser: (id: string, user: Partial<CollabUser>) => void;
  removeUser: (id: string) => void;
  clearUsers: () => void;
}

/**
 * 투 트랙(Two-Track) 아키텍처 중 협업(Collaboration) 트랙을 담당.
 * 실시간 고빈도 로그(Sensor Logs)와 완전히 분리되어, 
 * 다중 사용자의 커서, 포커스 등 메타데이터만 가볍게 관리합니다.
 */
export const useAICollabStore = create<CollabState>((set) => ({
  connectedUsers: {},
  updateUser: (id, user) => set((state) => ({
    connectedUsers: {
      ...state.connectedUsers,
      [id]: { ...(state.connectedUsers[id] || {}), ...user } as CollabUser,
    }
  })),
  removeUser: (id) => set((state) => {
    const newUsers = { ...state.connectedUsers };
    delete newUsers[id];
    return { connectedUsers: newUsers };
  }),
  clearUsers: () => set({ connectedUsers: {} }),
}));
