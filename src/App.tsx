import React, { useState, useEffect } from 'react';
import { RoomState, Card, ActiveQuestion, Team } from './types';
import LobbyView from './components/LobbyView';
import HiderView from './components/HiderView';
import SeekerView from './components/SeekerView';
import MapComponent from './components/MapComponent';
import LeaderboardView from './components/LeaderboardView';
import { Globe, Shield, RefreshCw, Compass, MapPin, Sliders, Volume2, VolumeX, Eye, Info } from 'lucide-react';
import audio from './lib/audio';
import { safeStorage } from './lib/storage';

export default function App() {
  // Identity states
  const [userName, setUserName] = useState<string>(() => safeStorage.getItem('jt_username') || '');
  const [roomCode, setRoomCode] = useState<string>(() => safeStorage.getItem('jt_room_code') || '');
  const [isGM, setIsGM] = useState<boolean>(() => safeStorage.getItem('jt_is_gm') === 'true');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Active game states
  const [room, setRoom] = useState<RoomState | null>(null);
  const [sseConnected, setSseConnected] = useState(false);

  // Pin selection tools
  const [selectionMode, setSelectionMode] = useState<'CUSTOM_PIN' | 'TRANSIT_PIN' | null>(null);
  const [customPin, setCustomPin] = useState<{ lat: number; lng: number } | null>(null);
  const [transitPin, setTransitPin] = useState<{ lat: number; lng: number } | null>(null);

  // Simulated Coordinates (for testing inside AI Studio iframe!)
  const [simLat, setSimLat] = useState('40.7128');
  const [simLng, setSimLng] = useState('-74.0060');
  const [simActive, setSimActive] = useState(false);

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
        
        // Feed mock coordinates default center if first load
        if (state && !simActive && state.centerLat) {
          setSimLat(state.centerLat.toString());
          setSimLng(state.centerLng.toString());
        }
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

    // If manual coordination simulation is active, report the manual values instead
    if (simActive) {
      const lat = parseFloat(simLat) || room?.centerLat || 40.7128;
      const lng = parseFloat(simLng) || room?.centerLng || -74.0060;
      reportLocation(lat, lng);
      return;
    }

    // Otherwise use native browser Geolocation
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          reportLocation(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          console.warn('Geolocation warning, falling back to simulation:', err);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [roomCode, userName, simActive, simLat, simLng, room?.centerLat, room?.centerLng]);

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
    const isConfirmed = window.confirm(`Would you like to set your pin at this location?`);
    if (isConfirmed) {
      if (pinType === 'CUSTOM') {
        setCustomPin({ lat, lng });
      } else {
        setTransitPin({ lat, lng });
      }
      audio.playSuccess();
    }
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

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0a0d16] text-slate-100 font-sans">
      {/* Header bar */}
      <header className="flex justify-between items-center h-16 px-6 bg-[#0e1322] border-b border-slate-900 shadow-md shrink-0 select-none">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight text-slate-100">JET TRACKER</h1>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              {room ? `LOBBY: ${room.code}` : 'GPS Proximity Field'}
            </p>
          </div>
        </div>

        {/* Live sync indicators and score stops */}
        {room && room.gamePhase !== 'LOBBY' && (
          <div className="flex items-center space-x-4">
            {/* Stopwatch counting up/down */}
            <div className="bg-slate-950/80 border border-slate-900 px-3 py-1.5 rounded-xl text-center">
              <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500 block">Round Score Clock</span>
              <span className="text-sm font-black font-mono text-cyan-400 tracking-widest">
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
            <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold ${sseConnected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400 animate-ping'}`} />
              <span>{sseConnected ? 'Sync Live' : 'Offline'}</span>
            </span>
          )}

          <button
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              if (!soundEnabled) audio.playClick();
            }}
            className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:text-white transition-colors text-slate-400"
            title="Toggle Synthesized Audio Feedback"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4" />}
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
            {/* Floating Left Menu Bento */}
            <div className="w-full md:w-[360px] lg:w-[420px] bg-[#0e1322]/40 backdrop-blur-md border-r border-slate-900 flex flex-col shrink-0 overflow-y-auto p-4 space-y-4 z-10">
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
            <div className="flex-1 h-full relative">
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

              {/* Developer Coordinates Simulator (for AI Studio iframe play testing!) */}
              <div className="absolute bottom-4 right-4 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-2xl z-[1000] w-64 max-w-sm text-left">
                <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-900">
                  <div className="flex items-center space-x-1.5">
                    <Sliders className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                    <span className="text-[10px] font-bold text-slate-200 uppercase tracking-wider">Dev Coordinate GPS Mock</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={simActive}
                    onChange={(e) => {
                      setSimActive(e.target.checked);
                      audio.playClick();
                    }}
                    className="w-3.5 h-3.5 accent-cyan-400 cursor-pointer"
                  />
                </div>

                {simActive ? (
                  <div className="space-y-2.5 text-[10px]">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-slate-500 block">Mock Latitude</span>
                        <input
                          type="text"
                          value={simLat}
                          onChange={(e) => setSimLat(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1 text-[10px] font-mono mt-0.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <span className="text-slate-500 block">Mock Longitude</span>
                        <input
                          type="text"
                          value={simLng}
                          onChange={(e) => setSimLng(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1 text-[10px] font-mono mt-0.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>
                    {/* Small coordinate walking controls */}
                    <div className="grid grid-cols-4 gap-1 pt-1.5 border-t border-slate-900">
                      {[
                        { dir: 'North', dLat: 0.0008, dLng: 0 },
                        { dir: 'South', dLat: -0.0008, dLng: 0 },
                        { dir: 'East', dLat: 0, dLng: 0.0008 },
                        { dir: 'West', dLat: 0, dLng: -0.0008 },
                      ].map((btn) => (
                        <button
                          key={btn.dir}
                          onClick={() => {
                            setSimLat((prev) => (parseFloat(prev) + btn.dLat).toFixed(6));
                            setSimLng((prev) => (parseFloat(prev) + btn.dLng).toFixed(6));
                            audio.playClick();
                          }}
                          className="py-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-md font-bold text-[9px]"
                        >
                          {btn.dir}
                        </button>
                      ))}
                    </div>
                    <span className="block text-[8px] text-slate-500 text-center italic mt-1">
                      Check box active: Reports custom coordinates above as your physical field GPS feed.
                    </span>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Turn on check box to mock walking and report customized coordinates to the tracking map!
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
