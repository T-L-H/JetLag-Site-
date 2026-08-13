import React, { useState, useEffect, useRef } from 'react';
import { RoomState, GameSaveData, Player } from '../types';
import { decodeSavePayload, importSaveToServer, getLocalSavedGames, removeLocalSavedGame, formatSecondsToTime } from '../lib/saveGame';
import { Upload, FileJson, Copy, Check, X, Shield, Trophy, Users, Clock, AlertCircle, ArrowRight, Trash2, RotateCcw, Crown, UserCheck, PlusCircle } from 'lucide-react';
import audio from '../lib/audio';

interface LoadGameModalProps {
  currentUserName?: string;
  onClose: () => void;
  onGameLoaded: (room: RoomState, chosenPlayerName?: string, chosenTeamName?: string) => void;
}

export default function LoadGameModal({ currentUserName = '', onClose, onGameLoaded }: LoadGameModalProps) {
  const [activeTab, setActiveTab] = useState<'FILE' | 'CODE' | 'RECENT'>('FILE');
  const [codeInputValue, setCodeInputValue] = useState('');
  const [parsedSave, setParsedSave] = useState<GameSaveData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [localSaves, setLocalSaves] = useState<GameSaveData[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Player / Identity Selection state when restoring game
  const [selectedPlayerName, setSelectedPlayerName] = useState<string>('');
  const [selectedTeamName, setSelectedTeamName] = useState<string>('');
  const [isCustomPlayer, setIsCustomPlayer] = useState(false);
  const [customNameInput, setCustomNameInput] = useState(currentUserName || '');
  const [customTeamInput, setCustomTeamInput] = useState<string>('');

  useEffect(() => {
    const saved = getLocalSavedGames();
    setLocalSaves(saved);
    if (saved.length > 0) {
      setActiveTab('RECENT');
    }
  }, []);

  // When a save is parsed or selected, automatically configure the suggested player/team
  useEffect(() => {
    if (!parsedSave) return;

    const room = parsedSave.room;
    const existingPlayers = room.players || [];
    const teams = room.teams || [];

    // 1. Check if current userName matches an existing player in the save
    const matchedPlayer = existingPlayers.find(
      (p) => p.name.toLowerCase() === currentUserName.toLowerCase()
    );

    if (matchedPlayer) {
      setSelectedPlayerName(matchedPlayer.name);
      setSelectedTeamName(matchedPlayer.team);
      setIsCustomPlayer(false);
    } else if (existingPlayers.length > 0) {
      // Default to first player
      setSelectedPlayerName(existingPlayers[0].name);
      setSelectedTeamName(existingPlayers[0].team);
      setIsCustomPlayer(false);
    } else if (teams.length > 0) {
      // No explicit players list, default to custom with first team
      setIsCustomPlayer(true);
      setCustomNameInput(currentUserName || 'GameMaster');
      setCustomTeamInput(teams[0].name);
      setSelectedTeamName(teams[0].name);
    }

    if (teams.length > 0 && !customTeamInput) {
      setCustomTeamInput(teams[0].name);
    }
  }, [parsedSave, currentUserName]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const decoded = decodeSavePayload(text);
        setParsedSave(decoded);
        audio.playSuccess();
      } catch (err: any) {
        console.error(err);
        setErrorMsg(err.message || 'Failed to read save file.');
        setParsedSave(null);
      }
    };
    reader.onerror = () => {
      setErrorMsg('Error reading file from disk.');
    };
    reader.readAsText(file);
  };

  const handleCodeParse = () => {
    if (!codeInputValue.trim()) return;
    setErrorMsg(null);
    try {
      const decoded = decodeSavePayload(codeInputValue);
      setParsedSave(decoded);
      audio.playSuccess();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Invalid save code. Please check your text and try again.');
      setParsedSave(null);
    }
  };

  const handleConfirmImport = async (saveToImport?: GameSaveData) => {
    const targetSave = saveToImport || parsedSave;
    if (!targetSave) return;

    setLoading(true);
    setErrorMsg(null);

    const result = await importSaveToServer(targetSave);
    setLoading(false);

    if (result.ok && result.room) {
      audio.playSuccess();
      
      const finalPlayerName = isCustomPlayer
        ? customNameInput.trim() || 'GameMaster'
        : selectedPlayerName || 'GameMaster';

      const finalTeamName = isCustomPlayer
        ? customTeamInput || result.room.teams[0]?.name || 'Team 1'
        : selectedTeamName || result.room.teams[0]?.name || 'Team 1';

      onGameLoaded(result.room, finalPlayerName, finalTeamName);
      onClose();
    } else {
      setErrorMsg(result.error || 'Server failed to restore room.');
    }
  };

  const handleDeleteLocalSave = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    removeLocalSavedGame(code);
    setLocalSaves(getLocalSavedGames());
    audio.playClick();
  };

  // Compile list of available players and teams from parsedSave
  const existingPlayers: Player[] = parsedSave?.room.players || [];
  const teams = parsedSave?.room.teams || [];

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-xl w-full relative overflow-hidden flex flex-col max-h-[90vh]">
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-100 tracking-tight">Load & Resume Saved Game</h3>
              <p className="text-xs text-slate-400">Restore match state, teams, scores & map status</p>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              audio.playClick();
            }}
            className="p-2 text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-850 hover:border-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex space-x-2 pt-4 pb-2 shrink-0">
          {localSaves.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('RECENT');
                setParsedSave(null);
                setErrorMsg(null);
                audio.playClick();
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'RECENT'
                  ? 'bg-indigo-500 text-white shadow-md'
                  : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-850'
              }`}
            >
              Recent Auto-Saves ({localSaves.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setActiveTab('FILE');
              setParsedSave(null);
              setErrorMsg(null);
              audio.playClick();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'FILE'
                ? 'bg-indigo-500 text-white shadow-md'
                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-850'
            }`}
          >
            Upload File (.json)
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('CODE');
              setParsedSave(null);
              setErrorMsg(null);
              audio.playClick();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'CODE'
                ? 'bg-indigo-500 text-white shadow-md'
                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-850'
            }`}
          >
            Paste Save Code
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto space-y-4 py-2 pr-1 flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: Recent Saved Games from Device */}
          {activeTab === 'RECENT' && (
            <div className="space-y-2.5">
              <p className="text-[11px] text-slate-400">
                Pick a match previously saved or played on this device to resume immediately:
              </p>
              {localSaves.map((save) => {
                const isSelected = parsedSave?.roomCode === save.roomCode;
                const formattedDate = new Date(save.saveDate).toLocaleString();
                const leading = save.summary.leadingTeam;
                return (
                  <div
                    key={save.roomCode}
                    onClick={() => {
                      setParsedSave(save);
                      audio.playClick();
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500/80 shadow-md shadow-indigo-950/30'
                        : 'bg-slate-950/60 border-slate-850 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-black text-sm text-indigo-300">
                            {save.roomCode}
                          </span>
                          <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                            {save.summary.gamePhase}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 block">Saved: {formattedDate}</span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteLocalSave(e, save.roomCode)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition-colors rounded"
                        title="Delete from saved list"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2 border-t border-slate-900 text-xs">
                      <div>
                        <span className="text-[9px] text-slate-500 font-bold block uppercase">Teams</span>
                        <span className="text-slate-300 font-medium truncate block">
                          {save.summary.teams.map((t) => t.name).join(', ')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 font-bold block uppercase">Leader</span>
                        <span className="text-amber-300 font-bold truncate block">{leading}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: Upload File */}
          {activeTab === 'FILE' && (
            <div className="space-y-3">
              <input
                type="file"
                ref={fileInputRef}
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-800 hover:border-indigo-500/60 bg-slate-950/40 hover:bg-slate-950/80 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2"
              >
                <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-full w-fit mx-auto">
                  <Upload className="w-6 h-6" />
                </div>
                <h4 className="text-xs font-bold text-slate-200">Click or Drag & Drop Save JSON File</h4>
                <p className="text-[10px] text-slate-500">Supports .json files exported from Jet Lag Tracker</p>
              </div>
            </div>
          )}

          {/* TAB 3: Paste Code */}
          {activeTab === 'CODE' && (
            <div className="space-y-3">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Paste Save Code or JSON
              </label>
              <textarea
                rows={4}
                value={codeInputValue}
                onChange={(e) => setCodeInputValue(e.target.value)}
                placeholder="Paste code starting with JTSAVE:... or raw JSON here"
                className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
              />
              <button
                type="button"
                onClick={handleCodeParse}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Verify & Preview Save Code</span>
              </button>
            </div>
          )}

          {/* MATCH PREVIEW CARD & PLAYER SELECTION (When save file/code is parsed) */}
          {parsedSave && (
            <div className="space-y-3 animate-fade-in">
              {/* Match Stats Box */}
              <div className="bg-gradient-to-br from-slate-950 to-indigo-950/30 border border-indigo-500/40 p-4 rounded-2xl space-y-3">
                <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center space-x-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Match Ready: {parsedSave.roomCode}</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                    {parsedSave.summary.gamePhase}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800">
                    <span className="text-[9px] text-slate-500 font-bold uppercase block">Current Hider</span>
                    <span className="text-rose-400 font-bold truncate block">{parsedSave.summary.currentHiderTeam}</span>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800">
                    <span className="text-[9px] text-slate-500 font-bold uppercase block">Elapsed Time</span>
                    <span className="font-mono text-cyan-400 font-black truncate block">
                      {formatSecondsToTime(parsedSave.summary.elapsedSeconds)}
                    </span>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800">
                    <span className="text-[9px] text-slate-500 font-bold uppercase block">Leader</span>
                    <span className="text-amber-300 font-bold truncate block">{parsedSave.summary.leadingTeam}</span>
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <span className="text-[9px] text-slate-400 font-bold uppercase">Teams & Scores</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {parsedSave.summary.teams.map((t) => (
                      <div key={t.name} className="flex justify-between items-center bg-slate-900/40 px-2 py-1 rounded-lg text-xs">
                        <span className="text-slate-300 truncate text-[11px]">{t.name}</span>
                        <span className="font-mono font-bold text-indigo-300 text-[11px]">{t.scoreFormatted}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* GM & PLAYER IDENTITY SELECTOR */}
              <div className="bg-slate-950/80 border border-amber-500/30 p-4 rounded-2xl space-y-3.5">
                <div className="flex items-center space-x-2 pb-2 border-b border-slate-900">
                  <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg">
                    <Crown className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-amber-300 uppercase tracking-wider">
                      Game Master (GM) & Player Identity
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      You will load this session as the <b>Game Master</b> with controls to launch rounds.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">
                    Choose which Player / Team you will play as:
                  </label>

                  {/* Option 1: Existing Players list */}
                  {existingPlayers.length > 0 && (
                    <div className="space-y-1.5">
                      {existingPlayers.map((p) => {
                        const playerTeam = teams.find((t) => t.name === p.team);
                        const isHiderRole = playerTeam?.role === 'HIDER';
                        const isSelected = !isCustomPlayer && selectedPlayerName === p.name;

                        return (
                          <div
                            key={p.id || p.name}
                            onClick={() => {
                              setIsCustomPlayer(false);
                              setSelectedPlayerName(p.name);
                              setSelectedTeamName(p.team);
                              audio.playClick();
                            }}
                            className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-indigo-950/60 border-amber-400/80 shadow-sm'
                                : 'bg-slate-900/50 border-slate-850 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5">
                              <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${isSelected ? 'border-amber-400 bg-amber-400' : 'border-slate-600'}`}>
                                {isSelected && <Check className="w-2.5 h-2.5 text-slate-950 stroke-[3]" />}
                              </div>
                              <span className="text-xs font-bold text-slate-100">{p.name}</span>
                            </div>

                            <div className="flex items-center space-x-1.5">
                              <span className="text-[10px] font-semibold text-slate-400">{p.team}</span>
                              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${isHiderRole ? 'bg-rose-500/20 text-rose-300' : 'bg-blue-500/20 text-blue-300'}`}>
                                {playerTeam?.role || 'SEEKER'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Option 2: Custom Name / New Player */}
                  <div
                    onClick={() => {
                      setIsCustomPlayer(true);
                      audio.playClick();
                    }}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isCustomPlayer
                        ? 'bg-indigo-950/60 border-amber-400/80'
                        : 'bg-slate-900/50 border-slate-850 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${isCustomPlayer ? 'border-amber-400 bg-amber-400' : 'border-slate-600'}`}>
                        {isCustomPlayer && <Check className="w-2.5 h-2.5 text-slate-950 stroke-[3]" />}
                      </div>
                      <span className="text-xs font-bold text-slate-200">Play as a different / new name</span>
                    </div>

                    {isCustomPlayer && (
                      <div className="mt-3 pt-2.5 border-t border-slate-900 grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Your Name</label>
                          <input
                            type="text"
                            value={customNameInput}
                            onChange={(e) => setCustomNameInput(e.target.value)}
                            placeholder="e.g. Sam"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-400"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Assign to Team</label>
                          <select
                            value={customTeamInput}
                            onChange={(e) => setCustomTeamInput(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-400"
                          >
                            {teams.map((t) => (
                              <option key={t.name} value={t.name}>
                                {t.name} ({t.role})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-850 flex justify-between items-center shrink-0">
          <button
            type="button"
            onClick={() => {
              onClose();
              audio.playClick();
            }}
            className="text-xs font-semibold text-slate-400 hover:text-slate-200 px-4 py-2 rounded-xl bg-slate-950/50 hover:bg-slate-950 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!parsedSave || loading}
            onClick={() => handleConfirmImport()}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-indigo-500 hover:from-amber-400 hover:to-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-indigo-950/40 transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <Crown className="w-3.5 h-3.5" />
            <span>{loading ? 'Restoring Match...' : 'Resume Match as GM'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
