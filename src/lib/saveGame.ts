import { RoomState, GameSaveData } from '../types';
import { safeStorage } from './storage';

export function formatSecondsToTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}m ${s}s`;
}

/**
 * Creates a clean, self-contained GameSaveData package with normalized timers.
 */
export function createSaveData(room: RoomState): GameSaveData {
  const normalizedRoom: RoomState = JSON.parse(JSON.stringify(room));

  // If match clock was actively running, calculate elapsed and freeze it
  if (normalizedRoom.timerStart) {
    const elapsed = Math.max(0, Math.floor((Date.now() - normalizedRoom.timerStart) / 1000));
    normalizedRoom.timerAccumulated = (normalizedRoom.timerAccumulated || 0) + elapsed;
    normalizedRoom.timerStart = null; // Paused on save so opening on a later date does not distort the clock
  }

  // Determine current round info
  const hiderSeqIndex = normalizedRoom.hiderSequence?.indexOf(normalizedRoom.hiderTeamIndex) ?? -1;
  const roundNumber = hiderSeqIndex >= 0 ? hiderSeqIndex + 1 : 1;
  const totalRounds = normalizedRoom.hiderSequence?.length || normalizedRoom.teams?.length || 1;

  // Determine current leading team
  const sortedTeams = [...(normalizedRoom.teams || [])].sort((a, b) => b.score - a.score);
  const leadingTeam = sortedTeams.length > 0 && sortedTeams[0].score > 0 ? sortedTeams[0].name : 'Tie / In Progress';

  const currentHiderTeam = normalizedRoom.teams?.[normalizedRoom.hiderTeamIndex]?.name || 'N/A';

  const summary = {
    gamePhase: normalizedRoom.gamePhase,
    gameSize: normalizedRoom.gameSize,
    currentHiderTeam,
    elapsedSeconds: normalizedRoom.timerAccumulated,
    roundNumber,
    totalRounds,
    leadingTeam,
    teams: (normalizedRoom.teams || []).map((t) => ({
      name: t.name,
      role: t.role,
      score: t.score,
      scoreFormatted: formatSecondsToTime(t.score),
      players: t.players || [],
    })),
  };

  return {
    app: 'jet-tracker',
    version: 1,
    saveDate: new Date().toISOString(),
    roomCode: normalizedRoom.code,
    summary,
    room: normalizedRoom,
  };
}

/**
 * Triggers a browser download of the save file.
 */
export function exportSaveFile(saveData: GameSaveData): void {
  const jsonStr = JSON.stringify(saveData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `jet-tracker-save-${saveData.roomCode}-${dateStr}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Encodes save data into a portable string code (Base64 prefixed with JTSAVE:).
 */
export function encodeSaveCode(saveData: GameSaveData): string {
  try {
    const minified = JSON.stringify(saveData);
    const b64 = btoa(encodeURIComponent(minified));
    return `JTSAVE:${b64}`;
  } catch (e) {
    // Fallback to plain JSON
    return JSON.stringify(saveData);
  }
}

/**
 * Decodes save data from a file string, raw JSON, or Base64 code.
 */
export function decodeSavePayload(rawText: string): GameSaveData {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error('Save data is empty.');
  }

  let parsedObj: any = null;

  if (trimmed.startsWith('JTSAVE:')) {
    const b64 = trimmed.slice(7);
    const jsonStr = decodeURIComponent(atob(b64));
    parsedObj = JSON.parse(jsonStr);
  } else if (trimmed.startsWith('{')) {
    parsedObj = JSON.parse(trimmed);
  } else {
    // Try base64 directly
    try {
      const jsonStr = decodeURIComponent(atob(trimmed));
      parsedObj = JSON.parse(jsonStr);
    } catch {
      parsedObj = JSON.parse(trimmed);
    }
  }

  // Handle both enveloped GameSaveData and direct RoomState
  if (parsedObj.app === 'jet-tracker' && parsedObj.room) {
    return parsedObj as GameSaveData;
  } else if (parsedObj.code && parsedObj.teams && parsedObj.grid) {
    // Raw room state was provided
    return createSaveData(parsedObj as RoomState);
  } else if (parsedObj.room && parsedObj.room.code) {
    return createSaveData(parsedObj.room as RoomState);
  }

  throw new Error('Invalid save file format. Missing required game state.');
}

const SAVED_GAMES_STORAGE_KEY = 'jt_saved_games_list';

/**
 * Saves game state to browser localStorage for instant recovery.
 */
export function saveToLocalStorage(saveData: GameSaveData): void {
  try {
    const existing = getLocalSavedGames();
    // Filter out previous saves with the same roomCode
    const filtered = existing.filter((s) => s.roomCode !== saveData.roomCode);
    // Add to top, keep last 6 saves
    const updated = [saveData, ...filtered].slice(0, 6);
    safeStorage.setItem(SAVED_GAMES_STORAGE_KEY, JSON.stringify(updated));
    safeStorage.setItem('jt_last_autosave', JSON.stringify(saveData));
  } catch (e) {
    console.warn('Failed to write save to local storage:', e);
  }
}

/**
 * Retrieves all locally saved games from browser storage.
 */
export function getLocalSavedGames(): GameSaveData[] {
  try {
    const raw = safeStorage.getItem(SAVED_GAMES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (e) {
    console.warn('Failed to read saved games from local storage:', e);
    return [];
  }
}

/**
 * Removes a locally saved game.
 */
export function removeLocalSavedGame(roomCode: string): void {
  try {
    const existing = getLocalSavedGames();
    const filtered = existing.filter((s) => s.roomCode !== roomCode);
    safeStorage.setItem(SAVED_GAMES_STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.warn('Failed to delete saved game:', e);
  }
}

/**
 * Imports save data to backend server and restores the room.
 */
export async function importSaveToServer(
  saveData: GameSaveData
): Promise<{ ok: boolean; room?: RoomState; error?: string }> {
  try {
    const res = await fetch('/api/rooms/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saveData }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: err.error || 'Failed to import save data to server.' };
    }

    const data = await res.json();
    return { ok: true, room: data.room };
  } catch (e: any) {
    return { ok: false, error: e.message || 'Network error importing save file.' };
  }
}
