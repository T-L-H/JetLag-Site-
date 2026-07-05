import React, { useState, useEffect } from 'react';
import { RoomState, Card, ActiveQuestion, Team } from './types';
import LobbyView from './components/LobbyView';
import HiderView from './components/HiderView';
import SeekerView from './components/SeekerView';
import MapComponent from './components/MapComponent';
import LeaderboardView from './components/LeaderboardView';
import { Globe, Shield, RefreshCw, Compass, MapPin, Sliders, Volume2, VolumeX, Eye, EyeOff, Info, Sparkles, Radio, HelpCircle, CheckCircle, AlertTriangle, Check } from 'lucide-react';
import audio from './lib/audio';
import { safeStorage } from './lib/storage';

export default function App() {
  // Identity states
  const [userName, setUserName] = useState<string>(() => safeStorage.getItem('jt_username') || '');
  const [roomCode, setRoomCode] = useState<string>(() => safeStorage.getItem('jt_room_code') || '');
  const [isGM, setIsGM] = useState<boolean>(() => safeStorage.getItem('jt_is_gm') === 'true');
  const [soundEnabled, setSoundEnabled] = useState(() => !audio.getMuted());
  const [showMobileControls, setShowMobileControls] = useState(true);

  // Active game states
  const [room, setRoom] = useState<RoomState | null>(null);
  const [sseConnected, setSseConnected] = useState(false);

  // Pin selection tools
  const [selectionMode, setSelectionMode] = useState<'CUSTOM_PIN' | 'TRANSIT_PIN' | null>(null);
  const [customPin, setCustomPin] = useState<{ lat: number; lng: number } | null>(null);
  const [transitPin, setTransitPin] = useState<{ lat: number; lng: number } | null>(null);

  // Client-side visual timer (counts up/down)
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  // Lifted seeker query configurations for real-time map previewing!
  const [qType, setQType] = useState<'MATCHING' | 'MEASURING' | 'THERMOMETER' | 'RADAR' | 'TENTACLES' | 'PHOTO' | null>(null);
  const [matchingPoi, setMatchingPoi] = useState<string>('Commercial Airport');
  const [radarDistance, setRadarDistance] = useState<number>(1.0);
  const [tentaclePoi, setTentaclePoi] = useState<string>('Museums');
  const [tentacleDistance, setTentacleDistance] = useState<number>(1.0);
  const [previewingQuestion, setPreviewingQuestion] = useState<any | null>(null);

  // --- PERSIST USERNAME ---
  useEffect(() => {
    if (userName) {
      safeStorage.setItem('jt_username', userName);
    }
  }, [userName]);

  useEffect(() => {
    safeStorage.setItem('jt_is_gm', String(isGM));
  }, [isGM]);

  useEffect(() => {
    if (roomCode) {
      safeStorage.setItem('jt_room_code', roomCode.toUpperCase());
    } else {
      safeStorage.removeItem('jt_room_code');
    }
  }, [roomCode]);

  // --- SSE REAL-TIME CONNECTION ---
  useEffect(() => {
    if (!roomCode) return;

    setSseConnected(false);
    const source = new EventSource(`/api/rooms/${roomCode}/stream`);

    source.onopen = () => {
      setSseConnected(true);
    };

    source.onmessage = (event) => {
      try {
        const state: RoomState = JSON.parse(event.data);
        setRoom(state);
      } catch (e) {
        console.error('Error parsing SSE room state:', e);
      }
    };

    source.onerror = () => {
      setSseConnected(false);
      source.close();
    };

    return () => {
      source.close();
    };
  }, [roomCode]);

  // --- GPS GEOLOCATION ENGINE ---
  useEffect(() => {
    if (!roomCode || !userName) return;

    const reportLocation = (lat: number, lng: number) => {
      fetch(`/api/rooms/${roomCode}/update-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: userName, lat, lng }),
      }).catch((e) => console.warn('Failed reporting coordinates:', e));
    };

    // Use native browser Geolocation
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          reportLocation(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          console.warn('Geolocation warning:', err);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [roomCode, userName]);

  // --- ACTIVE CLOCK CONTROLLER ---
  useEffect(() => {
    if (room && room.gamePhase === 'SEEKING' && room.timerStart) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - room.timerStart!) / 1000) + room.timerAccumulated;
        setSecondsElapsed(elapsed);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setSecondsElapsed(room?.timerAccumulated || 0);
    }
  }, [room]);

  // Reset temporary pins when game phases change to prevent stale overlays in next rounds
  useEffect(() => {
    if (room?.gamePhase) {
      setCustomPin(null);
      setTransitPin(null);
    }
  }, [room?.gamePhase]);

  // Hide controls automatically when entering map selection mode to make map visible
  useEffect(() => {
    if (selectionMode) {
      setShowMobileControls(false);
    }
  }, [selectionMode]);

  // Formatter MM:SS
  const getFormattedTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // --- API SERVICE CALLS ---

  const handleCreateRoom = async (params: {
    centerLat: number;
    centerLng: number;
    radiusMiles: number;
    gameSize: string;
    teams: string[];
    gmName: string;
    gmTeam: string;
    hidingTimeLimit: number;
  }) => {
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          centerLat: params.centerLat,
          centerLng: params.centerLng,
          radiusMiles: params.radiusMiles,
          gameSize: params.gameSize,
          teams: params.teams,
          hidingTimeLimit: params.hidingTimeLimit,
        }),
      });

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        if (isLocalhost) {
          alert("Backend server connection failed: The API request returned HTML instead of JSON. Please make sure the backend Express server is running (start it with 'npm run dev' or 'npm run build && npm run start' which runs 'server.ts', rather than running 'vite' directly).");
        } else {
          alert("Your browser's security/cookie settings are blocking the server connection inside the preview window. Please open the app in a New Tab (click the 'Open in new tab' square-arrow icon at the top right of the preview) to host and play!");
        }
        return;
      }

      const data: RoomState = await response.json();
      setRoomCode(data.code);
      setIsGM(true);
      
      // Auto-join GM with selected Name and selected Team
      const nameToUse = params.gmName || userName || 'Game Master';
      setUserName(nameToUse);

      const teamToUse = params.gmTeam || params.teams[0] || 'Team Red';

      await fetch(`/api/rooms/${data.code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: nameToUse, teamName: teamToUse }),
      });
    } catch (e) {
      alert('Error creating game session.');
    }
  };

  const handleLeaveRoom = () => {
    setRoom(null);
    setRoomCode('');
    setIsGM(false);
    setUserName('');
    safeStorage.removeItem('jt_room_code');
    safeStorage.removeItem('jt_is_gm');
    safeStorage.removeItem('jt_username');
    try {
      localStorage.clear();
    } catch (e) {
      console.warn('localStorage clear failed', e);
    }
  };

  const handleJoinRoom = async (code: string, playerName: string, teamName: string) => {
    try {
      setUserName(playerName);
      setIsGM(false);

      const response = await fetch(`/api/rooms/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, teamName }),
      });

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        if (isLocalhost) {
          alert("Backend server connection failed: The API request returned HTML instead of JSON. Please make sure the backend Express server is running (start it with 'npm run dev' or 'npm run build && npm run start' which runs 'server.ts', rather than running 'vite' directly).");
        } else {
          alert("Your browser's security/cookie settings are blocking the server connection inside the preview window. Please open the app in a New Tab (click the 'Open in new tab' square-arrow icon at the top right of the preview) to join and play!");
        }
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to join lobby.');
        return;
      }

      setRoomCode(code);
    } catch (e) {
      alert('Network error connecting to lobby.');
    }
  };

  const handleStartGame = async () => {
    if (!roomCode) return;
    await fetch(`/api/rooms/${roomCode}/start-game`, { method: 'POST' });
  };

  const handleStartHidingTimer = async () => {
    if (!roomCode) return;
    await fetch(`/api/rooms/${roomCode}/start-hiding`, { method: 'POST' });
  };

  const handleTransitPinConfirm = async () => {
    if (!roomCode || !transitPin) return;
    await fetch(`/api/rooms/${roomCode}/arrived-transit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transitPin),
    });
  };

  const handleDoneHiding = async () => {
    if (!roomCode) return;
    await fetch(`/api/rooms/${roomCode}/done-hiding`, { method: 'POST' });
    setTransitPin(null);
  };

  const handleProposeQuestion = async (question: Omit<ActiveQuestion, 'id' | 'status'>) => {
    if (!roomCode) return;
    await fetch(`/api/rooms/${roomCode}/propose-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
  };

  const handleAnswerQuestion = async (answerValue: boolean | string, photoUrl?: string) => {
    if (!roomCode) return;
    await fetch(`/api/rooms/${roomCode}/answer-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answerValue, photoUrl }),
    });
  };

  const handleClearQuestion = async () => {
    if (!roomCode) return;
    await fetch(`/api/rooms/${roomCode}/clear-question`, { method: 'POST' });
  };

  const handlePickDraft = async (cardIds: string[]) => {
    if (!roomCode) return;
    await fetch(`/api/rooms/${roomCode}/pick-draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardIds }),
    });
  };

  const handleVetoQuestion = async (cardId: string) => {
    if (!roomCode) return;
    await fetch(`/api/rooms/${roomCode}/veto-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId }),
    });
  };

  const handlePlayPowerup = async (cardId: string, targetCardId?: string, targetCardIds?: string[]) => {
    if (!roomCode) return;
    await fetch(`/api/rooms/${roomCode}/play-powerup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId, targetCardId, targetCardIds }),
    });
  };

  const handleCastCurse = async (cardId: string, fulfilledCost: boolean, discardCardIds?: string[]) => {
    if (!roomCode) return;
    await fetch(`/api/rooms/${roomCode}/cast-curse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId, fulfilledCost, discardCardIds }),
    });
  };

  const handleConfirmCurseDismissal = async (curseId: string, confirmed: boolean) => {
    if (!roomCode) return;
    await fetch(`/api/rooms/${roomCode}/dismiss-curse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ curseId, confirmed }),
    });
  };

  const handleDismissCurseRequest = async (curseId: string) => {
    // Seeker requests verification of completion
    if (!roomCode) return;
    await fetch(`/api/rooms/${roomCode}/claim-curse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ curseId }),
    });
  };

  const handleCatchHider = async () => {
    if (!roomCode) return;
    await fetch(`/api/rooms/${roomCode}/catch-hider`, { method: 'POST' });
  };

  const handleNextRound = async () => {
    if (!roomCode) return;
    await fetch(`/api/rooms/${roomCode}/next-round`, { method: 'POST' });
  };

  const handleResetGame = async () => {
    if (!roomCode) return;
    await fetch(`/api/rooms/${roomCode}/reset`, { method: 'POST' });
  };

  // Drag and drop / Pin placement coord handlers
  const handleSetPinDirectly = (lat: number, lng: number, pinType: 'CUSTOM' | 'TRANSIT') => {
    if (pinType === 'CUSTOM') {
      setCustomPin({ lat, lng });
    } else {
      setTransitPin({ lat, lng });
    }
    audio.playSuccess();
  };

  const handlePinDroppedOnMap = (lat: number, lng: number, forceCustom: boolean = false) => {
    if (forceCustom || selectionMode === 'CUSTOM_PIN') {
      setCustomPin({ lat, lng });
    } else if (selectionMode === 'TRANSIT_PIN') {
      setTransitPin({ lat, lng });
    }
    if (!forceCustom) {
      setSelectionMode(null);
    }
    audio.playSuccess();
  };

  // --- LAYOUTS RENDERING ---

  // Get current player role
  const currentPlayer = room?.players.find((p) => p.name === userName);
  const currentTeam = currentPlayer ? room?.teams.find((t) => t.name === currentPlayer.team) : null;
  const isHider = currentTeam?.role === 'HIDER';

  // Calculate current mobile notification alerts
  const getActiveNotification = () => {
    if (!room) return null;
    
    if (isHider) {
      if (room.gamePhase === 'HIDING' && !room.hidingStationPin) {
        return {
          type: 'danger',
          label: 'SETUP INCOMPLETE',
          desc: 'Select your station & drop your starting pin!',
          icon: 'MapPin'
        };
      }
      if (room.pendingDraft) {
        return {
          type: 'reward',
          label: 'CARD DRAFT REWARD',
          desc: 'Choose a power-up card! Open controls to draft.',
          icon: 'Sparkles'
        };
      }
      if (room.activeQuestion && room.activeQuestion.status === 'PENDING') {
        return {
          type: 'warning',
          label: 'PENDING PROXIMITY QUESTION',
          desc: 'Seekers asked a question! Tap to answer.',
          icon: 'HelpCircle'
        };
      }
      const hasPendingCurses = room.activeCurses && room.activeCurses.some(c => c.pendingConfirmation);
      if (hasPendingCurses) {
        return {
          type: 'danger',
          label: 'CURSE DISMISSAL REQUEST',
          desc: 'Seeker claims curse completion. Review now!',
          icon: 'AlertTriangle'
        };
      }
    } else {
      if (room.activeCurses && room.activeCurses.length > 0) {
        return {
          type: 'danger',
          label: 'ACTIVE CURSE - JAMMED',
          desc: 'Your interface is jammed! All questions are locked.',
          icon: 'ShieldAlert'
        };
      }
      if (room.activeQuestion && room.activeQuestion.status === 'PENDING') {
        return {
          type: 'info',
          label: 'WAITING FOR ANSWER',
          desc: 'Proximity query sent. Waiting for Hider response.',
          icon: 'Radio'
        };
      }
      if (room.activeQuestion && room.activeQuestion.status === 'ANSWERED') {
        return {
          type: 'success',
          label: 'QUESTION ANSWERED',
          desc: 'New location details received! Tap to view.',
          icon: 'CheckCircle'
        };
      }
    }
    return null;
  };

  const renderNotificationIcon = (iconName: string) => {
    switch (iconName) {
      case 'MapPin': return <MapPin className="w-4 h-4 text-rose-400 animate-pulse" />;
      case 'Sparkles': return <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />;
      case 'HelpCircle': return <HelpCircle className="w-4 h-4 text-amber-400 animate-pulse" />;
      case 'AlertTriangle': return <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />;
      case 'ShieldAlert': return <Shield className="w-4 h-4 text-red-400 animate-pulse" />;
      case 'Radio': return <Radio className="w-4 h-4 text-sky-400 animate-pulse" />;
      case 'CheckCircle': return <CheckCircle className="w-4 h-4 text-emerald-400 animate-pulse" />;
      default: return <Info className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0a0d16] text-slate-100 font-sans">
      {/* Header bar */}
      <header className="flex justify-between items-center h-16 px-4 md:px-6 bg-[#0e1322] border-b border-slate-900 shadow-md shrink-0 select-none">
        <div className="flex items-center space-x-3">
          <div className="hidden sm:block p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h1 className="hidden md:block text-sm font-black tracking-tight text-slate-100">JET TRACKER</h1>
            <p className="text-sm md:text-[10px] text-slate-200 md:text-slate-400 font-black md:font-semibold uppercase tracking-wider">
              {room ? `LOBBY: ${room.code}` : 'GPS Proximity Field'}
            </p>
          </div>
        </div>

        {/* Live sync indicators and score stops */}
        {room && room.gamePhase !== 'LOBBY' && (
          <div className="flex items-center space-x-3 md:space-x-4">
            {/* Stopwatch counting up/down */}
            <div className="bg-slate-950/80 border border-slate-900 px-2.5 md:px-3 py-1 md:py-1.5 rounded-xl text-center">
              <span className="text-[7px] md:text-[8px] font-bold uppercase tracking-wider text-slate-500 block">Round Score Clock</span>
              <span className="text-xs md:text-sm font-black font-mono text-cyan-400 tracking-widest">
                {room.gamePhase === 'SEEKING' ? getFormattedTime(secondsElapsed) : '00:00'}
              </span>
            </div>

            <div className="hidden sm:block text-right">
              <span className="text-[9px] uppercase font-bold text-slate-500">My Team</span>
              <span className={`block text-xs font-black ${isHider ? 'text-rose-400' : 'text-blue-400'}`}>
                {currentTeam?.name} ({currentTeam?.role})
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center space-x-2">
          {roomCode && (
            <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[8px] md:text-[9px] font-bold ${sseConnected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
              <span className={`w-1 md:w-1.5 h-1 md:h-1.5 rounded-full ${sseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400 animate-ping'}`} />
              <span>{sseConnected ? 'Sync Live' : 'Offline'}</span>
            </span>
          )}

          <button
            onClick={() => {
              const nextMuted = soundEnabled; // if currently soundEnabled, toggle means we mute
              audio.setMuted(nextMuted);
              setSoundEnabled(!soundEnabled);
              if (!nextMuted) audio.playClick();
            }}
            className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:text-white transition-colors text-slate-400"
            title="Toggle Synthesized Audio Feedback"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-cyan-400" />}
          </button>
        </div>
      </header>

      {/* Main Sandbox Layout */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* If no room is active, render Lobby in center screen */}
        {!room ? (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <LobbyView
              room={room}
              onCreateRoom={handleCreateRoom}
              onJoinRoom={handleJoinRoom}
              onLeaveRoom={handleLeaveRoom}
              onStartGame={handleStartGame}
              userName={userName}
              isGM={isGM}
            />
          </div>
        ) : room.gamePhase === 'LOBBY' ? (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <LobbyView
              room={room}
              onCreateRoom={handleCreateRoom}
              onJoinRoom={handleJoinRoom}
              onLeaveRoom={handleLeaveRoom}
              onStartGame={handleStartGame}
              userName={userName}
              isGM={isGM}
            />
          </div>
        ) : (
          /* Main active map tracker splits */
          <>
            {/* Backdrop overlay on mobile when match controls are active */}
            {showMobileControls && (
              <div 
                className="md:hidden fixed inset-0 bg-slate-950/65 backdrop-blur-sm z-[1999]"
                onClick={() => {
                  setShowMobileControls(false);
                  audio.playClick();
                }}
              />
            )}

            {/* Floating Left Menu Bento */}
            <div className={`
              ${(room.gamePhase === 'SEEKING' && !isHider) 
                ? 'hidden md:flex' 
                : showMobileControls ? 'flex' : 'hidden md:flex'
              }
              w-[calc(100%-2rem)] sm:w-[480px] md:w-[360px] lg:w-[420px] 
              absolute md:relative top-1/2 md:top-auto -translate-y-1/2 md:translate-y-0 left-4 right-4 md:left-auto md:right-auto md:h-full
              max-h-[85vh] md:max-h-none
              bg-[#0a0f1d]/95 md:bg-[#0e1322]/40 backdrop-blur-md 
              border md:border-none border-slate-800 md:border-r md:border-slate-900 
              rounded-2xl md:rounded-none
              flex flex-col shrink-0 overflow-y-auto p-3.5 md:p-4 space-y-3.5 md:space-y-4 z-[2000] shadow-2xl md:shadow-none
            `}>
              {/* Mobile control header */}
              <div className="flex md:hidden items-center justify-between pb-2 border-b border-slate-800 shrink-0">
                <span className="text-xs font-bold text-cyan-400 tracking-wider uppercase">Match Controls</span>
                <button
                  onClick={() => {
                    setShowMobileControls(false);
                    audio.playClick();
                  }}
                  className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-black text-slate-400 hover:text-white flex items-center space-x-1"
                >
                  <EyeOff className="w-3 h-3" />
                  <span>Hide Controls</span>
                </button>
              </div>

              {room.gamePhase === 'INTERMISSION' || room.gamePhase === 'END' ? (
                <LeaderboardView
                  room={room}
                  onNextRound={handleNextRound}
                  onResetGame={handleResetGame}
                  isGM={isGM}
                />
              ) : isHider ? (
                <HiderView
                  room={room}
                  userName={userName}
                  onStartHidingTimer={handleStartHidingTimer}
                  onTransitPinDropped={handleTransitPinConfirm}
                  onDoneHiding={handleDoneHiding}
                  onAnswerQuestion={handleAnswerQuestion}
                  onVetoQuestion={handleVetoQuestion}
                  onPlayPowerup={handlePlayPowerup}
                  onCastCurse={handleCastCurse}
                  onConfirmCurseDismissal={handleConfirmCurseDismissal}
                  onCatchHider={handleCatchHider}
                  enableTransitSelection={() => setSelectionMode('TRANSIT_PIN')}
                  transitPin={transitPin}
                  onPickDraft={handlePickDraft}
                />
              ) : (
                <SeekerView
                  room={room}
                  userName={userName}
                  onProposeQuestion={handleProposeQuestion}
                  onDismissCurseRequest={handleDismissCurseRequest}
                  onCatchHider={handleCatchHider}
                  enablePinSelection={(mode) => setSelectionMode(mode)}
                  customPin={customPin}
                  clearCustomPin={() => setCustomPin(null)}
                  onPinDropped={(lat, lng) => handlePinDroppedOnMap(lat, lng, true)}
                  qType={qType}
                  setQType={setQType}
                  matchingPoi={matchingPoi}
                  setMatchingPoi={setMatchingPoi}
                  radarDistance={radarDistance}
                  setRadarDistance={setRadarDistance}
                  tentaclePoi={tentaclePoi}
                  setTentaclePoi={setTentaclePoi}
                  tentacleDistance={tentacleDistance}
                  setTentacleDistance={setTentacleDistance}
                  previewingQuestion={previewingQuestion}
                  setPreviewingQuestion={setPreviewingQuestion}
                  onClearQuestion={handleClearQuestion}
                />
              )}

              {/* Recent Action Event Logs */}
              {room.history.length > 0 && (
                <div className="bg-slate-950/60 border border-slate-900 rounded-2xl p-3 text-left">
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 block mb-2">Live Match Event Feed</span>
                  <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1 text-[10px] font-medium leading-relaxed">
                    {room.history.slice(0, 10).map((log, idx) => (
                      <p key={idx} className="text-slate-400 select-none">
                        {log}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Dominated Map Canvas on Right */}
            <div className="flex-1 h-full w-full absolute md:relative inset-0 md:inset-auto z-0 md:z-auto">
              <MapComponent
                room={room}
                userName={userName}
                selectionMode={selectionMode}
                onPinDropped={handlePinDroppedOnMap}
                onSetPinDirectly={handleSetPinDirectly}
                customPin={customPin}
                transitPin={transitPin}
                previewQType={qType}
                previewMatchingPoi={matchingPoi}
                previewRadarDistance={radarDistance}
                previewTentaclePoi={tentaclePoi}
                previewTentacleDistance={tentacleDistance}
              />

              {/* Seeker Mobile Floating Overlays */}
              {room.gamePhase === 'SEEKING' && !isHider && (
                <div className="md:hidden absolute inset-0 pointer-events-none z-[1000]">
                  <SeekerView
                    room={room}
                    userName={userName}
                    onProposeQuestion={handleProposeQuestion}
                    onDismissCurseRequest={handleDismissCurseRequest}
                    onCatchHider={handleCatchHider}
                    enablePinSelection={(mode) => setSelectionMode(mode)}
                    customPin={customPin}
                    clearCustomPin={() => setCustomPin(null)}
                    onPinDropped={(lat, lng) => handlePinDroppedOnMap(lat, lng, true)}
                    qType={qType}
                    setQType={setQType}
                    matchingPoi={matchingPoi}
                    setMatchingPoi={setMatchingPoi}
                    radarDistance={radarDistance}
                    setRadarDistance={setRadarDistance}
                    tentaclePoi={tentaclePoi}
                    setTentaclePoi={setTentaclePoi}
                    tentacleDistance={tentacleDistance}
                    setTentacleDistance={setTentacleDistance}
                    previewingQuestion={previewingQuestion}
                    setPreviewingQuestion={setPreviewingQuestion}
                    onClearQuestion={handleClearQuestion}
                    isMobileFloating={true}
                  />
                </div>
              )}

              {/* Small "Choose Pin" popup at top of map during selectionMode */}
              {selectionMode && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[3000] w-[calc(100%-2rem)] sm:w-auto max-w-sm">
                  <div className="bg-[#0b0e17]/95 backdrop-blur-md border border-cyan-500/30 rounded-2xl p-3.5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                    <div className="flex items-start space-x-2.5">
                      <div className="p-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
                        <MapPin className="w-4 h-4 text-cyan-400 animate-pulse" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 block">
                          {selectionMode === 'TRANSIT_PIN' ? 'Choose Station Pin' : 'Choose Target Pin'}
                        </span>
                        <p className="text-[11px] text-slate-300 font-medium leading-relaxed mt-0.5">
                          {selectionMode === 'TRANSIT_PIN' 
                            ? (transitPin ? '✔️ Station pin dropped! Tap map to relocate.' : 'Tap on the map to place station pin.')
                            : (customPin ? '✔️ Coordinate pin dropped! Tap map to relocate.' : 'Tap on the map to place coordinate pin.')
                          }
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectionMode(null);
                        if (room.gamePhase !== 'SEEKING' || isHider) {
                          setShowMobileControls(true); // Pop controls back up!
                        }
                        audio.playSuccess();
                      }}
                      className="w-full sm:w-auto px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-[11px] font-black tracking-wide whitespace-nowrap shadow-md cursor-pointer"
                    >
                      Done & Continue
                    </button>
                  </div>
                </div>
              )}

              {/* Floating "Show Controls" toggle on Mobile when hidden */}
              {!showMobileControls && !(room.gamePhase === 'SEEKING' && !isHider) && (
                <div className="md:hidden absolute bottom-6 left-1/2 -translate-x-1/2 z-[3000] flex flex-col items-center space-y-3 w-[calc(100%-2rem)] max-w-sm">
                  {/* Big Notification Alert banner */}
                  {(() => {
                    const notif = getActiveNotification();
                    if (!notif) return null;
                    
                    const borderColors = {
                      danger: 'border-red-500/30 bg-[#160a0f]/95 text-red-400 shadow-red-950/20',
                      warning: 'border-amber-500/30 bg-[#16120a]/95 text-amber-400 shadow-amber-950/20',
                      reward: 'border-purple-500/30 bg-[#130a16]/95 text-purple-400 shadow-purple-950/20',
                      info: 'border-sky-500/30 bg-[#0a1116]/95 text-sky-400 shadow-sky-950/20',
                      success: 'border-emerald-500/30 bg-[#0a160d]/95 text-emerald-400 shadow-emerald-950/20',
                    }[notif.type] || 'border-slate-800 bg-slate-950/95 text-slate-400';

                    const dotColors = {
                      danger: 'bg-red-500',
                      warning: 'bg-amber-500',
                      reward: 'bg-purple-500',
                      info: 'bg-sky-500',
                      success: 'bg-emerald-500',
                    }[notif.type] || 'bg-cyan-500';

                    return (
                      <div 
                        onClick={() => {
                          setShowMobileControls(true);
                          audio.playClick();
                        }}
                        className={`w-full flex items-start space-x-3 border rounded-2xl p-3 shadow-2xl backdrop-blur-md cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] ${borderColors}`}
                      >
                        <div className="p-1.5 bg-slate-900/55 rounded-xl border border-slate-850 flex items-center justify-center shrink-0">
                          {renderNotificationIcon(notif.icon)}
                        </div>
                        <div className="flex-1 text-left">
                          <div className="flex items-center space-x-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${dotColors} animate-pulse`} />
                            <span className="text-[9px] font-black uppercase tracking-wider block leading-none">{notif.label}</span>
                          </div>
                          <p className="text-[10px] font-bold text-slate-200 mt-1 leading-normal">{notif.desc}</p>
                          <span className="text-[8px] font-medium text-slate-400 block mt-1.5 underline">Tap to open controls & view details</span>
                        </div>
                      </div>
                    );
                  })()}

                  <button
                    onClick={() => {
                      setShowMobileControls(true);
                      audio.playClick();
                    }}
                    className="flex items-center space-x-1.5 bg-cyan-600 hover:bg-cyan-500 border border-cyan-400 text-white font-black text-xs px-5 py-2.5 rounded-full shadow-2xl cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 animate-pulse" />
                    <span>Show Match Controls</span>
                  </button>
                </div>
              )}


            </div>
          </>
        )}
      </main>
    </div>
  );
}
