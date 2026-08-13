import React, { useState } from 'react';
import { RoomState } from '../types';
import { createSaveData, exportSaveFile, encodeSaveCode, formatSecondsToTime, saveToLocalStorage } from '../lib/saveGame';
import { Download, Copy, Check, X, Shield, Trophy, Clock, Users, FileJson, CheckCircle2, BookmarkCheck } from 'lucide-react';
import audio from '../lib/audio';

interface SaveGameModalProps {
  room: RoomState;
  onClose: () => void;
}

export default function SaveGameModal({ room, onClose }: SaveGameModalProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  const saveData = createSaveData(room);
  const saveCode = encodeSaveCode(saveData);
  const jsonString = JSON.stringify(saveData, null, 2);

  // Auto-save to localStorage as well
  React.useEffect(() => {
    saveToLocalStorage(saveData);
  }, []);

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
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-xl w-full relative overflow-hidden flex flex-col max-h-[90vh]">
        <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-2xl">
              <BookmarkCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-100 tracking-tight flex items-center space-x-2">
                <span>Save & Backup Game</span>
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full font-mono font-bold">
                  {room.code}
                </span>
              </h3>
              <p className="text-xs text-slate-400">Save match state to resume on another day</p>
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

        {/* Scrollable Body */}
        <div className="overflow-y-auto space-y-4 py-4 pr-1 flex-1">
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
