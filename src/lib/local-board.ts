import type { BoardCard } from "@/types/board";

interface StoredBoard {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

interface StoredCard {
  id: string;
  boardId: string;
  type: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  thumbnail?: string;
  url?: string;
  videoId?: string;
  createdAt: string;
  updatedAt: string;
}

const BOARDS_KEY = "tubeforge_boards";
const CARDS_PREFIX = "tubeforge_cards_";

export function getLocalBoards(): StoredBoard[] {
  try {
    const raw = localStorage.getItem(BOARDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalBoards(boards: StoredBoard[]): void {
  localStorage.setItem(BOARDS_KEY, JSON.stringify(boards));
}

export function getLocalBoard(boardId: string): StoredBoard | undefined {
  return getLocalBoards().find((b) => b.id === boardId);
}

export function ensureLocalBoard(boardId: string, name: string, description: string, isDefault = false): StoredBoard {
  const boards = getLocalBoards();
  const existing = boards.find((b) => b.id === boardId);
  if (existing) return existing;

  const board: StoredBoard = {
    id: boardId,
    name,
    description,
    isDefault,
    itemCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  boards.push(board);
  saveLocalBoards(boards);
  return board;
}

export function getLocalCards(boardId: string): StoredCard[] {
  try {
    const raw = localStorage.getItem(CARDS_PREFIX + boardId);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalCards(boardId: string, cards: StoredCard[]): void {
  localStorage.setItem(CARDS_PREFIX + boardId, JSON.stringify(cards));
}

export function addLocalCard(boardId: string, card: Omit<StoredCard, "id" | "boardId" | "createdAt" | "updatedAt">): StoredCard {
  const cards = getLocalCards(boardId);
  const newCard: StoredCard = {
    ...card,
    id: crypto.randomUUID(),
    boardId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  cards.unshift(newCard);
  saveLocalCards(boardId, cards);

  // Update board item count
  const boards = getLocalBoards();
  const board = boards.find((b) => b.id === boardId);
  if (board) {
    board.itemCount = cards.length;
    board.updatedAt = new Date().toISOString();
    saveLocalBoards(boards);
  }

  return newCard;
}

export function removeLocalCard(boardId: string, cardId: string): void {
  const cards = getLocalCards(boardId).filter((c) => c.id !== cardId);
  saveLocalCards(boardId, cards);

  // Update board item count
  const boards = getLocalBoards();
  const board = boards.find((b) => b.id === boardId);
  if (board) {
    board.itemCount = cards.length;
    board.updatedAt = new Date().toISOString();
    saveLocalBoards(boards);
  }
}

export function getLocalCardsAsBoardCards(boardId: string): BoardCard[] {
  return getLocalCards(boardId).map((c) => ({
    id: c.id,
    boardId: c.boardId,
    type: c.type as BoardCard["type"],
    x: 0,
    y: 0,
    width: 240,
    height: 160,
    title: c.title,
    content: c.content,
    metadata: c.metadata,
    thumbnail: c.thumbnail,
    url: c.url,
    videoId: c.videoId,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
}
