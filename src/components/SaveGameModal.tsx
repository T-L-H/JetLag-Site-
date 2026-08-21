import React, { useState } from 'react';
import { RoomState } from '../types';
import { createSaveData, exportSaveFile, encodeSaveCode, formatSecondsToTime, saveToLocalStorage } from '../lib/saveGame';
import { Download, Copy, Check, X, Shield, Trophy, Clock, Users, FileJson, CheckCircle2, BookmarkCheck, Star, UserX, Crown, Navigation, AlertTriangle } from 'lucide-react';
import audio from '../lib/audio';

interface SaveGameModalProps {
  room: RoomState;
  onClose: () => void;
}

export default function SaveGameModal({ room, onClose }: SaveGameModalProps) {
  const [activeTab, setActiveTab] = useState<'ROSTER_GPS' | 'SAVE_EXPORT'>('ROSTER_GPS');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const saveData = createSaveData(room);
  const saveCode = encodeSaveCode(saveData);
  const jsonString = JSON.stringify(saveData, null, 2);

  // Auto-save to localStorage as well
  React.useEffect(() => {
    saveToLocalStorage(saveData);
  }, []);

  const handleSetTeamLead = async (teamName: string, playerName: string) => {
    setErrorMessage(null);
    audio.playClick();
    try {
      const res = await fetch(`/api/rooms/${room.code}/set-team-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamName, playerName }),
      });
      if (!res.ok) {
        const err = await res.json();
        setErrorMessage(err.error || 'Failed to update GPS anchor');
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Error updating GPS anchor');
    }
  };

  const handleKickPlayer = async (playerName: string, teamName: string) => {
    setErrorMessage(null);
    const team = room.teams.find((t) => t.name === teamName);
    const leadName = team?.leadPlayer || team?.players[0];

    // Check if player is lead player with other teammates
    if (leadName?.toLowerCase() === playerName.toLowerCase() && (team?.players.length || 0) > 1) {
      setErrorMessage(
        `⚠️ Cannot remove "${playerName}" because they are currently the designated Main GPS Point for ${teamName}. Please switch the Main GPS Point to another teammate first.`
      );
      audio.playAlert();
      return;
    }

    if (!confirm(`Are you sure you want to remove "${playerName}" from the active match?`)) {
      return;
    }

    audio.playAlert();
    try {
      const res = await fetch(`/api/rooms/${room.code}/remove-player`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName }),
      });
      if (!res.ok) {
        const err = await res.json();
        setErrorMessage(err.error || 'Failed to remove player');
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Error removing player');
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(saveCode);
    setCopiedCode(true);
    audio.playClick();
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonString);
    setCopiedJson(true);
    audio.playClick();
    setTimeout(() => setCopiedJson(false), 2500);
  };

  const handleDownloadFile = () => {
    exportSaveFile(saveData);
    audio.playSuccess();
  };

  const sortedTeams = [...(room.teams || [])].sort((a, b) => b.score - a.score);
  const leader = sortedTeams[0];
  const currentHider = room.teams[room.hiderTeamIndex]?.name || 'N/A';

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-xl w-full relative overflow-hidden flex flex-col max-h-[90vh]">
        <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex justify-between items-center pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-2xl">
              <BookmarkCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-100 tracking-tight flex items-center space-x-2">
                <span>Match Management & Save</span>
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full font-mono font-bold">
                  {room.code}
                </span>
              </h3>
              <p className="text-xs text-slate-400">Manage team GPS anchors, player roster, or export save game</p>
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

        {/* Navigation Tabs */}
        <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-850 mt-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('ROSTER_GPS');
              audio.playClick();
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
              activeTab === 'ROSTER_GPS'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-950/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Star className="w-3.5 h-3.5 fill-current" />
            <span>Team GPS Anchors & Roster</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('SAVE_EXPORT');
              audio.playClick();
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
              activeTab === 'SAVE_EXPORT'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-950/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Save & Backup Match</span>
          </button>
        </div>

        {/* Error Alert Box */}
        {errorMessage && (
          <div className="mt-3 p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl flex items-start space-x-2 text-rose-300 text-xs shrink-0">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block">Action Blocked:</span>
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-rose-200 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Scrollable Body */}
        <div className="overflow-y-auto space-y-4 py-4 pr-1 flex-1">
          {activeTab === 'ROSTER_GPS' && (
            <div className="space-y-4">
              <div className="bg-slate-950/60 border border-slate-850 p-3.5 rounded-2xl">
                <div className="flex items-center space-x-2 text-amber-400 text-xs font-black uppercase tracking-wider mb-1">
                  <Star className="w-4 h-4 fill-current" />
                  <span>Main GPS Point Designation</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  For teams with multiple players, 1 person serves as the <strong>Main GPS Point</strong>. All distance questions (Radar scans, Measuring pin, Matching landmarks, Thermometer path, etc.) are calculated from their location. You can switch who the main GPS point is at any time.
                </p>
              </div>

              {/* Team Cards */}
              <div className="space-y-3">
                {room.teams.map((team) => {
                  const leadName = team.leadPlayer || team.players[0];
                  const hasMultiple = team.players.length > 1;
                  const isHider = team.role === 'HIDER';

                  return (
                    <div
                      key={team.name}
                      className={`p-4 rounded-2xl border ${
                        isHider ? 'bg-rose-950/20 border-rose-500/30' : 'bg-slate-950/80 border-slate-800'
                      } space-y-3`}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-extrabold text-slate-100">{team.name}</h4>
                          <span
                            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                              isHider ? 'bg-rose-500/20 text-rose-300' : 'bg-cyan-500/20 text-cyan-300'
                            }`}
                          >
                            {team.role}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Score: {formatSecondsToTime(team.score)}
                        </span>
                      </div>

                      {/* Players List */}
                      <div className="space-y-2">
                        {team.players.map((pName) => {
                          const pObj = room.players.find((p) => p.name.toLowerCase() === pName.toLowerCase());
                          const isLead = leadName?.toLowerCase() === pName.toLowerCase();

                          return (
                            <div
                              key={pName}
                              className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                                isLead
                                  ? 'bg-amber-950/30 border-amber-500/40 shadow-sm'
                                  : 'bg-slate-900/60 border-slate-850'
                              }`}
                            >
                              <div className="flex items-center space-x-2 min-w-0">
                                <div
                                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                    pObj?.gpsAcquired ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                                  }`}
                                />
                                <span className="text-xs font-bold text-slate-200 truncate">{pName}</span>
                                {isLead && (
                                  <span className="inline-flex items-center space-x-1 text-[9px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded shrink-0">
                                    <Star className="w-2.5 h-2.5 fill-current" />
                                    <span>Main GPS</span>
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center space-x-2 shrink-0">
                                {hasMultiple && !isLead && (
                                  <button
                                    type="button"
                                    onClick={() => handleSetTeamLead(team.name, pName)}
                                    className="text-[10px] font-bold text-slate-300 hover:text-amber-300 bg-slate-850 hover:bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center space-x-1"
                                    title="Make this player the Main GPS Point"
                                  >
                                    <Star className="w-3 h-3 text-amber-400" />
                                    <span>Set as GPS Anchor</span>
                                  </button>
                                )}

                                {/* Kick / Remove Player button */}
                                <button
                                  type="button"
                                  onClick={() => handleKickPlayer(pName, team.name)}
                                  className="p-1 text-slate-400 hover:text-rose-400 bg-slate-950 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-800 rounded-lg transition-colors cursor-pointer"
                                  title={`Remove ${pName} from match`}
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'SAVE_EXPORT' && (
            <div className="space-y-4">
              {/* Match Summary Card */}
              <div className="bg-slate-950/70 border border-slate-850 p-4 rounded-2xl space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 flex items-center space-x-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Current Match Snapshot</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                    Phase: {room.gamePhase}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-850/60">
                    <span className="text-[9px] text-slate-500 font-bold uppercase block">Current Hider</span>
                    <span className="text-rose-400 font-bold truncate block">{currentHider}</span>
                  </div>
                  <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-850/60">
                    <span className="text-[9px] text-slate-500 font-bold uppercase block">Round Clock</span>
                    <span className="font-mono text-cyan-400 font-black truncate block">
                      {formatSecondsToTime(saveData.summary.elapsedSeconds)}
                    </span>
                  </div>
                  <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-850/60 col-span-2 sm:col-span-1">
                    <span className="text-[9px] text-slate-500 font-bold uppercase block">Leader</span>
                    <span className="text-amber-300 font-bold truncate block flex items-center space-x-1">
                      <Trophy className="w-3 h-3 text-amber-400 shrink-0 inline" />
                      <span>{leader && leader.score > 0 ? leader.name : 'Tie'}</span>
                    </span>
                  </div>
                </div>

                {/* Teams & Score breakdown */}
                <div className="pt-2 border-t border-slate-850/80 space-y-1.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Team Standings:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {room.teams.map((t) => (
                      <div key={t.name} className="flex justify-between items-center bg-slate-900/40 px-2.5 py-1.5 rounded-lg border border-slate-850/40 text-xs">
                        <span className="text-slate-300 truncate max-w-[130px] font-medium">{t.name}</span>
                        <span className="font-mono font-bold text-cyan-300 text-[11px]">{formatSecondsToTime(t.score)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Primary Action 1: Download JSON File */}
              <div className="bg-cyan-950/20 border border-cyan-500/30 p-4 rounded-2xl space-y-2.5">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-xs font-black text-cyan-300 flex items-center space-x-1.5">
                      <FileJson className="w-4 h-4 text-cyan-400" />
                      <span>Option A: Download Save File (.json)</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Download a lightweight JSON file containing all teams, GPS grid status, cards, curses, and scores.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadFile}
                  className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-cyan-950/40 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Save File (.json)</span>
                </button>
              </div>

              {/* Primary Action 2: Copy Save Code */}
              <div className="bg-indigo-950/20 border border-indigo-500/30 p-4 rounded-2xl space-y-2.5">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-xs font-black text-indigo-300 flex items-center space-x-1.5">
                      <Copy className="w-4 h-4 text-indigo-400" />
                      <span>Option B: Copy Save Code</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Copy a shareable text code to paste in Discord, WhatsApp, Notes, or text message.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={saveCode}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[10px] font-mono text-indigo-300 focus:outline-none select-all truncate"
                  />
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs rounded-xl transition-all flex items-center space-x-1.5 shrink-0 shadow-md cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                </div>
              </div>

              {/* Raw JSON View Accordion */}
              <div className="border border-slate-850 rounded-2xl overflow-hidden bg-slate-950/40">
                <button
                  type="button"
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="w-full px-4 py-2.5 text-left text-[11px] font-bold text-slate-400 hover:text-slate-200 flex justify-between items-center transition-colors cursor-pointer"
                >
                  <span>View Raw Save JSON Data</span>
                  <span className="text-[10px] text-cyan-400 font-mono">{showRawJson ? 'Hide' : 'Expand'}</span>
                </button>
                {showRawJson && (
                  <div className="p-4 border-t border-slate-850 space-y-2 bg-slate-950">
                    <pre className="text-[9px] font-mono text-slate-400 max-h-48 overflow-y-auto p-2.5 bg-slate-900/80 rounded-xl border border-slate-800 select-all whitespace-pre-wrap">
                      {jsonString}
                    </pre>
                    <button
                      type="button"
                      onClick={handleCopyJson}
                      className="w-full py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      {copiedJson ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedJson ? 'JSON Copied to Clipboard!' : 'Copy Raw JSON String'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-850 flex justify-between items-center shrink-0">
          <span className="text-[10px] text-emerald-400 flex items-center space-x-1">
            <CheckCircle2 className="w-3 h-3 inline" />
            <span>Auto-saved to device storage</span>
          </span>
          <button
            type="button"
            onClick={() => {
              onClose();
              audio.playClick();
            }}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
