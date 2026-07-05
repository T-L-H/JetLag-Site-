import React, { useState, useEffect } from 'react';
import { Card, RoomState, ActiveQuestion, ActiveCurse } from '../types';
import { Shield, Sparkles, MapPin, CheckCircle, Flame, Eye, EyeOff, Camera, RefreshCw, Layers, Check, X, AlertTriangle, HelpCircle } from 'lucide-react';
import audio from '../lib/audio';
import { getCurseDiscardRequirement } from '../lib/cardsData';

interface HiderViewProps {
  room: RoomState;
  userName: string;
  onStartHidingTimer: () => void;
  onTransitPinDropped: () => void;
  onDoneHiding: () => void;
  onAnswerQuestion: (answerValue: boolean | string, photoUrl?: string) => void;
  onVetoQuestion: (cardId: string) => void;
  onPlayPowerup: (cardId: string, targetCardId?: string, targetCardIds?: string[]) => void;
  onCastCurse: (cardId: string, fulfilledCost: boolean, discardCardIds?: string[]) => void;
  onConfirmCurseDismissal: (curseId: string, confirmed: boolean) => void;
  onCatchHider: () => void;
  enableTransitSelection: () => void;
  transitPin: { lat: number; lng: number } | null;
  onPickDraft: (cardIds: string[]) => void;
}

// Standard Haversine distance in miles
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Radius of Earth in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getTentaclePoiType(tentaclePoi: string): string {
  switch (tentaclePoi) {
    case 'Museums': return 'Museum';
    case 'Libraries': return 'Library';
    case 'Movie Theatres': return 'Movie Theatre';
    case 'Hospitals': return 'Hospital';
    case 'Metro Lines': return 'Rail Station';
    case 'Zoos': return 'Zoo';
    case 'Aquariums': return 'Aquarium';
    case 'Amusement Parks': return 'Amusement Park';
    default: return tentaclePoi;
  }
}

interface EvaluationResult {
  value: boolean;
  label: string;
  details: React.ReactNode;
}

