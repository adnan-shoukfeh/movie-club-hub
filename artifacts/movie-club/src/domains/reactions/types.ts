export interface Sticker {
  id: number;
  name: string;
  imageUrl: string;
  isGlobal: boolean;
  groupId?: number;
}

export interface ReactionSummary {
  stickerId: number;
  name: string;
  imageUrl: string;
  count: number;
  userReacted: boolean;
}

export interface ReactionDetail {
  id: number;
  stickerId: number;
  stickerName: string;
  imageUrl: string;
  username: string;
  userId: number;
}

export interface ToggleReactionResult {
  action: "added" | "removed";
  id?: number;
  stickerId?: number;
}
