import { create } from 'zustand';
import type { BoardData } from './types';
import { emptyBoard } from './logic';

const KEY = 'stb.board.v1';

function load(): BoardData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as BoardData;
  } catch {
    // Fall through to a fresh board.
  }
  return emptyBoard();
}

interface Store {
  data: BoardData;
  /** Apply a change made on this device. */
  update: (fn: (d: BoardData) => BoardData) => void;
  /** Replace the board with a copy pulled from Drive, without bumping updatedAt. */
  replace: (d: BoardData) => void;
}

export const useBoard = create<Store>((set) => ({
  data: load(),
  update: (fn) => set((s) => ({ data: { ...fn(s.data), updatedAt: Date.now() } })),
  replace: (d) => set({ data: d }),
}));

useBoard.subscribe((s) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s.data));
  } catch {
    // Storage full or blocked; Drive sync still holds a copy.
  }
});