function evaluateActiveQuestion(room: RoomState): EvaluationResult | null {
  const q = room.activeQuestion;
  if (!q) return null;

  const hiderTeam = room.teams[room.hiderTeamIndex];
  const hiderLat = hiderTeam?.lat || room.centerLat;
  const hiderLng = hiderTeam?.lng || room.centerLng;

  const seekerTeam = room.teams.find((t) => t.role === 'SEEKER');
  const seekerLat = seekerTeam?.lat || room.centerLat;
  const seekerLng = seekerTeam?.lng || room.centerLng;

  const pois = room.pois || [];

  if (q.type === 'MATCHING') {
    const targetType = q.poiType || '';
    const filteredPois = pois.filter((p) => p.type.toLowerCase() === targetType.toLowerCase());

    if (filteredPois.length === 0) {
      return {
        value: false,
        label: 'NO POIs FOUND',
        details: <span className="text-slate-400">No landmarks of type "{targetType}" exist in the play area.</span>
      };
    }

    let seekerClosest = filteredPois[0];
    let minSeekerDist = Infinity;
    filteredPois.forEach((p) => {
      const d = getDistance(seekerLat, seekerLng, p.lat, p.lng);
      if (d < minSeekerDist) {
        minSeekerDist = d;
        seekerClosest = p;
      }
    });

    let hiderClosest = filteredPois[0];
    let minHiderDist = Infinity;
    filteredPois.forEach((p) => {
      const d = getDistance(hiderLat, hiderLng, p.lat, p.lng);
      if (d < minHiderDist) {
        minHiderDist = d;
        hiderClosest = p;
      }
    });

    const isSame = seekerClosest.id === hiderClosest.id;

    return {
      value: isSame,
      label: isSame ? 'YES' : 'NO',
      details: (
        <div className="space-y-1 text-[11px] text-slate-300">
          <p>• Your closest {targetType}: <span className="text-rose-400 font-bold">{hiderClosest.name}</span> ({minHiderDist.toFixed(2)} mi)</p>
          <p>• Seeker's closest {targetType}: <span className="text-cyan-400 font-bold">{seekerClosest.name}</span> ({minSeekerDist.toFixed(2)} mi)</p>
          <p className="text-[10px] text-slate-400 mt-1">
            {isSame 
              ? '✅ Since both of you share the same closest landmark, the answer is YES.' 
              : '❌ Since your closest landmarks are different, the answer is NO.'}
          </p>
        </div>
      )
    };
  }

  if (q.type === 'MEASURING') {
    const pin = q.customPin;
    if (!pin) {
      return {
        value: true,
        label: 'RESOLVE',
        details: <span className="text-slate-400">No target pin coordinates received.</span>
      };
    }

    const hiderDistToSeeker = getDistance(hiderLat, hiderLng, seekerLat, seekerLng);
    const hiderDistToPin = getDistance(hiderLat, hiderLng, pin.lat, pin.lng);
    const hiderIsCloserToSeeker = hiderDistToSeeker < hiderDistToPin;

    return {
      value: true,
      label: hiderIsCloserToSeeker ? 'Closer to SEEKER' : 'Closer to CUSTOM PIN',
      details: (
        <div className="space-y-1 text-[11px] text-slate-300">
          <p>• Your distance to Seeker: <span className="text-cyan-400 font-mono font-bold">{hiderDistToSeeker.toFixed(2)} mi</span></p>
          <p>• Your distance to Target Pin: <span className="text-amber-400 font-mono font-bold">{hiderDistToPin.toFixed(2)} mi</span></p>
          <p className="text-[10px] text-slate-400 mt-1">
            {hiderIsCloserToSeeker
              ? '🔍 You are closer to the Seeker than to the target pin.'
              : '📍 You are closer to the custom target pin than to the Seeker.'}
          </p>
        </div>
      )
    };
  }

  if (q.type === 'THERMOMETER') {
    const start = q.startPin;
    const end = q.endPin;
    if (!start || !end) {
      return {
        value: false,
        label: 'COLDER',
        details: <span className="text-slate-400">Thermometer start/end pin coordinates missing.</span>
      };
    }

    const distToStart = getDistance(hiderLat, hiderLng, start.lat, start.lng);
    const distToEnd = getDistance(hiderLat, hiderLng, end.lat, end.lng);
    const isHotter = distToEnd < distToStart;

    return {
      value: isHotter,
      label: isHotter ? 'HOTTER' : 'COLDER',
      details: (
        <div className="space-y-1 text-[11px] text-slate-300">
          <p>• Your distance to Seeker\'s Start: <span className="text-slate-400 font-mono">{distToStart.toFixed(2)} mi</span></p>
          <p>• Your distance to Seeker\'s Current: <span className="text-orange-400 font-mono font-bold">{distToEnd.toFixed(2)} mi</span></p>
          <p className="text-[10px] text-slate-400 mt-1">
            {isHotter
              ? '🔥 Seeker\'s current position is closer to you than their starting pin. HOTTER!'
              : '❄️ Seeker\'s current position is further from you than their starting pin. COLDER!'}
          </p>
        </div>
      )
    };
  }

  if (q.type === 'RADAR') {
    const radius = q.distanceValue || 1.0;
    const distToSeeker = getDistance(hiderLat, hiderLng, seekerLat, seekerLng);
    const isWithin = distToSeeker <= radius;

    return {
      value: isWithin,
      label: isWithin ? 'YES (Within Circle)' : 'NO (Outside Circle)',
      details: (
        <div className="space-y-1 text-[11px] text-slate-300">
          <p>• Your distance to Seeker: <span className="text-purple-400 font-mono font-bold">{distToSeeker.toFixed(2)} mi</span></p>
          <p>• Radar circle radius: <span className="text-slate-400 font-mono">{radius.toFixed(2)} mi</span></p>
          <p className="text-[10px] text-slate-400 mt-1">
            {isWithin
              ? '✅ You are inside the Radar circle. Slices map to inside the circle.'
              : '❌ You are outside the Radar circle. Slices/eliminates the circle.'}
          </p>
        </div>
      )
    };
  }

  if (q.type === 'TENTACLES') {
    const radius = q.distanceValue || 1.0;
    const distToSeeker = getDistance(hiderLat, hiderLng, seekerLat, seekerLng);
    const hiderIsInsideCircle = distToSeeker <= radius;

    const targetCategory = q.poiType || '';
    const targetType = getTentaclePoiType(targetCategory).toLowerCase();
    const filteredPois = pois.filter((p) => {
      if (targetType === 'rail station') {
        return (
          p.type.toLowerCase() === 'rail station' ||
          p.type.toLowerCase() === 'transit line' ||
          p.type.toLowerCase().includes('train')
        );
      }
      return p.type.toLowerCase().includes(targetType);
    });

    if (!hiderIsInsideCircle) {
      return {
        value: false,
        label: 'OUTSIDE (Circle eliminated)',
        details: (
          <div className="space-y-1 text-[11px] text-slate-300">
            <p>• Your distance to Seeker: <span className="text-rose-400 font-mono font-bold">{distToSeeker.toFixed(2)} mi</span></p>
            <p>• Tentacles circle radius: <span className="text-slate-400 font-mono">{radius.toFixed(2)} mi</span></p>
            <p className="text-[10px] text-rose-400/90 mt-1">
              ❌ You are OUTSIDE the circle! The entire {radius} mi circle will be sliced away.
            </p>
          </div>
        )
      };
    }

    const poisInCircle = filteredPois.filter(p => getDistance(seekerLat, seekerLng, p.lat, p.lng) <= radius);

    if (poisInCircle.length === 0) {
      return {
        value: true,
        label: 'INSIDE (No POIs in radius)',
        details: (
          <div className="space-y-1 text-[11px] text-slate-300">
            <p>• Your distance to Seeker: <span className="text-emerald-400 font-mono font-bold">{distToSeeker.toFixed(2)} mi</span></p>
            <p>• No "{targetCategory}" POIs exist within the {radius} mi radius circle.</p>
          </div>
        )
      };
    }

    let hiderClosest = poisInCircle[0];
    let minHiderDist = Infinity;
    poisInCircle.forEach((p) => {
      const d = getDistance(hiderLat, hiderLng, p.lat, p.lng);
      if (d < minHiderDist) {
        minHiderDist = d;
        hiderClosest = p;
      }
    });

    return {
      value: true,
      label: `INSIDE (Closest to: ${hiderClosest.name})`,
      details: (
        <div className="space-y-1 text-[11px] text-slate-300">
          <p>• Your distance to Seeker: <span className="text-emerald-400 font-mono font-bold">{distToSeeker.toFixed(2)} mi</span> (Inside!)</p>
          <p>• Your closest "{targetCategory}" landmark: <span className="text-amber-400 font-bold">{hiderClosest.name}</span> ({minHiderDist.toFixed(2)} mi)</p>
          <p className="text-[10px] text-slate-400 mt-1">
            ✅ The map will restrict search to your Voronoi cell for this landmark.
          </p>
        </div>
      )
    };
  }

  return null;
}

