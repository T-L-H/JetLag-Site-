import React, { useState, useEffect, useRef } from 'react';
import { GameSize, RoomState } from '../types';
import { Shield, Users, Radio, MapPin, Play, Plus, X, Globe, Copy, Check, Search, Compass, Navigation } from 'lucide-react';
import audio from '../lib/audio';
import { getDistance } from '../lib/geo';

declare const L: any; // Use global Leaflet from CDN

interface LobbyViewProps {
  room: RoomState | null;
  onCreateRoom: (params: {
    centerLat: number;
    centerLng: number;
    radiusMiles: number;
    gameSize: GameSize;
    teams: string[];
    gmName: string;
    gmTeam: string;
    hidingTimeLimit: number;
  }) => void;
  onJoinRoom: (code: string, playerName: string, teamName: string) => void;
  onLeaveRoom: () => void;
  onStartGame: () => void;
  userName: string;
  isGM: boolean;
}

const PRESET_LOCATIONS = [
  { name: 'New York City', lat: 40.7128, lng: -74.0060, radius: 5 },
  { name: 'London', lat: 51.5074, lng: -0.1278, radius: 5 },
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503, radius: 6 },
  { name: 'Paris', lat: 48.8566, lng: 2.3522, radius: 4 },
  { name: 'San Francisco', lat: 37.7749, lng: -122.4194, radius: 5 },
];

const TEAM_PRESETS = [
  { name: 'Colors 🎨', teams: ['Team Red', 'Team Blue', 'Team Yellow', 'Team Green'] },
  { name: 'Metros 🏙️', teams: ['Team London', 'Team Tokyo', 'Team New York', 'Team Paris'] },
  { name: 'Agents 🕵️', teams: ['Team Shadow', 'Team Phantom', 'Team Spectre', 'Team Ghost'] },
  { name: 'Gods ⚡', teams: ['Team Apollo', 'Team Zeus', 'Team Poseidon', 'Team Athena'] }
];

