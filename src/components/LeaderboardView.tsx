import React, { useState } from 'react';
import { RoomState } from '../types';
import { Trophy, RefreshCw, Sparkles, ShieldAlert, CheckCircle, Flame, ArrowRight, Award } from 'lucide-react';
import audio from '../lib/audio';

interface LeaderboardViewProps {
  room: RoomState;
  onNextRound: () => void;
  onResetGame: () => void;
  isGM: boolean;
}

export default function LeaderboardView({
  room,
  onNextRound,
  onResetGame,
  isGM,
}: LeaderboardViewProps) {
  const [playerReady, setPlayerReady] = useState(false);
  const [winnerDismissed, setWinnerDismissed] = useState(false);

  // Sort teams by score descending (highest hiding time wins!)
  const sortedTeams = [...room.teams].sort((a, b) => b.score - a.score);
  const winnerTeam = sortedTeams[0];

  // Helper to format score (seconds) to MM:SS
  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}m ${s}s`;
  };

  if (room.gamePhase === 'INTERMISSION') {
    const nextHiderIndex = room.hiderSequence[room.hiderSequence.indexOf(room.hiderTeamIndex) + 1];
    const nextHiderTeam = room.teams[nextHiderIndex];

    return (
      <div className="max-w-xl mx-auto py-6 space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-cyan-500 to-indigo-500" />
          
          <div className="p-4 bg-cyan-500/10 text-cyan-400 rounded-full w-fit mx-auto animate-pulse">
            <CheckCircle className="w-10 h-10" />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] uppercase font-black tracking-widest text-cyan-400">Match Round Over</span>
            <h2 className="text-2xl font-black text-slate-100 tracking-tight">HIDER CAPTURED!</h2>
            <p className="text-xs text-slate-400">
              The seeker team successfully tracked and tagged the hiders in the field.
            </p>
          </div>

          {/* Round Score Breakdown (Overhauled!) */}
          {room.lastHidingScoreDetails && (
            <div className="bg-gradient-to-br from-slate-950 to-slate-900 border border-cyan-500/30 p-4 rounded-2xl text-left space-y-3 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest block">📊 ROUND SCORE BREAKDOWN</span>
                <span className="text-[9px] font-extrabold bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-md border border-cyan-500/20 uppercase tracking-wider">
                  {room.lastHidingScoreDetails.hiderTeamName}
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                {/* Base Hiding Time Row */}
                <div className="flex justify-between items-center bg-slate-950/45 p-2 rounded-xl border border-slate-900">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-slate-400">⏱️ Surviving Hiding Time</span>
                  </div>
                  <span className="font-mono text-slate-100 font-bold">{formatTime(room.lastHidingScoreDetails.baseHidingTime)}</span>
                </div>

                {/* Hand Time Bonuses Row */}
                <div className="bg-slate-950/45 p-2 rounded-xl border border-slate-900 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">⏳ Hand Time Bonus Cards</span>
                    <span className="font-mono text-emerald-400 font-extrabold">
                      +{Math.floor(room.lastHidingScoreDetails.handTimeBonuses / 60)}m 0s
                    </span>
                  </div>
                  
                  {room.lastHidingScoreDetails.bonusCards.length > 0 ? (
                    <div className="grid grid-cols-1 gap-1 border-t border-slate-900 pt-1.5 pl-1.5">
                      {room.lastHidingScoreDetails.bonusCards.map((bc, idx) => {
                        const rColor = bc.rarity === 'RED' ? 'text-rose-400' : bc.rarity === 'ORANGE' ? 'text-orange-400' : bc.rarity === 'YELLOW' ? 'text-amber-400' : bc.rarity === 'GREEN' ? 'text-emerald-400' : 'text-blue-400';
                        return (
                          <div key={idx} className="flex justify-between text-[10px]">
                            <span className="text-slate-500 truncate flex items-center space-x-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500/40" />
                              <span>{bc.title} ({bc.rarity})</span>
                            </span>
                            <span className={`font-mono font-bold ${rColor}`}>+{bc.bonusMin}m</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 italic pl-1.5 pt-0.5">No TIME bonus cards held in hand.</p>
                  )}
                </div>

                {/* Final Score Row */}
                <div className="flex justify-between items-center bg-cyan-950/20 border border-cyan-500/25 p-2 rounded-xl">
                  <span className="text-cyan-300 font-extrabold uppercase text-[10px] tracking-wider">Final Survival Score</span>
                  <span className="font-mono text-cyan-400 font-black text-sm">{formatTime(room.lastHidingScoreDetails.finalScore)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Scores table */}
          <div className="bg-slate-950/80 border border-slate-850 p-4 rounded-2xl text-left space-y-3">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-900 pb-1.5">
              Round Standings
            </h4>
            <div className="space-y-2">
              {room.teams.map((team) => (
                <div key={team.name} className="flex justify-between items-center text-xs">
                  <span className={`font-semibold ${team.role === 'HIDER' ? 'text-rose-400 font-extrabold' : 'text-slate-300'}`}>
                    {team.name} {team.role === 'HIDER' ? '(Hider)' : ''}
                  </span>
                  <span className="font-mono text-slate-200 font-bold">{formatTime(team.score)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Next Hider Announcement */}
          {nextHiderTeam ? (
            <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl flex items-center space-x-3 text-left">
              <Flame className="w-5 h-5 text-indigo-400 shrink-0" />
              <div>
                <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest block">Up Next Hiding:</span>
                <p className="text-xs text-slate-200 font-bold mt-0.5">
                  Team "{nextHiderTeam.name}" is chosen to hide in the next round!
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-center space-x-3 text-left">
              <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest block">Grand Finale:</span>
                <p className="text-xs text-slate-200 font-bold mt-0.5">
                  All teams have hidden! The match is ready to crown the final Champion.
                </p>
              </div>
            </div>
          )}

          {/* Ready Check button */}
          <div className="pt-4 border-t border-slate-850/60 space-y-3">
            {!playerReady ? (
              <button
                onClick={() => {
                  setPlayerReady(true);
                  audio.playSuccess();
                }}
                className="w-full py-3 bg-slate-950 hover:bg-slate-900 text-cyan-400 hover:text-cyan-300 border border-slate-800 text-xs font-black rounded-xl transition-all shadow cursor-pointer"
              >
                {nextHiderTeam ? "Ready to start next round? -> YES" : "Ready to view final results? -> YES"}
              </button>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-center text-xs text-emerald-400 font-bold">
                ✓ Ready verified! Waiting for Game Master to launch.
              </div>
            )}

            {isGM && (
              <button
                onClick={() => {
                  onNextRound();
                  audio.playSuccess();
                }}
                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 font-black text-xs rounded-xl shadow cursor-pointer transition-transform hover:scale-[1.01]"
              >
                <span>{nextHiderTeam ? "GM: Launch Next Round" : "GM: Crown Champion & View Results"}</span>
                <ArrowRight className="w-4 h-4 inline-block ml-1" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // GAME OVER CHAMPIONSHIP SCREEN
  return (
    <div className="max-w-xl mx-auto py-6 space-y-6">
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500" />
        
        {/* Championship Header */}
        <div className="text-center space-y-2 pt-4">
          <div className="p-3.5 bg-amber-500/10 text-amber-400 rounded-full w-fit mx-auto animate-bounce">
            <Trophy className="w-10 h-10" />
          </div>
          <span className="text-[10px] uppercase font-black tracking-widest text-amber-400">Jet Tracker Championship</span>
          <h2 className="text-2xl font-black text-slate-100 tracking-tight">GRAND STANDINGS</h2>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Official score ledger. Longest time spent hidden in the searchable grid crowns the champion.
          </p>
        </div>

        {/* Podiums Render */}
        <div className="space-y-3">
          {sortedTeams.map((team, idx) => {
            const isFirst = idx === 0;
            const isSecond = idx === 1;
            const isThird = idx === 2;

            let badgeColor = 'bg-slate-950 text-slate-400 border-slate-850';
            let rankSymbol = `${idx + 1}th`;

            if (isFirst) {
              badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/30 font-black';
              rankSymbol = '🏆 1st';
            } else if (isSecond) {
              badgeColor = 'bg-slate-300/10 text-slate-300 border-slate-300/20';
              rankSymbol = '🥈 2nd';
            } else if (isThird) {
              badgeColor = 'bg-amber-700/10 text-amber-700 border-amber-700/20';
              rankSymbol = '🥉 3rd';
            }

            return (
              <div
                key={team.name}
                className={`border p-4 rounded-2xl flex items-center justify-between ${
                  isFirst
                    ? 'bg-amber-500/5 border-amber-500/30 ring-1 ring-amber-500/10 shadow-lg shadow-amber-950/10'
                    : 'bg-slate-950/55 border-slate-850'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-xl border ${badgeColor}`}>
                    {rankSymbol}
                  </span>
                  <div>
                    <h4 className="text-sm font-black text-slate-100">{team.name}</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Players: <span className="text-slate-300">{team.players.join(', ')}</span>
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block text-[9px]">Total score:</span>
                  <span className="font-mono text-sm font-black text-slate-200">{formatTime(team.score)}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t border-slate-850/60 flex justify-center">
          {isGM && (
            <button
              onClick={() => {
                onResetGame();
                audio.playSuccess();
              }}
              className="w-full py-3 bg-rose-500 hover:bg-rose-400 text-slate-950 rounded-xl text-xs font-black flex items-center justify-center space-x-1.5 transition-all shadow cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 animate-spin" style={{ animationDuration: '4s' }} />
              <span>GM: Reset & Rematch</span>
            </button>
          )}
        </div>
      </div>

      {/* Celebratory Championship Winner Modal */}
      {room.gamePhase === 'END' && !winnerDismissed && winnerTeam && (
        <div className="fixed inset-0 z-[999] bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6">
          <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl p-8 max-w-sm w-full text-center space-y-6 shadow-[0_0_50px_rgba(245,158,11,0.25)] relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600" />
            
            <div className="relative">
              <div className="p-4 bg-amber-500/10 text-amber-400 rounded-full w-fit mx-auto animate-bounce">
                <Trophy className="w-12 h-12" />
              </div>
              <div className="absolute -top-1 -right-1 animate-pulse">
                <Sparkles className="w-6 h-6 text-yellow-300 animate-pulse" />
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 font-mono">Championship Complete</span>
              <h2 className="text-2xl font-black text-slate-100 tracking-tight">CROWN THE CHAMPION!</h2>
              <div className="py-4 px-3 bg-slate-950/60 border border-amber-500/20 rounded-2xl">
                <p className="text-xs text-slate-400">Winning Team</p>
                <h3 className="text-lg font-black text-amber-300 uppercase tracking-wide mt-1">
                  👑 {winnerTeam.name}
                </h3>
                <p className="text-xs text-slate-400 mt-2">
                  Total Survival Time:<br/>
                  <span className="font-mono text-sm font-black text-slate-100">{formatTime(winnerTeam.score)}</span>
                </p>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-normal">
              Congratulations to all operatives! The hunt has concluded. Take a screenshot of the results on your device to share!
            </p>

            <button
              onClick={() => {
                setWinnerDismissed(true);
                audio.playSuccess();
              }}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-transform hover:scale-[1.01] cursor-pointer"
            >
              View Grand Standings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