export default function HiderView({
  room,
  userName,
  onStartHidingTimer,
  onTransitPinDropped,
  onDoneHiding,
  onAnswerQuestion,
  onVetoQuestion,
  onPlayPowerup,
  onCastCurse,
  onConfirmCurseDismissal,
  onCatchHider,
  enableTransitSelection,
  transitPin,
  onPickDraft,
}: HiderViewProps) {
  // Navigation & interaction states
  const [activeTab, setActiveTab] = useState<'HAND' | 'STATUS' | 'QUESTIONS'>('HAND');
  
  // Powerup targets selectors
  const [activePowerupCard, setActivePowerupCard] = useState<Card | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  
  // Curse casting validation modal
  const [activeCurseToCast, setActiveCurseToCast] = useState<Card | null>(null);
  const [curseDiscardIds, setCurseDiscardIds] = useState<string[]>([]);

  // Photo Question Upload State
  const [photoBase64, setPhotoBase64] = useState<string>('');
  const [uploading, setUploading] = useState(false);

  // Card Draft choices selection state
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedDraftIds([]);
  }, [room.pendingDraft?.id]);

  // Catch holding mechanism
  const [catchPressed, setCatchPressed] = useState(false);
  const [catchProgress, setCatchProgress] = useState(0);

  // Discard down to 6 validation
  const maxHandSize = 6;
  const isHandOverlimit = room.hiderHand.length > maxHandSize;

  // Countdown clock formatting helper
  const [timeRemaining, setTimeRemaining] = useState<string>('10:00');

  const getInitialTimeString = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
    }
    return `${m.toString().padStart(2, '0')}:00`;
  };

  useEffect(() => {
    if (room.hidingEndTime) {
      const interval = setInterval(() => {
        const diff = room.hidingEndTime! - Date.now();
        if (diff <= 0) {
          setTimeRemaining('00:00');
          clearInterval(interval);
        } else {
          const h = Math.floor(diff / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          if (h > 0) {
            setTimeRemaining(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
          } else {
            setTimeRemaining(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
          }
        }
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setTimeRemaining(getInitialTimeString(room.hidingTimeLimit || 10));
    }
  }, [room.hidingEndTime, room.hidingTimeLimit]);

  // Handle Catch Button holding mechanism
  useEffect(() => {
    let interval: any;
    if (catchPressed) {
      interval = setInterval(() => {
        setCatchProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            onCatchHider();
            audio.playSuccess();
            return 100;
          }
          return prev + 5;
        });
      }, 100);
    } else {
      setCatchProgress(0);
    }
    return () => clearInterval(interval);
  }, [catchPressed, onCatchHider]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoBase64(reader.result as string);
      setUploading(false);
      audio.playSuccess();
    };
    reader.readAsDataURL(file);
  };

  const handleCastConfirm = (fulfilled: boolean) => {
    if (!activeCurseToCast) return;
    onCastCurse(activeCurseToCast.id, fulfilled, fulfilled ? curseDiscardIds : undefined);
    setActiveCurseToCast(null);
    setCurseDiscardIds([]);
  };

  const executePowerupPlay = () => {
    if (!activePowerupCard) return;

    if (activePowerupCard.title === 'Duplicate') {
      if (!selectedTargetId) return;
      onPlayPowerup(activePowerupCard.id, selectedTargetId);
    } 
    else if (activePowerupCard.title === 'Discard 1, Draw 2') {
      if (!selectedTargetId) return;
      onPlayPowerup(activePowerupCard.id, selectedTargetId);
    } 
    else if (activePowerupCard.title === 'Discard 2, Draw 3') {
      if (selectedTargetIds.length !== 2) return;
      onPlayPowerup(activePowerupCard.id, undefined, selectedTargetIds);
    } 
    else {
      // Direct execute
      onPlayPowerup(activePowerupCard.id);
    }

    setActivePowerupCard(null);
    setSelectedTargetId('');
    setSelectedTargetIds([]);
    audio.playSuccess();
  };

  const handleVeto = (vetoCardId: string) => {
    audio.playSuccess();
    onVetoQuestion(vetoCardId);
  };

  // --- RENDERS ---

  // Phase 1: Hiding countdown and Station Dropping
  if (room.gamePhase === 'HIDING') {
    return (
      <div className="space-y-6 max-w-xl mx-auto py-2">
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden text-center">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 to-rose-500" />
          <h2 className="text-xl font-black text-rose-400 font-sans tracking-tight mb-1 flex items-center justify-center space-x-2">
            <Flame className="w-5 h-5 animate-pulse" />
            <span>YOU ARE THE CHOSEN HIDER</span>
          </h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            You must escape! Travel to your chosen station, drop your boundary, and find a stealthy hiding spot.
          </p>

          {/* Hiding Countdown Clock */}
          <div className="my-6 bg-slate-950/80 border border-slate-850 p-4 rounded-2xl max-w-xs mx-auto">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Hiding Period Clock</span>
            <div className="text-4xl font-black tracking-widest text-rose-400 font-sans mt-1">
              {room.hidingEndTime ? timeRemaining : getInitialTimeString(room.hidingTimeLimit || 10)}
            </div>
            {!room.hidingEndTime && (
              <button
                onClick={() => {
                  onStartHidingTimer();
                  audio.playClick();
                }}
                className="mt-3 bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-black px-4 py-2 rounded-xl transition-all shadow"
              >
                Start Hiding Timer
              </button>
            )}
          </div>

          {/* Transit Drop Section */}
          <div className="space-y-3 bg-slate-950/40 border border-slate-850 p-5 rounded-2xl">
            <div className="flex items-center justify-between text-left">
              <div>
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Step 1: Board & Drop Pin</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Arrive at transit station, click map to mark anchor pin</p>
              </div>
              <MapPin className="w-5 h-5 text-rose-500" />
            </div>

            {transitPin ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl flex items-center justify-between text-left">
                <div>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center space-x-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Station Coordinate Registered</span>
                  </span>
                  <span className="text-[10px] text-slate-300 font-mono mt-1 block">
                    Lat: {transitPin.lat.toFixed(5)} • Lng: {transitPin.lng.toFixed(5)}
                  </span>
                </div>
                <button
                  onClick={enableTransitSelection}
                  className="text-[10px] text-slate-400 hover:text-white border border-slate-800 px-2.5 py-1 rounded-lg"
                >
                  Change
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  enableTransitSelection();
                  audio.playClick();
                }}
                className="w-full py-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all"
              >
                📍 Select Transit Station on Map
              </button>
            )}

            {transitPin && !room.hidingStationPin && (
              <button
                onClick={() => {
                  onTransitPinDropped();
                  audio.playSuccess();
                }}
                className="w-full py-2 bg-pink-500 hover:bg-pink-400 text-slate-950 text-xs font-extrabold rounded-xl shadow mt-2"
              >
                Confirm Station Coordinates
              </button>
            )}
          </div>

          {/* Ready to Play Button */}
          <div className="mt-6 pt-4 border-t border-slate-850">
            <button
              onClick={() => {
                onDoneHiding();
                audio.playSuccess();
              }}
              disabled={!room.hidingStationPin}
              className={`w-full py-3.5 rounded-2xl font-black text-sm tracking-wide transition-all shadow ${
                room.hidingStationPin
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:scale-[1.01]'
                  : 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
              }`}
            >
              🚀 Done Hiding • Start Seeking Run
            </button>
            {!room.hidingStationPin && (
              <p className="text-[10px] text-rose-400 mt-2">
                ⚠️ You must drop and confirm your Transit Station Drop Pin before seek mode activates.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Phase 2 & 3: Seeking, cards, deck, questions active
  const pendingCurses = room.activeCurses.filter((c) => c.pendingConfirmation);
  const hasPendingCurses = pendingCurses.length > 0;

  return (
    <div className="space-y-4 max-w-xl mx-auto py-1">
      {/* High-priority Seeker Curse dismissal request (Modal Overlay) */}
      {hasPendingCurses && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[9999]">
          <div className="bg-[#180a0a] border-2 border-red-500 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4 text-center animate-pulse-slow">
            <div className="flex items-center justify-center space-x-3 text-red-400">
              <AlertTriangle className="w-8 h-8 animate-bounce shrink-0" />
              <div className="text-left">
                <h3 className="text-sm font-black uppercase tracking-wider">Seeker Curse Claim Under Review</h3>
                <p className="text-[10px] text-amber-400 font-bold font-mono uppercase">⏱️ GAME CLOCK PAUSED UNTIL DECISION</p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              The Seeker team claims they have physically broken one of your active curses. You must review and approve or reject their claim to resume play.
            </p>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {pendingCurses.map((curse) => (
                <div key={curse.id} className="bg-slate-950 border border-red-500/20 p-4 rounded-2xl space-y-3 text-left">
                  <div>
                    <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider block">Active Curse:</span>
                    <h4 className="text-xs font-black text-slate-100">{curse.title}</h4>
                    <p className="text-[10px] text-slate-400 mt-1 leading-normal">{curse.seekerEffect}</p>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                    <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider block">Fulfillment / Dismissal Requirement:</span>
                    <p className="text-xs text-slate-200 font-bold leading-normal mt-0.5">
                      {curse.dismissalDesc}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      onClick={() => {
                        onConfirmCurseDismissal(curse.id, true);
                        audio.playCurseDismissed();
                      }}
                      className="py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-black rounded-xl transition-all shadow cursor-pointer text-center hover:opacity-90"
                    >
                      ✅ Approve (Dismiss Curse)
                    </button>
                    <button
                      onClick={() => {
                        onConfirmCurseDismissal(curse.id, false);
                        audio.playClick();
                      }}
                      className="py-2.5 bg-rose-500/20 hover:bg-rose-500 text-rose-300 text-xs font-black rounded-xl transition-all border border-rose-500/30 cursor-pointer text-center hover:opacity-90"
                    >
                      ❌ Reject Claim
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hand Overlimit warning */}
      {isHandOverlimit && (
        <div className="bg-rose-500/15 border border-rose-500/30 p-4 rounded-2xl text-center flex flex-col items-center space-y-2 animate-pulse">
          <AlertTriangle className="w-6 h-6 text-rose-400" />
          <h3 className="text-xs font-black text-rose-300 uppercase tracking-wider">Hand Size Over Limit ({room.hiderHand.length}/6)</h3>
          <p className="text-[10px] text-slate-400 max-w-xs">
            You are holding too many cards! You must discard down to 6 cards before performing other actions.
          </p>
          <div className="flex space-x-2 mt-1">
            <button
              onClick={() => {
                setActiveTab('HAND');
                audio.playClick();
              }}
              className="bg-rose-500 text-slate-950 text-[10px] font-extrabold px-3 py-1.5 rounded-xl shadow"
            >
              Open Hand to Discard
            </button>
          </div>
        </div>
      )}

      {/* Tabs navigation */}
      <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-850">
        <button
          onClick={() => { setActiveTab('HAND'); audio.playClick(); }}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-1.5 ${
            activeTab === 'HAND' ? 'bg-slate-900 text-rose-400 shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Hand ({room.hiderHand.length})</span>
        </button>
        <button
          onClick={() => { setActiveTab('QUESTIONS'); audio.playClick(); }}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-1.5 relative ${
            activeTab === 'QUESTIONS' ? 'bg-slate-900 text-rose-400 shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Pending Question</span>
          {room.activeQuestion && room.activeQuestion.status === 'PENDING' && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full animate-ping" />
          )}
        </button>
        <button
          onClick={() => { setActiveTab('STATUS'); audio.playClick(); }}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-1.5 ${
            activeTab === 'STATUS' ? 'bg-slate-900 text-rose-400 shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Tracking Status</span>
        </button>
      </div>

      {/* TAB 1: HAND OF CARDS */}
      {activeTab === 'HAND' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Hiders Hand Management</span>
            <span className={`text-[10px] font-bold ${isHandOverlimit ? 'text-rose-400' : 'text-slate-400'}`}>
              Hand Size: {room.hiderHand.length}/6
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {room.hiderHand.map((card) => {
              const isTimeCard = card.type === 'TIME';
              const isVetoCard = card.title === 'Veto';
              const isDuplicate = card.title === 'Duplicate';
              const isDiscard1Draw2 = card.title === 'Discard 1, Draw 2';
              const isDiscard2Draw3 = card.title === 'Discard 2, Draw 3';
              
              const canVeto = isVetoCard && room.activeQuestion && room.activeQuestion.status === 'PENDING';

              let rarityColor = 'border-slate-800 text-slate-400 bg-slate-950/40';
              if (card.rarity === 'RED') rarityColor = 'border-rose-900/50 text-rose-400 bg-rose-950/10';
              if (card.rarity === 'ORANGE') rarityColor = 'border-orange-900/50 text-orange-400 bg-orange-950/10';
              if (card.rarity === 'YELLOW') rarityColor = 'border-amber-950 text-amber-400 bg-amber-950/10';
              if (card.rarity === 'GREEN') rarityColor = 'border-emerald-950 text-emerald-400 bg-emerald-950/10';
              if (card.rarity === 'BLUE') rarityColor = 'border-blue-950 text-blue-400 bg-blue-950/10';

              return (
                <div
                  key={card.id}
                  className={`border rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden shadow-md transition-all hover:scale-[1.01] ${rarityColor}`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] uppercase font-bold tracking-widest opacity-80">
                        {card.type}
                      </span>
                      <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded-md bg-slate-900 text-slate-300 border border-slate-800">
                        {card.rarity}
                      </span>
                    </div>
                    <h4 className="text-xs font-black tracking-tight text-slate-100">{card.title}</h4>
                    <p className="text-[10px] text-slate-300 leading-normal opacity-90">{card.desc}</p>
                    
                    {card.costDesc && (
                      <div className="text-[9px] text-slate-400 border-t border-slate-850 pt-1.5 mt-1.5">
                        <b>Cost:</b> {card.costDesc}
                      </div>
                    )}
                  </div>

                  {/* Actions mapping */}
                  <div className="mt-4 pt-2.5 border-t border-slate-850/60">
                    {isHandOverlimit ? (
                      <button
                        onClick={() => {
                          onPlayPowerup(card.id, 'DISCARD_ONLY'); // custom indicator to discard card on server
                          audio.playClick();
                        }}
                        className="w-full py-1.5 bg-rose-600/30 hover:bg-rose-600 text-rose-200 text-[10px] font-black rounded-lg transition-all"
                      >
                        🗑️ Discard Card
                      </button>
                    ) : (
                      <>
                        {isTimeCard && (
                          <div className="text-center text-[10px] font-bold text-amber-400 py-1 bg-amber-500/5 rounded-lg border border-amber-500/10">
                            ⏳ Keep in Hand (Adds score bonus!)
                          </div>
                        )}

                        {isVetoCard && (
                          <button
                            onClick={() => handleVeto(card.id)}
                            disabled={!canVeto}
                            className={`w-full py-1.5 text-[10px] font-black rounded-lg transition-all ${
                              canVeto
                                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer shadow'
                                : 'bg-slate-950 text-slate-500 border border-slate-850 cursor-not-allowed'
                            }`}
                          >
                            🛡️ {canVeto ? 'Veto Active Question' : 'Veto (No pending question)'}
                          </button>
                        )}

                        {card.type === 'CURSE' && (
                          <button
                            onClick={() => {
                              setActiveCurseToCast(card);
                              setCurseDiscardIds([]);
                              audio.playClick();
                            }}
                            className="w-full py-1.5 bg-rose-500 hover:bg-rose-400 text-slate-950 text-[10px] font-black rounded-lg transition-all shadow"
                          >
                            💀 Cast Curse
                          </button>
                        )}

                        {card.type === 'POWERUP' && !isVetoCard && (
                          <button
                            onClick={() => {
                              setActivePowerupCard(card);
                              audio.playClick();
                            }}
                            className="w-full py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-[10px] font-black rounded-lg transition-all"
                          >
                            ⚡ Play Powerup
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {room.hiderHand.length === 0 && (
              <div className="col-span-2 text-center py-10 text-xs text-slate-500 bg-slate-950/20 border border-dashed border-slate-850 rounded-2xl">
                Your hand is empty. Complete Seeker questions to draw more cards!
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PENDING QUESTIONS FROM SEEKERS */}
      {activeTab === 'QUESTIONS' && (
        <div className="space-y-4">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1">Active Seeker Proximity Query</span>

          {room.activeQuestion && room.activeQuestion.status === 'PENDING' ? (
            <div className="bg-slate-900 border border-amber-500/20 rounded-3xl p-5 shadow-2xl space-y-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-amber-500" />
              
              <div className="flex items-center justify-between">
                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                  Pending Answer
                </span>
                <span className="text-[10px] text-slate-400 font-mono font-bold">
                  Reward: {room.activeQuestion.rewardDesc}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-black text-slate-100">{room.activeQuestion.title}</h3>
                <p className="text-[10px] text-slate-400 mt-1">
                  Type: <span className="text-slate-300 font-semibold">{room.activeQuestion.type}</span>
                </p>
              </div>

              {/* Map Cut Math Estimate */}
              <div className="bg-slate-950/80 border border-slate-850 p-3 rounded-xl flex items-center space-x-3 text-left">
                <Layers className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <h4 className="text-[10px] font-bold text-amber-300">Potential Geospatial Cut Estimate</h4>
                  <p className="text-[9px] text-slate-400 leading-relaxed mt-0.5">
                    This answer will slice away approximately 30-55% of the remaining search grid from the Seekers.
                  </p>
                </div>
              </div>

              {/* Action Handlers */}
              <div className="space-y-3 pt-3 border-t border-slate-850">
                {room.activeQuestion.type === 'PHOTO' ? (
                  <div className="space-y-3">
                    <span className="block text-[10px] font-bold text-slate-400">Upload Native Subject Photograph:</span>
                    <div className="flex items-center space-x-3">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoUpload}
                        className="hidden"
                        id="camera-upload"
                      />
                      <label
                        htmlFor="camera-upload"
                        className="flex-1 py-2 px-3 bg-slate-950 border border-slate-850 hover:border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Camera className="w-4 h-4 text-rose-400" />
                        <span>{uploading ? 'Processing...' : photoBase64 ? 'Retake Photo' : 'Capture / Upload Photo'}</span>
                      </label>
                    </div>

                    {photoBase64 && (
                      <div className="border border-slate-800 rounded-xl overflow-hidden max-h-40 relative">
                        <img src={photoBase64} alt="Subject capture" className="w-full h-full object-cover" />
                        <button
                          onClick={() => setPhotoBase64('')}
                          className="absolute top-2 right-2 p-1 bg-slate-950/80 hover:bg-slate-950 text-slate-400 hover:text-white rounded-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        if (!photoBase64) return;
                        onAnswerQuestion(true, photoBase64);
                        setPhotoBase64('');
                        audio.playSuccess();
                      }}
                      disabled={!photoBase64}
                      className={`w-full py-2 rounded-xl text-xs font-black shadow transition-all ${
                        photoBase64
                          ? 'bg-rose-500 hover:bg-rose-400 text-slate-950 cursor-pointer'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-750'
                      }`}
                    >
                      📤 Send Uploaded Photo
                    </button>
                  </div>
                ) : (() => {
                  const evalResult = evaluateActiveQuestion(room);
                  const vetoCard = room.hiderHand.find(c => c.title === 'Veto' || c.title?.toLowerCase() === 'veto');
                  
                  return (
                    <div className="space-y-4 text-left">
                      {evalResult && (
                        <div className="bg-slate-950/80 border border-emerald-500/20 p-4 rounded-2xl text-left space-y-2.5">
                          <div className="flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">
                              Automated Geospatial Calculation
                            </span>
                          </div>
                          
                          <div className="text-xs text-slate-300">
                            {evalResult.details}
                          </div>
                          
                          <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-xs">
                            <span className="text-slate-400">Calculated Answer:</span>
                            <span className="font-extrabold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-wide">
                              {evalResult.label}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className={vetoCard ? "grid grid-cols-2 gap-3" : "w-full"}>
                        <button
                          onClick={() => {
                            if (evalResult) {
                              onAnswerQuestion(evalResult.value);
                            } else {
                              onAnswerQuestion(true);
                            }
                            audio.playSuccess();
                          }}
                          className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-black rounded-xl transition-all shadow flex items-center justify-center space-x-1.5 cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          <span>Submit Calculated Answer</span>
                        </button>

                        {vetoCard && (
                          <button
                            onClick={() => {
                              onVetoQuestion(vetoCard.id);
                              audio.playSuccess();
                            }}
                            className="w-full py-3 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-slate-950 text-xs font-black rounded-xl transition-all shadow flex items-center justify-center space-x-1.5 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                            <span>Veto Question</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-xs text-slate-500 bg-slate-950/20 border border-dashed border-slate-850 rounded-2xl flex flex-col items-center justify-center space-y-1.5">
              <EyeOff className="w-5 h-5 opacity-40" />
              <span>No questions proposed yet. Hide well!</span>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TRACKING STATUS, DISMISSALS, CATCH */}
      {activeTab === 'STATUS' && (
        <div className="space-y-4">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1 font-mono">Real-time Game Status Logs</span>

          {/* Curses verification card */}
          {room.activeCurses.length > 0 && (
            <div className="bg-slate-900 border border-rose-500/20 rounded-3xl p-5 shadow-2xl space-y-4">
              <h3 className="text-xs font-black text-rose-400 uppercase tracking-wider flex items-center space-x-2">
                <AlertTriangle className="w-4.5 h-4.5 animate-pulse" />
                <span>Active Curses under Review ({room.activeCurses.length})</span>
              </h3>

              <div className="space-y-3">
                {room.activeCurses.map((curse) => (
                  <div key={curse.id} className="bg-slate-950/80 border border-slate-850 p-4 rounded-2xl space-y-3">
                    <div>
                      <h4 className="text-xs font-black text-slate-100">{curse.title}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{curse.seekerEffect}</p>
                    </div>

                    {curse.pendingConfirmation ? (
                      <>
                        <div className="bg-slate-900 border border-slate-850/80 p-2.5 rounded-xl text-left">
                          <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider block">Seeker claim:</span>
                          <p className="text-[10px] text-slate-300 leading-normal mt-0.5">
                            Seekers have requested confirmation that this curse was fully accomplished in the real world.
                          </p>
                        </div>
                        <div className="flex space-x-2 pt-1">
                          <button
                            onClick={() => {
                              onConfirmCurseDismissal(curse.id, true);
                              audio.playCurseDismissed();
                            }}
                            className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-black rounded-lg transition-all cursor-pointer"
                          >
                            Confirm (Yes, Unlock Seeker UI)
                          </button>
                          <button
                            onClick={() => {
                              onConfirmCurseDismissal(curse.id, false);
                              audio.playClick();
                            }}
                            className="flex-1 py-1.5 bg-rose-500/20 hover:bg-rose-500 text-rose-300 text-[10px] font-black rounded-lg transition-all cursor-pointer"
                          >
                            Reject (No)
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="bg-slate-900/60 border border-slate-850/40 p-2.5 rounded-xl text-left">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Status:</span>
                        <p className="text-[10px] text-slate-400 leading-normal mt-0.5 animate-pulse">
                          ⌛ Waiting for Seekers to attempt/fulfill the dismissal task and submit their claim.
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sync status of game */}
          <div className="bg-slate-950/50 border border-slate-850 rounded-2xl p-4 space-y-2 text-left">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Playground Stats</h4>
            <div className="grid grid-cols-2 gap-3 text-xs pt-1.5 border-t border-slate-900">
              <div>
                <span className="text-slate-500 block text-[9px] uppercase tracking-wider">Remaining Search Cells</span>
                <span className="text-slate-200 font-extrabold text-sm">{room.grid.filter((c) => c.active).length} / {room.grid.length}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase tracking-wider">Active Curses casted</span>
                <span className="text-slate-200 font-extrabold text-sm">{room.activeCurses.length} Active</span>
              </div>
            </div>
          </div>

          {/* Synced Catch Mechanism */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider">Hider Apprehend Status</h3>
            <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
              If the Seeker physically locates and tags you in real life, both teams must press and hold the button below simultaneously to end this round.
            </p>

            <div className="relative max-w-xs mx-auto">
              <button
                onMouseDown={() => { setCatchPressed(true); audio.playClick(); }}
                onMouseUp={() => setCatchPressed(false)}
                onMouseLeave={() => setCatchPressed(false)}
                onTouchStart={() => { setCatchPressed(true); audio.playClick(); }}
                onTouchEnd={() => setCatchPressed(false)}
                className={`w-full py-4 rounded-2xl font-black text-sm tracking-widest text-slate-950 uppercase select-none transition-all cursor-pointer relative overflow-hidden active:scale-95 ${
                  catchPressed
                    ? 'bg-rose-500 text-slate-950 shadow-md'
                    : 'bg-gradient-to-r from-rose-500 to-pink-500 hover:scale-[1.01]'
                }`}
              >
                <div
                  className="absolute left-0 top-0 bottom-0 bg-rose-700/50 transition-all duration-75"
                  style={{ width: `${catchProgress}%` }}
                />
                <span className="relative z-10">🚨 HOLD TO CONFIRM CAUGHT</span>
              </button>
            </div>
            {catchProgress > 0 && (
              <span className="block text-[10px] text-rose-400 animate-pulse font-mono">
                Synchronizing with field... {catchProgress}%
              </span>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: CAST CURSE COST VERIFICATION */}
      {activeCurseToCast && (() => {
        const reqInfo = getCurseDiscardRequirement(activeCurseToCast);
        const eligibleHandCards = room.hiderHand.filter((c) => {
          if (c.id === activeCurseToCast.id) return false;
          if (reqInfo?.filterType && c.type !== reqInfo.filterType) return false;
          return true;
        });

        const isDiscardSelectionRequired = reqInfo && reqInfo.count > 0;
        const hasSelectedEnoughDiscards = !isDiscardSelectionRequired || curseDiscardIds.length === reqInfo.count;

        // Bridge Troll Proximity Check
        let canCastBridgeTroll = true;
        let bridgeTrollCurrentDistance = 0;
        let bridgeTrollRequiredDistance = 5;

        if (activeCurseToCast.title === 'Curse Of The Bridge Troll' || activeCurseToCast.curseId === 'curse_9') {
          if (room.gameSize === 'S') bridgeTrollRequiredDistance = 1;
          else if (room.gameSize === 'L') bridgeTrollRequiredDistance = 30;
          else bridgeTrollRequiredDistance = 5;

          const hiderTeam = room.teams[room.hiderTeamIndex];
          const hLat = hiderTeam?.lat || room.centerLat;
          const hLng = hiderTeam?.lng || room.centerLng;

          let minSeekerDist = Infinity;
          room.players.forEach((p) => {
            const pTeam = room.teams.find((t) => t.name === p.team);
            if (pTeam && pTeam.role === 'SEEKER' && p.lat !== undefined && p.lng !== undefined) {
              const d = getDistance(hLat, hLng, p.lat, p.lng);
              if (d < minSeekerDist) minSeekerDist = d;
            }
          });

          room.teams.forEach((t) => {
            if (t.role === 'SEEKER' && t.lat !== undefined && t.lng !== undefined) {
              const d = getDistance(hLat, hLng, t.lat, t.lng);
              if (d < minSeekerDist) minSeekerDist = d;
            }
          });

          if (minSeekerDist !== Infinity) {
            bridgeTrollCurrentDistance = minSeekerDist;
            if (minSeekerDist < bridgeTrollRequiredDistance) {
              canCastBridgeTroll = false;
            }
          }
        }

        const toggleDiscardCard = (cardId: string) => {
          setCurseDiscardIds((prev) => {
            if (prev.includes(cardId)) {
              return prev.filter((id) => id !== cardId);
            }
            if (reqInfo && prev.length >= reqInfo.count) {
              if (reqInfo.count === 1) {
                return [cardId];
              }
              return prev;
            }
            return [...prev, cardId];
          });
          audio.playClick();
        };

        return (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 z-[2000]">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-4 text-center">
              <div className="p-3 bg-rose-500/10 rounded-2xl text-rose-400 w-fit mx-auto">
                <AlertTriangle className="w-8 h-8 animate-bounce" />
              </div>

              <div>
                <h3 className="text-base font-black text-slate-100">Casting Cost Verification</h3>
                <p className="text-xs text-rose-400 mt-1 uppercase font-bold">{activeCurseToCast.title}</p>
              </div>

              <div className="bg-slate-950/80 border border-slate-850 p-4 rounded-2xl text-left space-y-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Physical Casting Cost Requirement:</span>
                  <p className="text-xs text-slate-200 mt-1 leading-relaxed font-semibold">
                    {activeCurseToCast.costDesc}
                  </p>
                </div>
                
                {reqInfo && reqInfo.count === -1 && (
                  <div className="text-[10px] text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg leading-normal">
                    ⚠️ Casting this will discard all other {eligibleHandCards.length} card(s) from your hand!
                  </div>
                )}
              </div>

              {/* Bridge Troll Proximity Check UI */}
              {(activeCurseToCast.title === 'Curse Of The Bridge Troll' || activeCurseToCast.curseId === 'curse_9') && (
                <div className={`p-3 rounded-2xl text-xs text-left leading-normal border ${
                  canCastBridgeTroll 
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300' 
                    : 'bg-rose-500/5 border-rose-500/20 text-rose-300 animate-pulse'
                }`}>
                  <span className="font-extrabold uppercase block text-[9px] mb-1 text-slate-400 font-mono tracking-wider">
                    📡 Seeker Proximity Telemetry
                  </span>
                  {bridgeTrollCurrentDistance === 0 ? (
                    <span className="text-[11px] text-slate-400">
                      No seeker coordinates logged yet. Telemetry offline. You may proceed if seekers are physically at least <b>{bridgeTrollRequiredDistance} mi</b> away.
                    </span>
                  ) : (
                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Current Distance:</span>
                        <span className="font-extrabold">{bridgeTrollCurrentDistance.toFixed(2)} mi</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Minimum Required:</span>
                        <span className="font-extrabold">{bridgeTrollRequiredDistance} mi</span>
                      </div>
                      <div className="pt-1 mt-1 border-t border-slate-800 text-center font-bold font-mono text-[10px]">
                        {canCastBridgeTroll ? (
                          <span className="text-emerald-400">✅ TELEMETRY OK: DISTANCE VERIFIED</span>
                        ) : (
                          <span className="text-rose-400">❌ TELEMETRY WARNING: SEEKERS TOO CLOSE</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CARD DISCARD LIST */}
              {isDiscardSelectionRequired && (
                <div className="space-y-2 text-left">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                      Select {reqInfo.count} card{reqInfo.count > 1 ? 's' : ''} to discard:
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 font-bold">
                      {curseDiscardIds.length}/{reqInfo.count} selected
                    </span>
                  </div>

                  {eligibleHandCards.length === 0 ? (
                    <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/10 text-center text-xs text-rose-400">
                      No matching cards in hand to discard! You cannot cast this.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {eligibleHandCards.map((c) => {
                        const isSelected = curseDiscardIds.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            onClick={() => toggleDiscardCard(c.id)}
                            className={`w-full p-2 rounded-xl border text-left text-xs transition-all flex items-center justify-between ${
                              isSelected
                                ? 'bg-rose-500/5 border-rose-500 text-rose-300 font-bold'
                                : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-800'
                            }`}
                          >
                            <span>{c.title} ({c.type})</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-rose-500" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <p className="text-[10px] text-slate-400">
                Have you physically completed this casting requirement in the real world right now?
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleCastConfirm(true)}
                  disabled={!hasSelectedEnoughDiscards || (isDiscardSelectionRequired && eligibleHandCards.length < reqInfo.count) || !canCastBridgeTroll}
                  className={`py-2.5 text-slate-950 text-xs font-black rounded-xl transition-all shadow cursor-pointer ${
                    hasSelectedEnoughDiscards && (!isDiscardSelectionRequired || eligibleHandCards.length >= reqInfo.count) && canCastBridgeTroll
                      ? 'bg-rose-500 hover:bg-rose-400'
                      : 'bg-slate-800 text-slate-500 border border-slate-850 cursor-not-allowed'
                  }`}
                >
                  Yes, Completed
                </button>
                <button
                  onClick={() => handleCastConfirm(false)}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black rounded-xl transition-all border border-slate-700 cursor-pointer"
                >
                  No, Discard Card
                </button>
              </div>

              <button
                onClick={() => { setActiveCurseToCast(null); audio.playClick(); }}
                className="text-[10px] text-slate-500 hover:text-slate-300 block mx-auto pt-1"
              >
                Cancel Cast (Keep in Hand)
              </button>
            </div>
          </div>
        );
      })()}

      {/* MODAL 2: POWERUP EXECUTE SUBPANEL */}
      {activePowerupCard && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 z-[2000]">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-4 text-center">
            <div className="p-3 bg-cyan-500/10 rounded-2xl text-cyan-400 w-fit mx-auto">
              <Sparkles className="w-8 h-8 animate-spin" />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-100">Play Powerup</h3>
              <p className="text-xs text-cyan-400 mt-1 uppercase font-bold">{activePowerupCard.title}</p>
            </div>

            {/* Target Selectors */}
            {activePowerupCard.title === 'Duplicate' && (
              <div className="space-y-3">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">Select Card to Duplicate:</label>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {room.hiderHand
                    .filter((c) => c.id !== activePowerupCard.id)
                    .map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedTargetId(c.id)}
                        className={`w-full p-2.5 rounded-xl border text-left text-xs transition-all ${
                          selectedTargetId === c.id
                            ? 'bg-cyan-500/5 border-cyan-500 text-cyan-300 font-bold'
                            : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-800'
                        }`}
                      >
                        {c.title} ({c.type})
                      </button>
                    ))}
                </div>
              </div>
            )}

            {activePowerupCard.title === 'Discard 1, Draw 2' && (
              <div className="space-y-3">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">Select Card to Discard:</label>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {room.hiderHand
                    .filter((c) => c.id !== activePowerupCard.id)
                    .map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedTargetId(c.id)}
                        className={`w-full p-2.5 rounded-xl border text-left text-xs transition-all ${
                          selectedTargetId === c.id
                            ? 'bg-rose-500/5 border-rose-500 text-rose-300 font-bold'
                            : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-850'
                        }`}
                      >
                        {c.title} ({c.type})
                      </button>
                    ))}
                </div>
              </div>
            )}

            {activePowerupCard.title === 'Discard 2, Draw 3' && (
              <div className="space-y-3">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">Select 2 Cards to Discard ({selectedTargetIds.length}/2):</label>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {room.hiderHand
                    .filter((c) => c.id !== activePowerupCard.id)
                    .map((c) => {
                      const isSelected = selectedTargetIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          onClick={() => {
                            setSelectedTargetIds((prev) => {
                              if (isSelected) {
                                return prev.filter((id) => id !== c.id);
                              }
                              if (prev.length >= 2) return prev;
                              return [...prev, c.id];
                            });
                          }}
                          className={`w-full p-2.5 rounded-xl border text-left text-xs transition-all ${
                            isSelected
                              ? 'bg-rose-500/5 border-rose-500 text-rose-300 font-bold'
                              : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-850'
                          }`}
                        >
                          {c.title} ({c.type})
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={executePowerupPlay}
                disabled={
                  (activePowerupCard.title === 'Duplicate' && !selectedTargetId) ||
                  (activePowerupCard.title === 'Discard 1, Draw 2' && !selectedTargetId) ||
                  (activePowerupCard.title === 'Discard 2, Draw 3' && selectedTargetIds.length !== 2)
                }
                className={`py-2.5 rounded-xl text-xs font-black transition-all shadow ${
                  (activePowerupCard.title === 'Duplicate' && !selectedTargetId) ||
                  (activePowerupCard.title === 'Discard 1, Draw 2' && !selectedTargetId) ||
                  (activePowerupCard.title === 'Discard 2, Draw 3' && selectedTargetIds.length !== 2)
                    ? 'bg-slate-800 text-slate-500 border border-slate-750 cursor-not-allowed'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 cursor-pointer'
                }`}
              >
                Confirm Play
              </button>
              <button
                onClick={() => {
                  setActivePowerupCard(null);
                  setSelectedTargetId('');
                  setSelectedTargetIds([]);
                  audio.playClick();
                }}
                className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black rounded-xl transition-all border border-slate-700 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🎁 CARD DRAFT REWARD MODAL */}
      {room.pendingDraft && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 z-[2500]">
          <div className="bg-[#0e1322] border border-cyan-500/40 rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-6 text-center">
            <div className="p-3 bg-cyan-500/10 rounded-2xl text-cyan-400 w-fit mx-auto border border-cyan-500/20">
              <Sparkles className="w-8 h-8 animate-pulse" />
            </div>

            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">Card Draft Selection</span>
              <h3 className="text-xl font-black text-slate-100 uppercase tracking-tight mt-1">🎁 Choose Your Reward</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Select exactly <span className="text-cyan-300 font-bold">{room.pendingDraft.pickCount} card(s)</span> to add to your hand out of the <span className="text-slate-300 font-bold">{room.pendingDraft.options.length} options</span>:
              </p>
            </div>

            {/* List of draft card options */}
            <div className="grid grid-cols-1 gap-3 max-h-80 overflow-y-auto pr-1">
              {room.pendingDraft.options.map((card) => {
                const isSelected = selectedDraftIds.includes(card.id);
                const rarityColor =
                  card.rarity === 'RED'
                    ? 'border-red-500 text-red-400'
                    : card.rarity === 'ORANGE'
                    ? 'border-orange-500 text-orange-400'
                    : card.rarity === 'YELLOW'
                    ? 'border-yellow-500 text-yellow-400'
                    : card.rarity === 'GREEN'
                    ? 'border-emerald-500 text-emerald-400'
                    : card.rarity === 'BLUE'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-slate-500 text-slate-300';

                return (
                  <button
                    key={card.id}
                    onClick={() => {
                      audio.playClick();
                      if (isSelected) {
                        setSelectedDraftIds((prev) => prev.filter((id) => id !== card.id));
                      } else {
                        // Check if already reached max pickCount
                        if (selectedDraftIds.length < room.pendingDraft!.pickCount) {
                          setSelectedDraftIds((prev) => [...prev, card.id]);
                        } else if (room.pendingDraft!.pickCount === 1) {
                          // Easy override for pick 1
                          setSelectedDraftIds([card.id]);
                        }
                      }
                    }}
                    className={`text-left p-4 rounded-2xl border transition-all relative ${
                      isSelected
                        ? 'bg-cyan-500/10 border-cyan-500 shadow-md shadow-cyan-950/40'
                        : 'bg-slate-950/80 border-slate-900 hover:border-slate-800'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={`text-[8px] font-black border px-1.5 py-0.5 rounded uppercase tracking-wider ${rarityColor}`}>
                          {card.rarity} • {card.type}
                        </span>
                        <h4 className="text-sm font-black text-slate-100 mt-2">{card.title}</h4>
                        <p className="text-xs text-slate-400 mt-1 leading-normal">{card.desc}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-cyan-500 border-cyan-400 text-slate-950' : 'border-slate-800 text-transparent'
                      }`}>
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Confirm choice button */}
            <button
              onClick={() => {
                onPickDraft(selectedDraftIds);
                audio.playSuccess();
              }}
              disabled={selectedDraftIds.length !== room.pendingDraft.pickCount}
              className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow ${
                selectedDraftIds.length === room.pendingDraft.pickCount
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 cursor-pointer hover:scale-[1.01]'
                  : 'bg-slate-850 text-slate-500 border border-slate-800 cursor-not-allowed'
              }`}
            >
              {selectedDraftIds.length === room.pendingDraft.pickCount
                ? `Add Selected Card(s) to Hand`
                : `Select ${room.pendingDraft.pickCount - selectedDraftIds.length} more card(s)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
