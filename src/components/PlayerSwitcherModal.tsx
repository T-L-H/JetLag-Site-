import React, { useState } from 'react';
import { RoomState, Team, Player } from '../types';
import { X, Crown, Users, Check, ArrowRight, UserCheck, Shield, Sparkles } from 'lucide-react';
import audio from '../lib/audio';

interface PlayerSwitcherModalProps {
  room: RoomState;
  currentUserName: string;
  isGM: boolean;
  onClose: () => void;
  onSelectPlayer: (playerName: string, teamName: string) => void;
  onToggleGM: (newGMState: boolean) => void;
}

export default function PlayerSwitcherModal({
  room,
  currentUserName,
  isGM,
  onClose,
  onSelectPlayer,
  onToggleGM,
}: PlayerSwitcherModalProps) {
  const [selectedName, setSelectedName] = useState<string>(currentUserName);
  const [selectedTeam, setSelectedTeam] = useState<string>(() => {
    const existing = room.players.find((p) => p.name === currentUserName);
    return existing ? existing.team : room.teams[0]?.name || 'Team 1';
  });

  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customTeam, setCustomTeam] = useState(room.teams[0]?.name || 'Team 1');

  const [gmState, setGmState] = useState<boolean>(isGM);

  const handleApply = () => {
    const finalPlayer = isCustomMode ? customName.trim() || currentUserName || 'Player' : selectedName;
    const finalTeam = isCustomMode ? customTeam : selectedTeam;

    if (gmState !== isGM) {
      onToggleGM(gmState);
    }

    onSelectPlayer(finalPlayer, finalTeam);
    audio.playSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-md w-full relative overflow-hidden flex flex-col space-y-4 max-h-[90vh]">
        <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex justify-between items-center pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-100 tracking-tight">Switch Player & Role</h3>
              <p className="text-[10px] text-slate-400">Change which player/team you are playing as</p>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              audio.playClick();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-850 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* GM Status Toggle Card */}
        <div className={`p-3 rounded-2xl border transition-all ${gmState ? 'bg-amber-950/30 border-amber-500/50' : 'bg-slate-950/60 border-slate-800'}`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2.5">
              <div className={`p-1.5 rounded-lg ${gmState ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                <Crown className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-black text-slate-100 block">
                  {gmState ? '👑 Game Master Mode: ENABLED' : 'Game Master Mode: Disabled'}
                </span>
                <span className="text-[9px] text-slate-400 block">
                  {gmState ? 'You can launch rounds, crown winners, and manage match state.' : 'You will play as a regular match participant.'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setGmState(!gmState);
                audio.playClick();
              }}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                gmState
                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                  : 'bg-slate-800 text-amber-400 hover:bg-slate-750 border border-slate-700'
              }`}
            >
              {gmState ? 'GM Active' : 'Claim GM'}
            </button>
          </div>
        </div>

        {/* Choose Player List */}
        <div className="space-y-2 overflow-y-auto flex-1 pr-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Select Active Player:
          </label>

          {room.players.length > 0 && (
            <div className="space-y-1.5">
              {room.players.map((p) => {
                const team = room.teams.find((t) => t.name === p.team);
                const isHiderRole = team?.role === 'HIDER';
                const isSelected = !isCustomMode && selectedName === p.name;

                return (
                  <div
                    key={p.id || p.name}
                    onClick={() => {
                      setIsCustomMode(false);
                      setSelectedName(p.name);
                      setSelectedTeam(p.team);
                      audio.playClick();
                    }}
                    className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-950/60 border-cyan-400/80 shadow-sm'
                        : 'bg-slate-950/50 border-slate-850 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${isSelected ? 'border-cyan-400 bg-cyan-400' : 'border-slate-600'}`}>
                        {isSelected && <Check className="w-2.5 h-2.5 text-slate-950 stroke-[3]" />}
                      </div>
                      <span className="text-xs font-bold text-slate-100">{p.name}</span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <span className="text-[10px] font-medium text-slate-400">{p.team}</span>
                      <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${isHiderRole ? 'bg-rose-500/20 text-rose-300' : 'bg-blue-500/20 text-blue-300'}`}>
                        {team?.role || 'SEEKER'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Custom Name / New Identity Option */}
          <div
            onClick={() => {
              setIsCustomMode(true);
              audio.playClick();
            }}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
              isCustomMode
                ? 'bg-indigo-950/60 border-cyan-400/80'
                : 'bg-slate-950/50 border-slate-850 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${isCustomMode ? 'border-cyan-400 bg-cyan-400' : 'border-slate-600'}`}>
                {isCustomMode && <Check className="w-2.5 h-2.5 text-slate-950 stroke-[3]" />}
              </div>
              <span className="text-xs font-bold text-slate-200">Switch to custom name or new team</span>
            </div>

            {isCustomMode && (
              <div className="mt-3 pt-2.5 border-t border-slate-900 grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Your Name</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Adam"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Select Team</label>
                  <select
                    value={customTeam}
                    onChange={(e) => setCustomTeam(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                  >
                    {room.teams.map((t) => (
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

        {/* Modal Footer */}
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
            onClick={handleApply}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 text-xs font-black rounded-xl shadow-lg transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <span>Apply Identity & Role</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