export default function LobbyView({
  room,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onStartGame,
  userName,
  isGM,
}: LobbyViewProps) {
  // Create state
  const [size, setSize] = useState<GameSize>('M');
  const [customLat, setCustomLat] = useState('40.7128');
  const [customLng, setCustomLng] = useState('-74.0060');
  const [customRadius, setCustomRadius] = useState('5.0');
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  // Setup Map Refs
  const setupMapContainerRef = useRef<HTMLDivElement>(null);
  const setupMapRef = useRef<any>(null);
  const centerMarkerRef = useRef<any>(null);
  const radiusMarkerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);

  // Join state
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState(userName || '');
  const [joinTeam, setJoinTeam] = useState('Team Red');
  const [availableTeams, setAvailableTeams] = useState<string[]>(['Team Red', 'Team Blue', 'Team Yellow']);
  const [newTeamName, setNewTeamName] = useState('');
  const [joinRoomState, setJoinRoomState] = useState<RoomState | null>(null);
  const [fetchingLobby, setFetchingLobby] = useState(false);

  // GM setup additions
  const [gmName, setGmName] = useState(userName || 'Game Master');
  const [gmTeam, setGmTeam] = useState('Team Red');
  const [hidingHours, setHidingHours] = useState(0);
  const [hidingMinutes, setHidingMinutes] = useState(10);

  const [copied, setCopied] = useState(false);

  // Sync GM name and team
  useEffect(() => {
    if (userName && gmName === 'Game Master') {
      setGmName(userName);
    }
  }, [userName]);

  useEffect(() => {
    if (availableTeams.length > 0 && !availableTeams.includes(gmTeam)) {
      setGmTeam(availableTeams[0]);
    }
  }, [availableTeams, gmTeam]);

  // Initialize Setup Map
  useEffect(() => {
    if (room || !setupMapContainerRef.current || setupMapRef.current) return;

    const initialLat = parseFloat(customLat) || 40.7128;
    const initialLng = parseFloat(customLng) || -74.0060;
    const initialRadius = parseFloat(customRadius) || 5;

    const map = L.map(setupMapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([initialLat, initialLng], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    setupMapRef.current = map;

    // Build custom HTML marker icons
    const centerIcon = L.divIcon({
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-8 h-8 bg-cyan-500/25 rounded-full animate-ping"></div>
          <div class="absolute w-5 h-5 bg-cyan-500 border-2 border-white rounded-full shadow-lg flex items-center justify-center">
            <div class="w-1.5 h-1.5 bg-slate-950 rounded-full"></div>
          </div>
        </div>
      `,
      className: 'custom-div-icon',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const radiusIcon = L.divIcon({
      html: `
        <div class="relative flex items-center justify-center">
          <div class="w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-lg flex items-center justify-center cursor-ew-resize">
            <div class="w-1.5 h-1.5 bg-slate-950 rounded-full"></div>
          </div>
          <div class="absolute -bottom-6 bg-slate-950/90 border border-slate-800 text-[9px] text-emerald-400 font-bold px-1.5 py-0.5 rounded shadow-md whitespace-nowrap select-none">
            RESIZE
          </div>
        </div>
      `,
      className: 'custom-div-icon-radius',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    // Circular overlay circle
    const circle = L.circle([initialLat, initialLng], {
      radius: initialRadius * 1609.34, // converted to meters
      color: '#06b6d4',
      weight: 2,
      fillColor: '#0891b2',
      fillOpacity: 0.15,
      dashArray: '5, 5',
    }).addTo(map);
    circleRef.current = circle;

    // Draggable center marker
    const centerMarker = L.marker([initialLat, initialLng], {
      draggable: true,
      icon: centerIcon,
    }).addTo(map);
    centerMarkerRef.current = centerMarker;

    // Draggable radius edge handle marker
    const milesPerDegreeLng = 69.0 * Math.cos((initialLat * Math.PI) / 180);
    const deltaLng = initialRadius / milesPerDegreeLng;
    const radiusMarker = L.marker([initialLat, initialLng + deltaLng], {
      draggable: true,
      icon: radiusIcon,
    }).addTo(map);
    radiusMarkerRef.current = radiusMarker;

    // Map click relocator
    map.on('click', (e: any) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      setCustomLat(lat.toFixed(6));
      setCustomLng(lng.toFixed(6));
      audio.playClick();
    });

    // Center marker drag
    centerMarker.on('drag', (e: any) => {
      const newPos = e.target.getLatLng();
      setCustomLat(newPos.lat.toFixed(6));
      setCustomLng(newPos.lng.toFixed(6));

      if (circleRef.current) {
        circleRef.current.setLatLng(newPos);
      }

      if (radiusMarkerRef.current) {
        const cLat = newPos.lat;
        const cLng = newPos.lng;
        const rMiles = parseFloat(customRadius) || 5;
        const mPerDegLng = 69.0 * Math.cos((cLat * Math.PI) / 180);
        const dLng = rMiles / mPerDegLng;
        radiusMarkerRef.current.setLatLng([cLat, cLng + dLng]);
      }
    });

    centerMarker.on('dragend', () => {
      audio.playClick();
    });

    // Radius marker drag (calculates new radius dynamically)
    radiusMarker.on('drag', (e: any) => {
      const newPos = e.target.getLatLng();
      const cPos = centerMarkerRef.current ? centerMarkerRef.current.getLatLng() : { lat: initialLat, lng: initialLng };

      const distMiles = getDistance(cPos.lat, cPos.lng, newPos.lat, newPos.lng);
      const clampedRadius = Math.max(0.1, Math.min(30, distMiles));
      setCustomRadius(clampedRadius.toFixed(2));

      if (circleRef.current) {
        circleRef.current.setRadius(clampedRadius * 1609.34);
      }
    });

    radiusMarker.on('dragend', () => {
      audio.playClick();
    });

    // Clean up
    return () => {
      if (setupMapRef.current) {
        setupMapRef.current.remove();
        setupMapRef.current = null;
        circleRef.current = null;
        centerMarkerRef.current = null;
        radiusMarkerRef.current = null;
      }
    };
  }, [room]);

  // Synchronize map representation when parameter states change externally
  useEffect(() => {
    const map = setupMapRef.current;
    if (!map) return;

    const lat = parseFloat(customLat);
    const lng = parseFloat(customLng);
    const rad = parseFloat(customRadius) || 5;

    if (isNaN(lat) || isNaN(lng)) return;

    const centerPos = [lat, lng];

    // Relocate center marker
    if (centerMarkerRef.current) {
      const currentPos = centerMarkerRef.current.getLatLng();
      if (Math.abs(currentPos.lat - lat) > 1e-6 || Math.abs(currentPos.lng - lng) > 1e-6) {
        centerMarkerRef.current.setLatLng(centerPos);
      }
    }

    // Adjust Circle boundary
    if (circleRef.current) {
      circleRef.current.setLatLng(centerPos);
      circleRef.current.setRadius(rad * 1609.34);
    }

    // Reposition radius edge handler
    if (radiusMarkerRef.current) {
      const milesPerDegreeLng = 69.0 * Math.cos((lat * Math.PI) / 180);
      const deltaLng = rad / milesPerDegreeLng;
      const expectedPos = [lat, lng + deltaLng];

      const currentPos = radiusMarkerRef.current.getLatLng();
      if (Math.abs(currentPos.lat - expectedPos[0]) > 1e-6 || Math.abs(currentPos.lng - expectedPos[1]) > 1e-6) {
        radiusMarkerRef.current.setLatLng(expectedPos);
      }
    }
  }, [customLat, customLng, customRadius]);

  const handleCopyCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    audio.playClick();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddTeam = () => {
    if (newTeamName.trim() && !availableTeams.includes(newTeamName.trim())) {
      setAvailableTeams([...availableTeams, newTeamName.trim()]);
      setNewTeamName('');
      audio.playClick();
    }
  };

  const handleRemoveTeam = (team: string) => {
    setAvailableTeams(availableTeams.filter((t) => t !== team));
    audio.playClick();
  };

  const handlePresetClick = (preset: typeof PRESET_LOCATIONS[0], idx: number) => {
    setSelectedPresetIndex(idx);
    setCustomLat(preset.lat.toFixed(6));
    setCustomLng(preset.lng.toFixed(6));
    const rad = size === 'S' ? 1.5 : size === 'M' ? 5.0 : 12.0;
    setCustomRadius(rad.toString());

    if (setupMapRef.current) {
      setupMapRef.current.setView([preset.lat, preset.lng], 12);
    }
    audio.playClick();
  };

  const handleSearchLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        setCustomLat(lat.toFixed(6));
        setCustomLng(lng.toFixed(6));
        if (setupMapRef.current) {
          setupMapRef.current.setView([lat, lng], 13);
        }
        audio.playSuccess();
      } else {
        alert("Location not found. Try a different search query.");
      }
    } catch (error) {
      console.error("Search error:", error);
      alert("Error searching for location.");
    } finally {
      setSearching(false);
    }
  };

  const handleCreate = () => {
    const lat = parseFloat(customLat) || 40.7128;
    const lng = parseFloat(customLng) || -74.0060;
    const radius = parseFloat(customRadius) || 5;

    if (availableTeams.length < 2) {
      alert("At least 2 teams are required to create a lobby.");
      return;
    }

    audio.playSuccess();
    const computedMinutes = Math.max(1, hidingHours * 60 + hidingMinutes);
    onCreateRoom({
      centerLat: lat,
      centerLng: lng,
      radiusMiles: radius,
      gameSize: size,
      teams: availableTeams,
      gmName: gmName.trim() || 'Game Master',
      gmTeam: gmTeam,
      hidingTimeLimit: computedMinutes,
    });
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim() || !joinName.trim()) return;

    setFetchingLobby(true);
    try {
      const res = await fetch(`/api/rooms/${joinCode.toUpperCase().trim()}`);
      
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        if (isLocalhost) {
          alert("Backend server connection failed: The API request returned HTML instead of JSON. Please make sure the backend Express server is running (start it with 'npm run dev' or 'npm run build && npm run start' which runs 'server.ts', rather than running 'vite' directly).");
        } else {
          alert("Your browser's security/cookie settings are blocking the server connection inside the preview window. Please open the app in a New Tab (click the 'Open in new tab' square-arrow icon at the top right of the preview) to join and play!");
        }
        setFetchingLobby(false);
        return;
      }

      if (!res.ok) {
        alert("Lobby not found. Please verify the 4-digit code.");
        setFetchingLobby(false);
        return;
      }
      const roomData: RoomState = await res.json();
      if (roomData.teams && roomData.teams.length > 0) {
        setJoinRoomState(roomData);
        audio.playSuccess();
      } else {
        alert("No teams set up in this lobby yet.");
      }
    } catch (error: any) {
      console.error("Detailed error in handleJoin:", error);
      alert(`Error finding lobby details: ${error?.message || error}`);
    } finally {
      setFetchingLobby(false);
    }
  };

  const fallbackToIPLocation = async () => {
    // Try primary secure IP-based geolocation (ipapi.co)
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (!res.ok) throw new Error('IP API response error');
      const data = await res.json();
      if (data && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        const lat = data.latitude;
        const lng = data.longitude;
        setCustomLat(lat.toFixed(6));
        setCustomLng(lng.toFixed(6));
        if (setupMapRef.current) {
          setupMapRef.current.setView([lat, lng], 13);
        }
        audio.playSuccess();
        return;
      }
    } catch (e) {
      console.warn('Primary IP Geolocation fallback failed:', e);
    }

    // Try secondary backup IP-based geolocation (ipinfo.io)
    try {
      const res = await fetch('https://ipinfo.io/json');
      if (res.ok) {
        const data = await res.json();
        if (data && data.loc) {
          const [latStr, lngStr] = data.loc.split(',');
          const lat = parseFloat(latStr);
          const lng = parseFloat(lngStr);
          if (!isNaN(lat) && !isNaN(lng)) {
            setCustomLat(lat.toFixed(6));
            setCustomLng(lng.toFixed(6));
            if (setupMapRef.current) {
              setupMapRef.current.setView([lat, lng], 13);
            }
            audio.playSuccess();
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Secondary IP Geolocation backup failed:', e);
    }

    alert('Unable to retrieve location automatically. Please search or enter coordinates manually.');
  };

  const requestGeolocation = () => {
    setLocating(true);
    if (!navigator.geolocation) {
      fallbackToIPLocation().finally(() => setLocating(false));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCustomLat(lat.toFixed(6));
        setCustomLng(lng.toFixed(6));
        if (setupMapRef.current) {
          setupMapRef.current.setView([lat, lng], 13);
        }
        audio.playSuccess();
        setLocating(false);
      },
      (err) => {
        console.warn('HTML5 Geolocation failed/denied, falling back to IP lookup:', err);
        fallbackToIPLocation().finally(() => setLocating(false));
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 5 * 60 * 1000,
      }
    );
  };

  // 1. Setup view (No active room yet)
  if (!room) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch max-w-7xl mx-auto py-4">
        {/* Create Game Panel */}
        <div className="lg:col-span-7 flex flex-col space-y-6">
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex-1 flex flex-col">
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center space-x-3 mb-6 shrink-0">
              <div className="p-2.5 bg-cyan-500/10 rounded-2xl text-cyan-400">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-100 font-sans tracking-tight">Create Game Lobby</h2>
                <p className="text-xs text-slate-400">Set up a fully customized real-time tracking zone</p>
              </div>
            </div>

            {/* Quick Presets Finder */}
            <div className="mb-5 shrink-0">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Location Presets</label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {PRESET_LOCATIONS.map((preset, idx) => (
                  <button
                    key={preset.name}
                    onClick={() => handlePresetClick(preset, idx)}
                    className={`px-2 py-2 rounded-xl border text-center text-xs transition-all cursor-pointer ${
                      selectedPresetIndex === idx
                        ? 'bg-cyan-500/10 border-cyan-500/60 text-cyan-300 font-bold shadow-md shadow-cyan-950/40'
                        : 'bg-slate-950/40 border-slate-900 text-slate-400 hover:border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <span className="truncate block">{preset.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Search Look Up and Start My Location */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-5 shrink-0">
              <form onSubmit={handleSearchLocation} className="sm:col-span-8 flex space-x-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Look up a location..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-10 pr-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching}
                  className="bg-slate-800 hover:bg-slate-755 text-cyan-400 px-4 py-2 rounded-xl text-xs font-bold border border-slate-700 transition-colors shrink-0 flex items-center justify-center min-w-[70px] cursor-pointer"
                >
                  {searching ? '...' : 'Search'}
                </button>
              </form>

              <button
                type="button"
                onClick={requestGeolocation}
                disabled={locating}
                className="sm:col-span-4 bg-slate-950 border border-slate-850 hover:border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 py-2.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <MapPin className={`w-3.5 h-3.5 text-cyan-400 ${locating ? 'animate-spin' : 'animate-pulse'}`} />
                <span>{locating ? 'Locating...' : 'Locate Me'}</span>
              </button>
            </div>

            {/* Game Size Selector */}
            <div className="mb-5 shrink-0">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Zone Scale & Density Preset</label>
              <div className="grid grid-cols-3 gap-3">
                {(['S', 'M', 'L'] as GameSize[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSize(s);
                      const rad = s === 'S' ? 1.5 : s === 'M' ? 5.0 : 12.0;
                      setCustomRadius(rad.toString());
                      audio.playClick();
                    }}
                    className={`py-2.5 px-3 rounded-xl border transition-all duration-300 flex flex-col items-center cursor-pointer ${
                      size === s
                        ? 'bg-cyan-500/10 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-950/40'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs font-bold">{s === 'S' ? 'Small' : s === 'M' ? 'Medium' : 'Large'}</span>
                    <span className="text-[9px] opacity-75 font-normal mt-0.5 text-center">
                      {s === 'S' ? '1.5mi • Compact' : s === 'M' ? '5.0mi • Standard' : '12.0mi • Expansive'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Sliders and Coordinate Information */}
            <div className="space-y-4 bg-slate-950/50 border border-slate-850/60 p-4 rounded-2xl mb-5 shrink-0">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Game Zone Radius</label>
                  <span className="text-xs font-black text-cyan-400 font-mono">{parseFloat(customRadius).toFixed(2)} miles</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="20.0"
                  step="0.1"
                  value={customRadius}
                  onChange={(e) => {
                    setCustomRadius(e.target.value);
                    audio.playClick();
                  }}
                  className="w-full accent-cyan-400 cursor-ew-resize bg-slate-900 rounded-lg h-1.5"
                />
                <span className="block text-[9px] text-slate-500">Drag range slider, click setup map, or drag outer green handle to draw!</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-900/60">
                <div>
                  <label className="block text-[9px] font-medium text-slate-400 mb-1">Center Latitude</label>
                  <input
                    type="text"
                    value={customLat}
                    onChange={(e) => setCustomLat(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 font-mono text-center focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-medium text-slate-400 mb-1">Center Longitude</label>
                  <input
                    type="text"
                    value={customLng}
                    onChange={(e) => setCustomLng(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 font-mono text-center focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>

            {/* Teams Setup */}
            <div className="mb-5 shrink-0 bg-slate-950/30 border border-slate-850/50 p-4 rounded-2xl">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Configure Game Teams</span>
              
              {/* Preset Buttons */}
              <div className="mb-3">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Load Team Presets</span>
                <div className="flex flex-wrap gap-1.5">
                  {TEAM_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setAvailableTeams(preset.teams);
                        audio.playClick();
                      }}
                      className="px-2.5 py-1 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-850 text-[10px] font-semibold text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {availableTeams.map((team) => (
                  <span
                    key={team}
                    className="inline-flex items-center space-x-1 bg-slate-950 text-slate-300 border border-slate-850 px-3 py-1.5 rounded-xl text-xs"
                  >
                    <span>{team}</span>
                    {availableTeams.length > 2 && (
                      <button onClick={() => handleRemoveTeam(team)} className="text-red-400 hover:text-red-200 cursor-pointer">
                        <X className="w-3.5 h-3.5 ml-1" />
                      </button>
                    )}
                  </span>
                ))}
              </div>

              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="New team name..."
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={handleAddTeam}
                  className="bg-slate-800 hover:bg-slate-700 text-cyan-400 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1 border border-slate-700 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add</span>
                </button>
              </div>
            </div>

            {/* GM Game Identity & Rules */}
            <div className="mb-5 shrink-0 bg-slate-950/40 border border-slate-850/60 p-4 rounded-2xl space-y-4">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">GM Identity & Game Rules</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-medium text-slate-400 mb-1">Your GM Player Name</label>
                  <input
                    type="text"
                    value={gmName}
                    onChange={(e) => setGmName(e.target.value)}
                    placeholder="Game Master"
                    className="w-full bg-slate-900 border border-slate-850 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-medium text-slate-400 mb-1">Your Joined Team</label>
                  <select
                    value={gmTeam}
                    onChange={(e) => setGmTeam(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-850 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    {availableTeams.map((team) => (
                      <option key={team} value={team} className="bg-slate-950 text-slate-200">
                        {team}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-900/60">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hiding Period Time Limit</label>
                  <span className="text-xs font-black text-rose-400 font-mono">
                    {hidingHours > 0 ? `${hidingHours}h ` : ''}{hidingMinutes}m
                  </span>
                </div>
                
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-[8px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Hours</label>
                    <select
                      value={hidingHours}
                      onChange={(e) => {
                        const hrs = parseInt(e.target.value) || 0;
                        setHidingHours(hrs);
                        if (hrs === 24) {
                          setHidingMinutes(0);
                        } else if (hrs === 0 && hidingMinutes === 0) {
                          setHidingMinutes(1);
                        }
                        audio.playClick();
                      }}
                      className="w-full bg-slate-900 border border-slate-850 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono cursor-pointer"
                    >
                      {Array.from({ length: 25 }, (_, i) => (
                        <option key={i} value={i} className="bg-slate-950 text-slate-200">
                          {i} hr{i !== 1 ? 's' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1">
                    <label className="block text-[8px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Minutes</label>
                    <select
                      value={hidingMinutes}
                      onChange={(e) => {
                        const mins = parseInt(e.target.value) || 0;
                        setHidingMinutes(mins);
                        audio.playClick();
                      }}
                      disabled={hidingHours === 24}
                      className="w-full bg-slate-900 border border-slate-850 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {Array.from({ length: 60 }, (_, i) => {
                        if (hidingHours === 0 && i === 0) return null;
                        return (
                          <option key={i} value={i} className="bg-slate-950 text-slate-200">
                            {i} min{i !== 1 ? 's' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
                <span className="block text-[9px] text-slate-500 mt-1">
                  Decide how long hiders get to reach their hiding spot (from 1 minute up to 24 hours).
                </span>
              </div>
            </div>

            <div className="mt-auto pt-4 shrink-0">
              <button
                onClick={handleCreate}
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 py-3.5 rounded-2xl font-bold text-sm tracking-wide shadow-lg shadow-cyan-950/30 transition-all active:scale-[0.99] flex items-center justify-center space-x-2 border border-cyan-300/30 cursor-pointer"
              >
                <Shield className="w-4.5 h-4.5" />
                <span>Generate Lobby</span>
              </button>
            </div>
          </div>
        </div>

        {/* Setup Map and Join Column */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Draggable setup map card */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-3xl p-4 shadow-2xl flex-1 flex flex-col min-h-[400px]">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Game Zone Setup Map</h3>
                <p className="text-[10px] text-slate-500">Drag center pin to relocate, outer green pin to resize</p>
              </div>
              <Compass className="w-4 h-4 text-cyan-400 animate-spin-slow" />
            </div>
            
            {/* The actual Map mount container */}
            <div className="flex-1 relative rounded-2xl overflow-hidden border border-slate-950 shadow-inner min-h-[300px]">
              <div 
                ref={setupMapContainerRef} 
                className="absolute inset-0 z-0 h-full w-full bg-slate-950" 
              />
            </div>
          </div>

          {/* Join Game Card */}
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-3xl p-6 shadow-2xl relative shrink-0">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-indigo-500/10 rounded-2xl text-indigo-400">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-100 font-sans tracking-tight">Join Existing Lobby</h2>
                <p className="text-[10px] text-slate-400">Connect to an active room code</p>
              </div>
            </div>

            <form onSubmit={handleJoin} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Join Code</label>
                  <input
                    type="text"
                    placeholder="e.g. ABCD"
                    maxLength={4}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-1.5 text-sm font-bold tracking-widest text-indigo-300 uppercase focus:outline-none focus:border-indigo-500 text-center"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Username</label>
                  <input
                    type="text"
                    placeholder="e.g. Sam"
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={fetchingLobby}
                className="w-full bg-indigo-500 hover:bg-indigo-400 text-white py-2.5 rounded-xl font-bold text-xs tracking-wide shadow-lg shadow-indigo-950/30 transition-all active:scale-[0.99] flex items-center justify-center space-x-2 border border-indigo-300/30 cursor-pointer mt-2 animate-pulse"
              >
                <Users className="w-3.5 h-3.5" />
                <span>{fetchingLobby ? 'Connecting...' : 'Connect to Field'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Modal/Popup Selection Overlay */}
        {joinRoomState && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-2xl max-w-md w-[calc(100%-1rem)] md:w-full relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
              
              <h3 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
                <Users className="w-5 h-5 text-indigo-400 animate-pulse" />
                <span>Select Your Team</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Welcome <span className="text-indigo-300 font-bold">{joinName}</span>! Choose a team configured by your GM in Lobby <span className="text-indigo-300 font-mono font-bold">{joinRoomState.code}</span>:
              </p>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {joinRoomState.teams.map((team) => {
                  return (
                    <button
                      key={team.name}
                      type="button"
                      onClick={() => {
                        setJoinTeam(team.name);
                        onJoinRoom(joinRoomState.code, joinName, team.name);
                        setJoinRoomState(null);
                        audio.playSuccess();
                      }}
                      className="w-full text-left p-3.5 bg-slate-950/80 hover:bg-indigo-950/30 border border-slate-850 hover:border-indigo-500/60 rounded-xl transition-all flex items-center justify-between cursor-pointer group"
                    >
                      <div>
                        <span className="text-sm font-bold text-slate-200 group-hover:text-indigo-300 transition-colors">
                          {team.name}
                        </span>
                        <span className="block text-[10px] text-slate-500 mt-0.5">
                          Players: {team.players.length > 0 ? team.players.join(', ') : 'None yet'}
                        </span>
                      </div>
                      <span className="text-[10px] bg-slate-900 border border-slate-800 text-indigo-300 font-bold px-2 py-1 rounded-lg">
                        Join
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 pt-3 border-t border-slate-850 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setJoinRoomState(null);
                    audio.playClick();
                  }}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-200 px-4 py-2 rounded-xl bg-slate-950/50 hover:bg-slate-950 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. Waiting Lobby view (Active room state)
  const isGMAndLobbyOwner = isGM && room.players.length > 0;

  return (
  <div className="max-w-4xl mx-auto py-6 space-y-4">
    {/* Leave / Discard Lobby Session */}
    <div className="flex justify-start">
      <button
        onClick={() => {
          if (confirm(isGM ? "Are you sure you want to discard this session and go back to setup?" : "Are you sure you want to leave this lobby?")) {
            onLeaveRoom();
            audio.playClick();
          }
        }}
        className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-400 hover:text-rose-400 transition-colors cursor-pointer bg-slate-950 border border-slate-850 hover:border-rose-950 px-3.5 py-2 rounded-xl shadow-md"
      >
        <X className="w-3.5 h-3.5 text-rose-500" />
        <span>{isGM ? "Discard Session & Start Over" : "Leave Lobby & Back to Setup"}</span>
      </button>
    </div>

    <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-2">
          <div className="inline-flex items-center space-x-1.5 bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
            <Radio className="w-3 h-3 animate-ping" />
            <span>Lobby Broadcasting</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100 font-sans tracking-tight">
            Waiting for Players to Connect...
          </h1>
          <p className="text-xs text-slate-400">
            Game Scale: <span className="text-cyan-300 font-semibold">{room.gameSize === 'S' ? 'Small (1mi)' : room.gameSize === 'M' ? 'Medium (5mi)' : 'Large (20mi)'}</span> • 
            Center: <span className="text-slate-300">{room.centerLat.toFixed(4)}, {room.centerLng.toFixed(4)}</span>
          </p>
        </div>

        {/* Join Code Display */}
        <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4 flex flex-col items-center justify-center min-w-[200px] relative">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Join Code</span>
          <div className="flex items-center space-x-2">
            <span className="text-3xl font-black tracking-widest text-cyan-300 font-sans">{room.code}</span>
            <button
              onClick={handleCopyCode}
              className="p-1.5 bg-slate-900 hover:bg-slate-850 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Copy Join Code"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Teams List */}
        <div className="md:col-span-7 bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-3xl p-6 shadow-2xl">
          <h3 className="text-base font-bold text-slate-200 mb-4 flex items-center space-x-2">
            <Users className="w-4.5 h-4.5 text-cyan-400" />
            <span>Connected Teams ({room.teams.length})</span>
          </h3>

          <div className="space-y-3">
            {room.teams.map((team) => (
              <div
                key={team.name}
                className="bg-slate-950/70 border border-slate-850/80 p-4 rounded-2xl flex items-center justify-between"
              >
                <div>
                  <h4 className="text-sm font-extrabold text-slate-200">{team.name}</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Players: <span className="text-slate-300 font-medium">{team.players.join(', ')}</span>
                  </p>
                </div>
                <span className="bg-slate-900 border border-slate-800 text-cyan-300 text-xs px-2.5 py-1 rounded-xl font-bold">
                  Seeker Team
                </span>
              </div>
            ))}
            {room.teams.length === 0 && (
              <div className="text-center py-8 text-xs text-slate-500 bg-slate-950/20 border border-dashed border-slate-850 rounded-2xl">
                No teams connected yet. Share the code to join!
              </div>
            )}
          </div>
        </div>

        {/* Connected Players Side List */}
        <div className="md:col-span-5 bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-3xl p-6 shadow-2xl space-y-4">
          <h3 className="text-base font-bold text-slate-200 mb-2 flex items-center space-x-2">
            <Shield className="w-4.5 h-4.5 text-cyan-400" />
            <span>Active Connections ({room.players.length})</span>
          </h3>

          <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
            {room.players.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between p-2.5 bg-slate-950/40 border border-slate-900 rounded-xl"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-xs font-semibold text-slate-300">{player.name}</span>
                </div>
                <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded-lg">
                  {player.team}
                </span>
              </div>
            ))}
          </div>

          {isGMAndLobbyOwner ? (
            <div className="pt-4 border-t border-slate-800/80">
              <button
                onClick={() => {
                  audio.playSuccess();
                  onStartGame();
                }}
                disabled={room.teams.length < 2}
                className={`w-full py-3.5 rounded-2xl font-bold text-sm tracking-wide shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                  room.teams.length >= 2
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-teal-950/20 hover:from-emerald-400 hover:to-teal-400 hover:scale-[1.01]'
                    : 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Play className="w-4.5 h-4.5 fill-current" />
                <span>Start Tracking Match</span>
              </button>
              {room.teams.length < 2 && (
                <p className="text-[10px] text-center text-rose-400 mt-2">
                  ⚠️ Waiting for at least 2 teams to connect before starting.
                </p>
              )}
            </div>
          ) : (
            <div className="bg-slate-950/60 border border-slate-850 p-3 rounded-xl text-center">
              <p className="text-xs text-slate-400 animate-pulse">
                🎮 Waiting for the Game Master to launch the game...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
