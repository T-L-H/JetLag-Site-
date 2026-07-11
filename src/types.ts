export type GameSize = 'S' | 'M' | 'L';
export type GamePhase = 'LOBBY' | 'HIDING' | 'SEEKING' | 'INTERMISSION' | 'END';
export type CardType = 'TIME' | 'POWERUP' | 'CURSE';
export type CardRarity = 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | 'BLUE' | 'COMMON';

export interface POI {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
}

export interface GridCell {
  id: string;
  lat: number;
  lng: number;
  active: boolean;
}

export interface Player {
  id: string;
  name: string;
  team: string;
  lat?: number;
  lng?: number;
  lastUpdate?: number;
}

export interface Team {
  id: string;
  name: string;
  role: 'HIDER' | 'SEEKER';
  score: number; // hiding time in seconds
  players: string[]; // player names/ids
  lat?: number;
  lng?: number;
  lastActive?: number;
}

export interface Card {
  id: string;
  title: string;
  type: CardType;
  rarity: CardRarity;
  desc: string;
  costDesc?: string;
  penaltyDesc?: string;
  bonusMinutes?: number; // for TIME cards: red/orange/yellow/green/blue
  curseId?: string;
  seekerEffect?: string;
  dismissalDesc?: string;
}

export interface ActiveQuestion {
  id: string;
  type: 'MATCHING' | 'MEASURING' | 'THERMOMETER' | 'RADAR' | 'TENTACLES' | 'PHOTO';
  title: string;
  rewardDesc: string;
  rewardDraw: number;
  rewardPick: number;
  poiType?: string;
  customPin?: { lat: number; lng: number };
  startPin?: { lat: number; lng: number };
  endPin?: { lat: number; lng: number };
  distanceValue?: number; // miles
  selectedSubject?: string;
  status: 'PENDING' | 'ANSWERED' | 'VETOED';
  photoUrl?: string;
  mathResult?: {
    isYes?: boolean;
    eliminatedCount: number;
    description: string;
  };
}

export interface ActiveCurse {
  id: string;
  cardId: string;
  title: string;
  desc: string;
  costDesc: string;
  seekerEffect: string;
  dismissalDesc: string;
  resolved: boolean;
  pendingConfirmation?: boolean;
}

export interface CardDraft {
  id: string;
  options: Card[];
  pickCount: number;
}

export interface HidingScoreDetails {
  hiderTeamName: string;
  baseHidingTime: number; // seconds
  handTimeBonuses: number; // seconds
  bonusCards: {
    title: string;
    rarity: string;
    bonusMin: number;
  }[];
  finalScore: number; // seconds
}

export interface RoomState {
  code: string;
  centerLat: number;
  centerLng: number;
  radiusMiles: number;
  customPolygon?: { lat: number; lng: number }[];
  gameSize: GameSize;
  gamePhase: GamePhase;
  hiderTeamIndex: number; // Index of the team currently hiding
  hiderSequence: number[]; // Ordered list of team indices that will hide
  teams: Team[];
  players: Player[];
  grid: GridCell[];
  activeQuestion: ActiveQuestion | null;
  pendingDraft?: CardDraft | null;
  hiderHand: Card[];
  activeCurses: ActiveCurse[];
  freeQuestionsRemaining?: number;
  overflowingChaliceQuestionsRemaining?: number;
  timerStart: number | null; // epoch time in milliseconds
  timerAccumulated: number; // accumulated seconds so far
  vetoedTypes: string[]; // categories of questions currently banned (e.g., matching POI types or question types)
  hidingEndTime?: number; // timestamp when hider timer ends
  hidingTimeLimit?: number; // duration of hiding phase in minutes
  hidingStationPin?: { lat: number; lng: number } | null;
  history: string[]; // List of events that occurred
  pois?: POI[];
  drawnCurseIds?: string[];
  lastHidingScoreDetails?: HidingScoreDetails | null;
}
