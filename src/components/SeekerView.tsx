import React, { useState, useEffect } from 'react';
import { RoomState, ActiveQuestion, ActiveCurse } from '../types';
import { MATCHING_POIS, MEASURING_POIS, PHOTO_SUBJECTS } from '../lib/cardsData';
import { Radio, MapPin, Eye, Compass, ShieldAlert, Sparkles, Layers, Image, Check, X, Shield, Camera, AlertCircle, HelpCircle, Flame } from 'lucide-react';
import audio from '../lib/audio';

// Helper function to check if a pin is vetoed based on lat/lng proximity (~100m)
function isPinVetoed(lat: number, lng: number, vetoedTypes: string[]): boolean {
  const threshold = 0.0009; // Approx 100 meters
  for (const v of vetoedTypes) {
    if (v.startsWith('MEASURING:PIN:')) {
      const parts = v.split(':');
      const vLat = parseFloat(parts[2]);
      const vLng = parseFloat(parts[3]);
      if (!isNaN(vLat) && !isNaN(vLng)) {
        if (Math.abs(lat - vLat) < threshold && Math.abs(lng - vLng) < threshold) {
          return true;
        }
      }
    }
  }
  return false;
}

interface SeekerViewProps {
  room: RoomState;
  userName: string;
  onProposeQuestion: (question: Omit<ActiveQuestion, 'id' | 'status'>) => void;
  onDismissCurseRequest: (curseId: string) => void;
  onCatchHider: () => void;
  enablePinSelection: (mode: 'CUSTOM_PIN' | null) => void;
  customPin: { lat: number; lng: number } | null;
  clearCustomPin: () => void;
  onPinDropped: (lat: number, lng: number) => void;
  qType: 'MATCHING' | 'MEASURING' | 'THERMOMETER' | 'RADAR' | 'TENTACLES' | 'PHOTO' | null;
  setQType: (type: 'MATCHING' | 'MEASURING' | 'THERMOMETER' | 'RADAR' | 'TENTACLES' | 'PHOTO' | null) => void;
  matchingPoi: string;
  setMatchingPoi: (poi: string) => void;
  radarDistance: number;
  setRadarDistance: (dist: number) => void;
  tentaclePoi: string;
  setTentaclePoi: (poi: string) => void;
  tentacleDistance: number;
  setTentacleDistance: (dist: number) => void;
  previewingQuestion: Omit<ActiveQuestion, 'id' | 'status'> | null;
  setPreviewingQuestion: (q: Omit<ActiveQuestion, 'id' | 'status'> | null) => void;
  onClearQuestion: () => void;
  isMobileFloating?: boolean;
}

export default function SeekerView({
  room,
  userName,
  onProposeQuestion,
  onDismissCurseRequest,
  onCatchHider,
  enablePinSelection,
  customPin,
  clearCustomPin,
  onPinDropped,
  qType,
  setQType,
  matchingPoi,
  setMatchingPoi,
  radarDistance,
  setRadarDistance,
  tentaclePoi,
  setTentaclePoi,
  tentacleDistance,
  setTentacleDistance,
  previewingQuestion,
  setPreviewingQuestion,
  onClearQuestion,
  isMobileFloating = false,
}: SeekerViewProps) {
  const [activeTab, setActiveTab] = useState<'ASK' | 'STATUS'>('ASK');
  const [mobileActiveTab, setMobileActiveTab] = useState<'ASK' | 'STATUS'>('ASK');

  // Address geocoding states for Measuring question
  const [addressInput, setAddressInput] = useState('');
  const [geocodingLoading, setGeocodingLoading] = useState(false);
  const [geocodingError, setGeocodingError] = useState<string | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Suggestion autocomplete from OSM Nominatim
  useEffect(() => {
    if (!addressInput.trim() || addressInput.length < 3) {
      setAddressSuggestions([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            addressInput
          )}&limit=5`,
          {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'JetTrackerApplet/1.0',
            },
          }
        );
        if (response.ok) {
          const results = await response.json();
          if (results && results.length > 0) {
            setAddressSuggestions(results);
          } else {
            setAddressSuggestions([]);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch suggestions:', err);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [addressInput]);

  const [photoSubject, setPhotoSubject] = useState('');

  // Thermometer state
  const [thermometerDistance, setThermometerDistance] = useState(0.5); // miles
  const [thermometerActive, setThermometerActive] = useState(false);
  const [thermometerStartPin, setThermometerStartPin] = useState<{ lat: number; lng: number } | null>(null);

  // Curse Fulfill confirmation
  const [confirmingCurseId, setConfirmingCurseId] = useState<string | null>(null);

  // Caught Hold mechanism
  const [catchPressed, setCatchPressed] = useState(false);
  const [catchProgress, setCatchProgress] = useState(0);

  // Auto sound playing for curse active
  useEffect(() => {
    if (room.activeCurses.length > 0) {
      audio.playCurse();
    }
  }, [room.activeCurses.length]);

  // Auto-select first non-banned MATCHING POI if current is banned
  useEffect(() => {
    const isCurrentBanned = room.vetoedTypes.includes(`MATCHING:${matchingPoi}`);
    if (isCurrentBanned) {
      const firstAvailable = MATCHING_POIS.find(p => !room.vetoedTypes.includes(`MATCHING:${p}`));
      if (firstAvailable) {
        setMatchingPoi(firstAvailable);
      }
    }
  }, [room.vetoedTypes, matchingPoi, setMatchingPoi]);

  // Auto-select first non-banned TENTACLES POI if current is banned
  useEffect(() => {
    const isCurrentBanned = room.vetoedTypes.includes(`TENTACLES:POI:${tentaclePoi}`);
    if (isCurrentBanned) {
      const options = ['Museums', 'Libraries', 'Movie Theatres', 'Hospitals', 'Metro Lines', 'Zoos', 'Aquariums', 'Amusement Parks'];
      const firstAvailable = options.find(p => !room.vetoedTypes.includes(`TENTACLES:POI:${p}`));
      if (firstAvailable) {
        setTentaclePoi(firstAvailable);
      }
    }
  }, [room.vetoedTypes, tentaclePoi, setTentaclePoi]);

  // Auto-select first non-banned thermometer distance
  useEffect(() => {
    const isCurrentBanned = room.vetoedTypes.includes(`THERMOMETER:DIST:${thermometerDistance}`);
    if (isCurrentBanned) {
      const options = [0.5, 3.0, 10.0, 50.0];
      const firstAvailable = options.find(d => !room.vetoedTypes.includes(`THERMOMETER:DIST:${d}`));
      if (firstAvailable !== undefined) {
        setThermometerDistance(firstAvailable);
      }
    }
  }, [room.vetoedTypes, thermometerDistance, setThermometerDistance]);

  // Auto-select first non-banned radar distance
  useEffect(() => {
    const isCurrentBanned = room.vetoedTypes.includes(`RADAR:DIST:${radarDistance}`);
    if (isCurrentBanned) {
      const options = [0.25, 0.5, 1.0, 3.0, 5.0, 10.0, 25.0, 50.0];
      const firstAvailable = options.find(d => !room.vetoedTypes.includes(`RADAR:DIST:${d}`));
      if (firstAvailable !== undefined) {
        setRadarDistance(firstAvailable);
      }
    }
  }, [room.vetoedTypes, radarDistance, setRadarDistance]);

  // Set default photo subject based on game size (filtering out banned options)
  useEffect(() => {
    const subjects = PHOTO_SUBJECTS[room.gameSize] || PHOTO_SUBJECTS.M;
    const firstNonBanned = subjects.find(subj => !room.vetoedTypes.includes(`PHOTO:SUBJ:${subj}`));
    if (firstNonBanned) {
      setPhotoSubject(firstNonBanned);
    } else {
      setPhotoSubject(subjects[0]);
    }
  }, [room.gameSize, room.vetoedTypes]);

  // Handle Catch holding
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

  // Set default photo subject based on game size
  useEffect(() => {
    const subjects = PHOTO_SUBJECTS[room.gameSize] || PHOTO_SUBJECTS.M;
    setPhotoSubject(subjects[0]);
  }, [room.gameSize]);

  // Geocode address or place name to lat/lng using OSM Nominatim & local POIs
  const handleGeocodeAddress = async () => {
    if (!addressInput.trim()) return;
    setGeocodingLoading(true);
    setGeocodingError(null);
    audio.playClick();
    try {
      // 1. Try to search inside local room POIs first
      const matchedPoi = room.pois?.find((p) =>
        p.name.toLowerCase().includes(addressInput.toLowerCase()) ||
        p.type.toLowerCase().includes(addressInput.toLowerCase())
      );
      if (matchedPoi) {
        onPinDropped(matchedPoi.lat, matchedPoi.lng);
        audio.playSuccess();
        setGeocodingLoading(false);
        return;
      }

      // 2. Query OSM free public Nominatim API
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          addressInput
        )}&limit=1`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'JetTrackerApplet/1.0',
          },
        }
      );
      if (!response.ok) {
        throw new Error('OSM service unavailable');
      }
      const results = await response.json();
      if (results && results.length > 0) {
        const first = results[0];
        const lat = parseFloat(first.lat);
        const lng = parseFloat(first.lon);
        onPinDropped(lat, lng);
        audio.playSuccess();
      } else {
        // Fallback geocode inside current game play region
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * room.radiusMiles;
        const milesPerDegreeLat = 69.0;
        const milesPerDegreeLng = 69.0 * Math.cos((room.centerLat * Math.PI) / 180);
        const mockLat = room.centerLat + (dist * Math.sin(angle)) / milesPerDegreeLat;
        const mockLng = room.centerLng + (dist * Math.cos(angle)) / milesPerDegreeLng;
        onPinDropped(mockLat, mockLng);
        setGeocodingError('Address not found. Mocked location inside play zone.');
        audio.playSuccess();
      }
    } catch (err) {
      console.warn('Geocoding error, using fallback:', err);
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * room.radiusMiles;
      const milesPerDegreeLat = 69.0;
      const milesPerDegreeLng = 69.0 * Math.cos((room.centerLat * Math.PI) / 180);
      const mockLat = room.centerLat + (dist * Math.sin(angle)) / milesPerDegreeLat;
      const mockLng = room.centerLng + (dist * Math.cos(angle)) / milesPerDegreeLng;
      onPinDropped(mockLat, mockLng);
      setGeocodingError('Geocoding offline. Simulated custom pin in zone.');
      audio.playSuccess();
    } finally {
      setGeocodingLoading(false);
    }
  };

  // Handle previewing the question before committing
  const handlePreview = () => {
    audio.playClick();
    const seeker = room.players.find((p) => p.name === userName);
    const seekerLat = seeker?.lat || room.centerLat;
    const seekerLng = seeker?.lng || room.centerLng;

    let proposed: Omit<ActiveQuestion, 'id' | 'status'>;

    if (qType === 'MATCHING') {
      if (room.vetoedTypes.includes(`MATCHING:${matchingPoi}`)) {
        alert(`This MATCHING POI "${matchingPoi}" has been vetoed and is banned!`);
        return;
      }
      proposed = {
        type: 'MATCHING',
        title: `Is your nearest "${matchingPoi}" landmark the same as my nearest "${matchingPoi}"?`,
        rewardDesc: 'Draw 3, Pick 1',
        rewardDraw: 3,
        rewardPick: 1,
        poiType: matchingPoi,
      };
    } else if (qType === 'MEASURING') {
      if (!customPin) {
        alert('Please drop a Custom Target Pin on the map first.');
        return;
      }
      if (isPinVetoed(customPin.lat, customPin.lng, room.vetoedTypes)) {
        alert('This custom pin location (or one very close to it) has been vetoed and is banned!');
        return;
      }
      proposed = {
        type: 'MEASURING',
        title: `Compared to my location, are you closer to or further from the custom pin at [${customPin.lat.toFixed(4)}, ${customPin.lng.toFixed(4)}]?`,
        rewardDesc: 'Draw 3, Pick 1',
        rewardDraw: 3,
        rewardPick: 1,
        customPin,
      };
    } else if (qType === 'THERMOMETER') {
      if (!thermometerStartPin) {
        alert('You must start the thermometer path first.');
        return;
      }
      if (room.vetoedTypes.includes(`THERMOMETER:DIST:${thermometerDistance}`)) {
        alert(`This THERMOMETER distance of ${thermometerDistance} mi has been vetoed and is banned!`);
        return;
      }
      proposed = {
        type: 'THERMOMETER',
        title: `I have travelled ${thermometerDistance} mi from my starting pin. Am I hotter (closer to you) or colder (further from you)?`,
        rewardDesc: 'Draw 2, Pick 1',
        rewardDraw: 2,
        rewardPick: 1,
        startPin: thermometerStartPin,
        endPin: { lat: seekerLat, lng: seekerLng },
        distanceValue: thermometerDistance,
      };
    } else if (qType === 'RADAR') {
      if (room.vetoedTypes.includes(`RADAR:DIST:${radarDistance}`)) {
        alert(`This RADAR radius of ${radarDistance} mi has been vetoed and is banned!`);
        return;
      }
      proposed = {
        type: 'RADAR',
        title: `Are you within a ${radarDistance} mi radius of my current position?`,
        rewardDesc: 'Draw 2, Pick 1',
        rewardDraw: 2,
        rewardPick: 1,
        distanceValue: radarDistance,
      };
    } else if (qType === 'TENTACLES') {
      if (room.vetoedTypes.includes(`TENTACLES:POI:${tentaclePoi}`)) {
        alert(`This TENTACLES POI "${tentaclePoi}" has been vetoed and is banned!`);
        return;
      }
      proposed = {
        type: 'TENTACLES',
        title: `Of all "${tentaclePoi}" within a ${tentacleDistance} mi radius of me, which are you closest to?`,
        rewardDesc: 'Draw 4, Pick 2',
        rewardDraw: 4,
        rewardPick: 2,
        poiType: tentaclePoi,
        distanceValue: tentacleDistance,
      };
    } else {
      // PHOTO
      if (room.vetoedTypes.includes(`PHOTO:SUBJ:${photoSubject}`)) {
        alert(`This PHOTO subject "${photoSubject}" has been vetoed and is banned!`);
        return;
      }
      proposed = {
        type: 'PHOTO',
        title: `Upload a real-time native camera photograph of subject: "${photoSubject}"`,
        rewardDesc: 'Draw 1, Keep 1',
        rewardDraw: 1,
        rewardPick: 1,
        selectedSubject: photoSubject,
      };
    }

    setPreviewingQuestion(proposed);
  };

  const handleConfirmAsk = () => {
    if (!previewingQuestion) return;
    audio.playSuccess();
    onProposeQuestion(previewingQuestion);
    setPreviewingQuestion(null);
    clearCustomPin();
    setThermometerActive(false);
    setThermometerStartPin(null);
  };

  const handleStartThermometer = () => {
    const seeker = room.players.find((p) => p.name === userName);
    const seekerLat = seeker?.lat || room.centerLat;
    const seekerLng = seeker?.lng || room.centerLng;

    setThermometerStartPin({ lat: seekerLat, lng: seekerLng });
    setThermometerActive(true);
    audio.playSonar();
  };

  // --- RENDERS ---

  // Lockout 1: Active Curses red warning cover
  if (room.activeCurses.length > 0 && !isMobileFloating) {
    const currentCurse = room.activeCurses[0];

    return (
      <div className="bg-rose-950/90 backdrop-blur-md border border-rose-500/40 rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-2xl text-center space-y-4 md:space-y-6 max-w-xl mx-auto py-5 md:py-8 animate-pulse">
        <div className="p-4 bg-rose-500 text-slate-950 rounded-full w-fit mx-auto shadow-lg shadow-rose-950">
          <ShieldAlert className="w-10 h-10 animate-spin" />
        </div>

        <div className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-rose-400">CURSE OF THE HIDERS ACTIVE</span>
          <h2 className="text-2xl font-black text-slate-100 uppercase tracking-tight">{currentCurse.title}</h2>
          <p className="text-xs text-rose-200 opacity-90 max-w-sm mx-auto">
            Your field interface has been jammed by Hider powerups. All questions are locked until this curse is fulfilled.
          </p>
        </div>

        <div className="bg-slate-950/90 border border-rose-900/50 p-5 rounded-2xl text-left space-y-3">
          <div>
            <span className="text-[9px] font-bold text-rose-400 uppercase tracking-wider block">Seeker Penalty Constraints:</span>
            <p className="text-xs text-slate-200 leading-relaxed font-semibold mt-0.5">{currentCurse.seekerEffect}</p>
          </div>
          <div className="border-t border-rose-950 pt-2.5">
            <span className="text-[9px] font-bold text-rose-400 uppercase tracking-wider block">Real-life Dismissal Task:</span>
            <p className="text-xs text-slate-200 leading-relaxed font-semibold mt-0.5">{currentCurse.dismissalDesc}</p>
          </div>
        </div>

        <div className="space-y-3">
          {currentCurse.pendingConfirmation ? (
            <div className="w-full py-3 bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black text-xs rounded-xl flex items-center justify-center space-x-2">
              <span className="animate-pulse">⌛ Claim Submitted! Waiting for Hider Verification...</span>
            </div>
          ) : (
            <button
              onClick={() => {
                setConfirmingCurseId(currentCurse.id);
                audio.playClick();
              }}
              className="w-full py-3 bg-rose-500 hover:bg-rose-400 text-slate-950 font-black text-xs rounded-xl shadow cursor-pointer transition-transform active:scale-95"
            >
              {"Did you fulfill your curse yet? -> YES"}
            </button>
          )}
        </div>

        {confirmingCurseId && (
          <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-4 z-[2100]">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-2xl max-w-sm w-[calc(100%-1rem)] md:w-full space-y-3.5 md:space-y-4 text-center">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto animate-bounce" />
              <h3 className="text-sm font-black text-slate-100">Fulfill Confirmation</h3>
              <p className="text-xs text-slate-300 leading-normal">
                Just confirmed you did fully accomplish the curse parameters in the real world? This sends a request to the Hiders for verification.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => {
                    onDismissCurseRequest(confirmingCurseId);
                    setConfirmingCurseId(null);
                    audio.playSuccess();
                  }}
                  className="py-2.5 bg-rose-500 text-slate-950 text-xs font-black rounded-xl cursor-pointer"
                >
                  Yes, Send Claim
                </button>
                <button
                  onClick={() => { setConfirmingCurseId(null); audio.playClick(); }}
                  className="py-2.5 bg-slate-800 text-slate-300 text-xs font-black rounded-xl border border-slate-700 cursor-pointer"
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

  // Active Question confirmation overlay
  if (room.activeQuestion && !isMobileFloating) {
    const isPhotoAnswer = room.activeQuestion.status === 'ANSWERED' && room.activeQuestion.photoUrl;

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-2xl max-w-xl mx-auto py-5 md:py-6 space-y-3 md:space-y-4 text-center">
        <div className="p-3 bg-cyan-500/10 rounded-2xl text-cyan-400 w-fit mx-auto">
          <Radio className="w-6 h-6 animate-pulse" />
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400">Question Pending Resolution</span>
          <h3 className="text-base font-black text-slate-100 mt-1">{room.activeQuestion.title}</h3>
        </div>

        {room.activeQuestion.status === 'PENDING' ? (
          <div className="p-4 bg-slate-950 border border-slate-850 rounded-2xl">
            <p className="text-xs text-slate-400 animate-pulse">
              🎮 Waiting for the Hider to review, answer, or veto the question...
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Pop up showing photo upload answer with Download Button */}
            {isPhotoAnswer && (
              <div className="space-y-3 bg-slate-950/80 p-4 rounded-2xl border border-slate-850">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block">📸 Hider Photograph Subject:</span>
                <div className="border border-slate-850 rounded-xl overflow-hidden max-h-64 shadow-inner">
                  <img src={room.activeQuestion.photoUrl} alt="Hider upload" className="w-full h-full object-cover" />
                </div>
                <a
                  href={room.activeQuestion.photoUrl}
                  download={`jetlag_photo_${room.activeQuestion.selectedSubject?.replace(/\s+/g, '_')}.png`}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow inline-flex items-center justify-center space-x-1.5 transition-transform hover:scale-[1.01]"
                >
                  <Image className="w-4 h-4" />
                  <span>Save Photo (HIGHLY RECOMMENDED)</span>
                </a>
              </div>
            )}

            {room.activeQuestion.mathResult && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl text-left space-y-2">
                <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wider">Geospatial Result Outcome</h4>
                <p className="text-xs text-slate-300 leading-normal">{room.activeQuestion.mathResult.description}</p>
                <div className="border-t border-emerald-950/50 pt-2 flex justify-between items-center text-xs">
                  <span className="text-slate-400">Search cells eliminated:</span>
                  <span className="text-emerald-400 font-bold text-sm">-{room.activeQuestion.mathResult.eliminatedCount} cells</span>
                </div>
              </div>
            )}

            {room.activeQuestion.status === 'VETOED' && (
              <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl text-left space-y-1">
                <h4 className="text-xs font-black text-rose-400 uppercase tracking-wider">Question Vetoed</h4>
                <p className="text-xs text-slate-300 leading-normal">
                  Hiders spent their Veto Powerup card to block this question. Proximity questions of this type are now banned for the rest of this round.
                </p>
              </div>
            )}

            <button
              onClick={() => {
                onClearQuestion();
                audio.playClick();
              }}
              className="mt-4 w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 text-xs font-black rounded-xl transition-all shadow cursor-pointer uppercase tracking-wider"
            >
              Close & Ask New Question
            </button>
          </div>
        )}
      </div>
    );
  }

  // Previewing question configuration
  if (previewingQuestion && !isMobileFloating) {
    return (
      <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-2xl text-center space-y-4 md:space-y-5 max-w-xl mx-auto py-5 md:py-6">
        <div className="p-3 bg-cyan-500/10 rounded-2xl text-cyan-400 w-fit mx-auto">
          <Compass className="w-6 h-6 animate-spin" />
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400">Confirm Proximity Query</span>
          <h3 className="text-sm font-black text-slate-100 mt-1">{previewingQuestion.title}</h3>
        </div>

        <div className="bg-slate-950 p-4 rounded-2xl text-left space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">Reward Drawn for Hider:</span>
            <span className="text-amber-400 font-bold">{previewingQuestion.rewardDesc}</span>
          </div>
          <div className="flex justify-between border-t border-slate-900 pt-2">
            <span className="text-slate-400">Geospatial Type:</span>
            <span className="text-slate-200 font-medium">{previewingQuestion.type}</span>
          </div>
        </div>

        <p className="text-[10px] text-slate-400">
          Proposing this question will trigger an instant prompt on the Hiders' screen.
        </p>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={handleConfirmAsk}
            className="py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black rounded-xl transition-all shadow cursor-pointer"
          >
            Ask Question?
          </button>
          <button
            onClick={() => { setPreviewingQuestion(null); audio.playClick(); }}
            className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black rounded-xl border border-slate-700 cursor-pointer"
          >
            Back / Cancel
          </button>
        </div>
      </div>
    );
  }

  if (room.gamePhase === 'HIDING') {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-xl md:shadow-2xl max-w-xl mx-auto py-5 md:py-8 space-y-4 md:space-y-5 text-center">
        <div className="p-2.5 md:p-4 bg-amber-500/10 rounded-xl md:rounded-2xl text-amber-400 w-fit mx-auto animate-pulse">
          <ShieldAlert className="w-6 h-6 md:w-8 md:h-8" />
        </div>

        <div className="space-y-1.5 md:space-y-2">
          <span className="text-[9px] md:text-[10px] uppercase font-bold tracking-widest text-amber-400 font-mono">Hider Setup In Progress</span>
          <h3 className="text-sm md:text-base font-black text-slate-100">Waiting for Hider to Drop Pin</h3>
          <p className="text-[11px] md:text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            The hider team is currently selecting their starting coordinates and transit station pin. Proximity questions and tracking status will unlock once the hider is ready.
          </p>
        </div>

        <div className="bg-slate-950/80 border border-slate-850 p-3 md:p-4 rounded-xl md:rounded-2xl max-w-xs mx-auto">
          <span className="text-[8px] md:text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Current Hider Team:</span>
          <span className="text-xs md:text-sm font-black text-slate-200 mt-1 block font-sans">
            🏆 {room.teams[room.hiderTeamIndex]?.name || 'Unknown'}
          </span>
        </div>
      </div>
    );
  }

  // Normal Seeker Menu Setup (Vetoes are now option-specific)
  const isVetoedMatching = false;
  const isVetoedMeasuring = false;
  const isVetoedThermometer = false;
  const isVetoedRadar = false;
  const isVetoedTentacles = false;
  const isVetoedPhoto = false;

  if (isMobileFloating) {
    const hasCurse = room.activeCurses.length > 0;
    const hasActiveQuestion = !!room.activeQuestion;

    const floatingItems = [
      { type: 'MATCHING', label: 'Matching (POI)', icon: Layers, vetoed: isVetoedMatching },
      { type: 'MEASURING', label: 'Measuring (Pin)', icon: MapPin, vetoed: isVetoedMeasuring },
      { type: 'THERMOMETER', label: 'Thermometer', icon: Flame, vetoed: isVetoedThermometer },
      { type: 'RADAR', label: 'Radar (Circle)', icon: Radio, vetoed: isVetoedRadar },
      { type: 'TENTACLES', label: 'Tentacles (Circle)', icon: Compass, vetoed: isVetoedTentacles },
      { type: 'PHOTO', label: 'Photo Verification', icon: Camera, vetoed: isVetoedPhoto },
      { type: 'STATUS', label: 'Status & Apprehend', icon: Shield, vetoed: false, isSpecial: true },
    ];

    return (
      <div className="relative w-full h-full pointer-events-none select-none">
        {/* Left Side: 7 Vertical Icons */}
        {!hasCurse && !hasActiveQuestion && (
          <div className="absolute left-3 top-20 flex flex-col space-y-2 pointer-events-auto z-[1010]">
            {floatingItems.map((item) => {
              const isActive = item.isSpecial 
                ? (mobileActiveTab === 'STATUS' && qType === null)
                : (qType === item.type && mobileActiveTab === 'ASK');
              const IconComponent = item.icon;
              return (
                <button
                  key={item.type}
                  onClick={() => {
                    audio.playClick();
                    if (item.isSpecial) {
                      if (mobileActiveTab === 'STATUS' && qType === null) {
                        setMobileActiveTab('ASK');
                      } else {
                        setMobileActiveTab('STATUS');
                        setQType(null);
                      }
                    } else {
                      if (qType === item.type && mobileActiveTab === 'ASK') {
                        setQType(null);
                      } else {
                        setQType(item.type as any);
                        setMobileActiveTab('ASK');
                      }
                    }
                  }}
                  disabled={item.vetoed}
                  className={`w-11 h-11 rounded-full border flex items-center justify-center transition-all relative shadow-lg ${
                    item.vetoed
                      ? 'bg-rose-950/40 border-rose-900/40 text-rose-500/40 cursor-not-allowed'
                      : isActive
                      ? item.isSpecial
                        ? 'bg-amber-500 border-amber-400 text-slate-950 scale-105 shadow-amber-500/20'
                        : 'bg-cyan-500 border-cyan-400 text-slate-950 scale-105 shadow-cyan-500/20'
                      : item.isSpecial
                      ? 'bg-slate-950/90 hover:bg-slate-900 border-amber-500/30 text-amber-400/80'
                      : 'bg-slate-950/90 hover:bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                  title={item.label}
                >
                  <IconComponent className="w-5 h-5 stroke-[2.5]" />
                  {item.vetoed && (
                    <span className="absolute -top-1 -right-1 text-[7px] bg-rose-500 text-slate-950 font-black px-1 rounded uppercase scale-75">
                      Banned
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* BOTTOM FLOATING PARAMETER / FORM OVERLAY */}
        {!hasCurse && !hasActiveQuestion && ((qType !== null && mobileActiveTab === 'ASK') || (mobileActiveTab === 'STATUS' && qType === null)) && !previewingQuestion && (
          <div className="absolute bottom-6 left-3 right-3 max-w-sm mx-auto bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-2xl flex flex-col space-y-3 pointer-events-auto z-[1020] text-left animate-in fade-in slide-in-from-bottom-4 duration-200">
            {/* Header */}
            <div className="flex justify-between items-center pb-2 border-b border-slate-900 shrink-0">
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-cyan-400">
                  {mobileActiveTab === 'STATUS' ? 'LIVE TRACKING STATUS' : 'QUERY CONFIGURATION'}
                </span>
                <h4 className="text-xs font-black text-slate-200 uppercase mt-0.5 font-sans">
                  {mobileActiveTab === 'STATUS' 
                    ? 'Status & Apprehend'
                    : qType === 'MATCHING' ? 'Matching (POI)'
                    : qType === 'MEASURING' ? 'Measuring (Pin)'
                    : qType === 'THERMOMETER' ? 'Thermometer Path'
                    : qType === 'RADAR' ? 'Radar Search'
                    : qType === 'TENTACLES' ? 'Tentacles Nearest'
                    : 'Photo Verification'
                  }
                </h4>
              </div>
              <button
                onClick={() => {
                  audio.playClick();
                  setQType(null);
                  setMobileActiveTab('ASK');
                }}
                className="p-1.5 bg-slate-950 border border-slate-850 rounded-lg hover:text-white text-slate-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Form Content body */}
            <div className="max-h-60 overflow-y-auto pr-1 space-y-3">
              {/* MATCHING FORM */}
              {qType === 'MATCHING' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Select POI Type</label>
                    <select
                      value={matchingPoi}
                      onChange={(e) => {
                        setMatchingPoi(e.target.value);
                        audio.playClick();
                      }}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                    >
                      {MATCHING_POIS.map((p) => {
                        const isVetoed = room.vetoedTypes.includes(`MATCHING:${p}`);
                        return (
                          <option key={p} value={p} disabled={isVetoed}>
                            {p} {isVetoed ? '(BANNED)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <p className="text-[9px] text-slate-400 leading-normal">
                    <b>Math:</b> Compares closest POIs of same type. Draws Voronoi dividing line.
                  </p>
                </div>
              )}

              {/* MEASURING FORM */}
              {qType === 'MEASURING' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Search/Geocode Address</label>
                    <div className="flex items-center space-x-1.5">
                      <input
                        type="text"
                        placeholder="Search address..."
                        value={addressInput}
                        onChange={(e) => {
                          setAddressInput(e.target.value);
                          setShowSuggestions(true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleGeocodeAddress();
                            setShowSuggestions(false);
                          }
                        }}
                        className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          handleGeocodeAddress();
                          setShowSuggestions(false);
                        }}
                        disabled={geocodingLoading || !addressInput.trim()}
                        className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 rounded-xl text-xs font-black transition-colors shrink-0"
                      >
                        {geocodingLoading ? '...' : 'Search'}
                      </button>
                    </div>

                    {showSuggestions && addressSuggestions.length > 0 && (
                      <div className="relative mt-1 bg-slate-950 border border-slate-850 rounded-xl shadow-2xl overflow-hidden max-h-32 overflow-y-auto z-[1050]">
                        {addressSuggestions.map((s, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              setAddressInput(s.display_name);
                              const lat = parseFloat(s.lat);
                              const lng = parseFloat(s.lon);
                              onPinDropped(lat, lng);
                              setGeocodingError(null);
                              setAddressSuggestions([]);
                              setShowSuggestions(false);
                              audio.playSuccess();
                            }}
                            className="w-full text-left px-3 py-2 text-[10px] text-slate-300 hover:bg-slate-900 border-b border-slate-900 last:border-0 truncate block"
                          >
                            {s.display_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-950/60 border border-slate-900 p-2.5 rounded-xl space-y-2">
                    {customPin ? (
                      <div className="flex justify-between items-center text-[10px]">
                        <div>
                          <span className="font-bold uppercase tracking-wider block text-[8px] text-cyan-400">Target Pin Registered</span>
                          <span className="font-mono mt-0.5 block text-[9px] text-slate-300">Lat: {customPin.lat.toFixed(4)} • Lng: {customPin.lng.toFixed(4)}</span>
                        </div>
                        <button onClick={clearCustomPin} className="text-red-400 hover:text-red-200 text-[10px] font-bold">Clear</button>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-500 italic">Enter search query or tap below to set custom pin on map.</p>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        enablePinSelection('CUSTOM_PIN');
                        audio.playClick();
                      }}
                      className="w-full py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-cyan-400 hover:text-cyan-300 rounded-xl text-[10px] font-black transition-all flex items-center justify-center space-x-1 shadow-md"
                    >
                      <MapPin className="w-3 h-3 text-cyan-400 animate-pulse" />
                      <span>Drop Custom Pin on Map</span>
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-400 leading-normal">
                    <b>Math:</b> Bisects distances. Yes = closer to pin. No = further.
                  </p>
                </div>
              )}

              {/* THERMOMETER FORM */}
              {qType === 'THERMOMETER' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Target Distance</label>
                    <select
                      value={thermometerDistance}
                      onChange={(e) => {
                        setThermometerDistance(parseFloat(e.target.value));
                        audio.playClick();
                      }}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-2.5 py-1.5 text-xs text-slate-200"
                    >
                      <option value={0.5} disabled={room.vetoedTypes.includes('THERMOMETER:DIST:0.5')}>
                        0.5 miles (805m) {room.vetoedTypes.includes('THERMOMETER:DIST:0.5') ? '(BANNED)' : ''}
                      </option>
                      <option value={3.0} disabled={room.vetoedTypes.includes('THERMOMETER:DIST:3')}>
                        3.0 miles (4.8km) {room.vetoedTypes.includes('THERMOMETER:DIST:3') ? '(BANNED)' : ''}
                      </option>
                      {room.gameSize !== 'S' && (
                        <option value={10.0} disabled={room.vetoedTypes.includes('THERMOMETER:DIST:10')}>
                          10.0 miles (16km) {room.vetoedTypes.includes('THERMOMETER:DIST:10') ? '(BANNED)' : ''}
                        </option>
                      )}
                      {room.gameSize === 'L' && (
                        <option value={50.0} disabled={room.vetoedTypes.includes('THERMOMETER:DIST:50')}>
                          50.0 miles (80km) {room.vetoedTypes.includes('THERMOMETER:DIST:50') ? '(BANNED)' : ''}
                        </option>
                      )}
                    </select>
                  </div>

                  {!thermometerActive ? (
                    <button
                      onClick={handleStartThermometer}
                      className="w-full py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl shadow"
                    >
                      🔥 Start Tracking Distance
                    </button>
                  ) : (
                    <div className="bg-slate-950/80 border border-slate-850 p-3 rounded-xl space-y-1.5 text-center">
                      <span className="text-[8px] font-bold text-orange-400 uppercase tracking-widest animate-pulse block">Tracking Active</span>
                      <p className="text-[9px] text-slate-300 leading-normal">
                        Walk <b>{thermometerDistance} mi</b>. Path is visually drawn on map.
                      </p>
                      <button
                        onClick={() => setThermometerActive(false)}
                        className="text-[9px] text-red-400 border border-red-500/20 px-2.5 py-0.5 rounded-lg"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                  <p className="text-[9px] text-slate-400 leading-normal">
                    <b>Math:</b> Yes = Hotter (closer to you). No = Colder.
                  </p>
                </div>
              )}

              {/* RADAR FORM */}
              {qType === 'RADAR' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Search Circle Radius (Miles)</label>
                    <select
                      value={radarDistance}
                      onChange={(e) => {
                        setRadarDistance(parseFloat(e.target.value));
                        audio.playClick();
                      }}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-2.5 py-1.5 text-xs text-slate-200"
                    >
                      <option value={0.25} disabled={room.vetoedTypes.includes('RADAR:DIST:0.25')}>0.25 miles (400m)</option>
                      <option value={0.50} disabled={room.vetoedTypes.includes('RADAR:DIST:0.5')}>0.50 miles (800m)</option>
                      <option value={1.00} disabled={room.vetoedTypes.includes('RADAR:DIST:1')}>1.00 mile (1.6km)</option>
                      <option value={3.00} disabled={room.vetoedTypes.includes('RADAR:DIST:3')}>3.00 miles (4.8km)</option>
                      <option value={5.00} disabled={room.vetoedTypes.includes('RADAR:DIST:5')}>5.00 miles (8.0km)</option>
                      <option value={10.00} disabled={room.vetoedTypes.includes('RADAR:DIST:10')}>10.00 miles (16km)</option>
                      <option value={25.00} disabled={room.vetoedTypes.includes('RADAR:DIST:25')}>25.00 miles (40km)</option>
                      <option value={50.00} disabled={room.vetoedTypes.includes('RADAR:DIST:50')}>50.00 miles (80km)</option>
                    </select>
                  </div>
                  <p className="text-[9px] text-slate-400 leading-normal">
                    <b>Math:</b> Yes = restricts inside radius. No = subtracts radius circle.
                  </p>
                </div>
              )}

              {/* TENTACLES FORM */}
              {qType === 'TENTACLES' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">POI Type</label>
                      <select
                        value={tentaclePoi}
                        onChange={(e) => {
                          setTentaclePoi(e.target.value);
                          audio.playClick();
                        }}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-2 py-1.5 text-xs text-slate-200"
                      >
                        <option value="Museums" disabled={room.vetoedTypes.includes('TENTACLES:POI:Museums')}>Museums (1mi)</option>
                        <option value="Libraries" disabled={room.vetoedTypes.includes('TENTACLES:POI:Libraries')}>Libraries (1mi)</option>
                        <option value="Movie Theatres" disabled={room.vetoedTypes.includes('TENTACLES:POI:Movie Theatres')}>Movie Theatres (1mi)</option>
                        <option value="Hospitals" disabled={room.vetoedTypes.includes('TENTACLES:POI:Hospitals')}>Hospitals (1mi)</option>
                        {room.gameSize === 'L' && (
                          <>
                            <option value="Metro Lines" disabled={room.vetoedTypes.includes('TENTACLES:POI:Metro Lines')}>Metro Lines (15mi)</option>
                            <option value="Zoos" disabled={room.vetoedTypes.includes('TENTACLES:POI:Zoos')}>Zoos (15mi)</option>
                            <option value="Aquariums" disabled={room.vetoedTypes.includes('TENTACLES:POI:Aquariums')}>Aquariums (15mi)</option>
                            <option value="Amusement Parks" disabled={room.vetoedTypes.includes('TENTACLES:POI:Amusement Parks')}>Amusement Parks (15mi)</option>
                          </>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Radius</label>
                      <select
                        value={tentacleDistance}
                        onChange={(e) => {
                          setTentacleDistance(parseFloat(e.target.value));
                          audio.playClick();
                        }}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-2 py-1.5 text-xs text-slate-200"
                      >
                        <option value={1.0}>1.0 mile</option>
                        {room.gameSize === 'L' && <option value={15.0}>15.0 miles</option>}
                      </select>
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-400 leading-normal">
                    <b>Math:</b> Inside = isolates nearest POI Voronoi cell. Outside = eliminates circle.
                  </p>
                </div>
              )}

              {/* PHOTO FORM */}
              {qType === 'PHOTO' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Photo Subject</label>
                    <select
                      value={photoSubject}
                      onChange={(e) => {
                        setPhotoSubject(e.target.value);
                        audio.playClick();
                      }}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-2.5 py-1.5 text-xs text-slate-200"
                    >
                      {(PHOTO_SUBJECTS[room.gameSize] || PHOTO_SUBJECTS.M).map((subj) => {
                        const isVetoed = room.vetoedTypes.includes(`PHOTO:SUBJ:${subj}`);
                        return (
                          <option key={subj} value={subj} disabled={isVetoed}>
                            {subj} {isVetoed ? '(BANNED)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <p className="text-[9px] text-slate-400 leading-normal">
                    <b>Task:</b> Hiders must upload a direct, unedited native camera photo of this subject.
                  </p>
                </div>
              )}

              {/* STATUS & APPREHEND VIEW */}
              {mobileActiveTab === 'STATUS' && qType === null && (
                <div className="space-y-3 pt-1 text-center">
                  <div className="bg-slate-950 border border-slate-900 rounded-xl p-3 text-left space-y-2">
                    <h5 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Remaining Play Zone</h5>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Active Search Cells</span>
                        <span className="text-slate-200 font-extrabold text-xs">{room.grid.filter((c) => c.active).length} / {room.grid.length}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Active Curses</span>
                        <span className="text-rose-400 font-extrabold text-xs">{room.activeCurses.length} Active</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#120509]/40 border border-rose-950/40 rounded-xl p-3 text-center space-y-2">
                    <h5 className="text-[9px] font-black text-slate-300 uppercase tracking-wider">Apprehend Confirmation</h5>
                    <p className="text-[9px] text-slate-400 leading-normal max-w-xs mx-auto">
                      Physical spotted and tagged the Hiders in real life? Hold to confirm target capture.
                    </p>

                    <div className="relative max-w-xs mx-auto">
                      <button
                        onMouseDown={() => { setCatchPressed(true); audio.playClick(); }}
                        onMouseUp={() => setCatchPressed(false)}
                        onMouseLeave={() => setCatchPressed(false)}
                        onTouchStart={() => { setCatchPressed(true); audio.playClick(); }}
                        onTouchEnd={() => setCatchPressed(false)}
                        className={`w-full py-2 rounded-xl font-black text-[11px] tracking-wider text-slate-950 uppercase select-none transition-all cursor-pointer relative overflow-hidden active:scale-95 ${
                          catchPressed ? 'bg-rose-500 text-slate-950' : 'bg-gradient-to-r from-rose-500 to-pink-500'
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
                      <span className="block text-[8px] text-rose-400 animate-pulse font-mono mt-1">
                        Syncing... {catchProgress}%
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Preview on Map CTA button inside question form */}
            {mobileActiveTab === 'ASK' && qType !== null && (
              <button
                onClick={handlePreview}
                className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl font-black text-[11px] tracking-wider uppercase transition-transform active:scale-[0.99] cursor-pointer shrink-0 mt-2"
              >
                🔍 Preview Query on Map
              </button>
            )}
          </div>
        )}

        {/* BOTTOM FLOATING CONFIRM ASKING OVERLAY */}
        {!hasCurse && !hasActiveQuestion && previewingQuestion && (
          <div className="absolute bottom-6 left-3 right-3 max-w-sm mx-auto bg-slate-950/85 backdrop-blur-md border border-cyan-500 rounded-2xl p-4 shadow-2xl flex flex-col space-y-3 pointer-events-auto z-[1030] text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="p-2 bg-cyan-500/10 rounded-full text-cyan-400 w-fit mx-auto shrink-0 animate-bounce">
              <Compass className="w-5 h-5" />
            </div>

            <div>
              <span className="text-[8px] uppercase font-bold tracking-widest text-cyan-400 block font-sans">Confirm Proximity Query</span>
              <h3 className="text-xs font-black text-slate-100 mt-1 leading-normal font-sans">{previewingQuestion.title}</h3>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl text-left space-y-1.5 text-[10px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Hider Reward:</span>
                <span className="text-amber-400 font-bold">{previewingQuestion.rewardDesc}</span>
              </div>
              <div className="flex justify-between border-t border-slate-900 pt-1.5">
                <span className="text-slate-400">Geospatial Type:</span>
                <span className="text-slate-200 font-semibold">{previewingQuestion.type}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1.5 shrink-0">
              <button
                onClick={handleConfirmAsk}
                className="py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black rounded-xl transition-all shadow cursor-pointer uppercase font-sans"
              >
                Ask Question
              </button>
              <button
                onClick={() => { setPreviewingQuestion(null); audio.playClick(); }}
                className="py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-black rounded-xl border border-slate-700 cursor-pointer uppercase font-sans"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ACTIVE QUESTION OVERLAY FOR MOBILE */}
        {!hasCurse && hasActiveQuestion && (
          <div className="absolute bottom-6 left-3 right-3 max-w-sm mx-auto bg-slate-950/85 backdrop-blur-md border border-cyan-500/40 rounded-2xl p-4 shadow-2xl flex flex-col space-y-3 pointer-events-auto z-[1040] text-left animate-in fade-in slide-in-from-bottom-4 duration-200 font-sans">
            <div className="flex justify-between items-center pb-2 border-b border-slate-900 shrink-0">
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-cyan-400">PENDING RESOLUTION</span>
                <h4 className="text-xs font-black text-slate-100 uppercase mt-0.5 leading-normal">{room.activeQuestion.title}</h4>
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto pr-1 space-y-2.5 text-[10px]">
              {room.activeQuestion.status === 'PENDING' ? (
                <div className="py-3 bg-slate-900/50 border border-slate-900/80 rounded-xl text-center">
                  <p className="text-[10px] text-slate-400 animate-pulse font-medium">
                    Waiting for Hider to review/answer/veto...
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {/* Photo answer view */}
                  {room.activeQuestion.status === 'ANSWERED' && room.activeQuestion.photoUrl && (
                    <div className="space-y-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-900">
                      <span className="text-[8px] font-bold text-amber-400 uppercase tracking-widest block font-sans">📸 Hider Photograph:</span>
                      <div className="border border-slate-900 rounded-lg overflow-hidden max-h-40 shadow-inner">
                        <img src={room.activeQuestion.photoUrl} alt="Hider upload" className="w-full h-full object-cover" />
                      </div>
                      <a
                        href={room.activeQuestion.photoUrl}
                        download={`jetlag_photo_${room.activeQuestion.selectedSubject?.replace(/\s+/g, '_')}.png`}
                        className="w-full py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-black rounded-lg shadow inline-flex items-center justify-center space-x-1 transition-transform"
                      >
                        <Image className="w-3.5 h-3.5" />
                        <span>Save Photo</span>
                      </a>
                    </div>
                  )}

                  {room.activeQuestion.mathResult && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl text-left space-y-1">
                      <h4 className="text-[9px] font-black text-emerald-400 uppercase tracking-wider">Geospatial Result</h4>
                      <p className="text-[10px] text-slate-300 leading-normal">{room.activeQuestion.mathResult.description}</p>
                      <div className="border-t border-emerald-950/50 pt-1 flex justify-between items-center text-[9px]">
                        <span className="text-slate-400 font-sans">Search cells eliminated:</span>
                        <span className="text-emerald-400 font-bold">-{room.activeQuestion.mathResult.eliminatedCount} cells</span>
                      </div>
                    </div>
                  )}

                  {room.activeQuestion.status === 'VETOED' && (
                    <div className="bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl text-left space-y-1">
                      <h4 className="text-[9px] font-black text-rose-400 uppercase tracking-wider font-sans">Question Vetoed</h4>
                      <p className="text-[10px] text-slate-300 leading-normal font-sans">
                        Hiders used their Veto Powerup card. Questions of this type are now banned.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* CTA action button */}
            {room.activeQuestion.status !== 'PENDING' && (
              <button
                onClick={() => {
                  onClearQuestion();
                  audio.playClick();
                }}
                className="w-full py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black rounded-xl shadow cursor-pointer uppercase tracking-wider font-sans"
              >
                Close & Ask New Question
              </button>
            )}
          </div>
        )}

        {/* ACTIVE CURSES OVERLAY FOR MOBILE */}
        {hasCurse && (
          <div className="absolute bottom-6 left-3 right-3 max-w-sm mx-auto bg-rose-955/85 backdrop-blur-md border border-rose-500/40 rounded-2xl p-4 shadow-2xl flex flex-col space-y-3 pointer-events-auto z-[1040] text-left animate-in fade-in slide-in-from-bottom-4 duration-200 font-sans">
            <div className="flex justify-between items-center pb-2 border-b border-rose-950/40 shrink-0">
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-rose-400">CURSE OF THE HIDERS ACTIVE</span>
                <h4 className="text-xs font-black text-slate-100 uppercase mt-0.5 leading-normal">{room.activeCurses[0].title}</h4>
              </div>
            </div>

            <div className="space-y-2 text-[10px]">
              <div>
                <span className="text-rose-400 font-bold uppercase text-[8px] tracking-wide block">Seeker Penalty:</span>
                <p className="text-slate-200 font-medium leading-normal">{room.activeCurses[0].seekerEffect}</p>
              </div>
              <div className="border-t border-rose-950 pt-2">
                <span className="text-rose-400 font-bold uppercase text-[8px] tracking-wide block">Real-life Dismissal Task:</span>
                <p className="text-slate-200 font-medium leading-normal">{room.activeCurses[0].dismissalDesc}</p>
              </div>
            </div>

            <div className="pt-1">
              {room.activeCurses[0].pendingConfirmation ? (
                <div className="w-full py-2 bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold text-[10px] rounded-xl flex items-center justify-center space-x-1">
                  <span className="animate-pulse">⌛ Claim Submitted! Waiting for Hiders...</span>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setConfirmingCurseId(room.activeCurses[0].id);
                    audio.playClick();
                  }}
                  className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-slate-950 font-black text-[11px] rounded-xl shadow cursor-pointer uppercase transition-all font-sans"
                >
                  Did you fulfill curse yet?
                </button>
              )}
            </div>

            {confirmingCurseId && (
              <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[2100]">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl max-w-xs w-full space-y-3 text-center">
                  <AlertCircle className="w-7 h-7 text-amber-400 mx-auto animate-bounce" />
                  <h3 className="text-xs font-black text-slate-100 font-sans">Fulfill Confirmation</h3>
                  <p className="text-[10px] text-slate-300 leading-normal font-sans">
                    Fulfill the curse parameters in the real world? This sends a request to the Hiders.
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => {
                        onDismissCurseRequest(confirmingCurseId);
                        setConfirmingCurseId(null);
                        audio.playSuccess();
                      }}
                      className="py-1.5 bg-rose-500 text-slate-950 text-xs font-black rounded-xl cursor-pointer uppercase font-sans"
                    >
                      Yes, Send
                    </button>
                    <button
                      onClick={() => { setConfirmingCurseId(null); audio.playClick(); }}
                      className="py-1.5 bg-slate-800 text-slate-300 text-xs font-black rounded-xl border border-slate-700 cursor-pointer uppercase font-sans"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-xl mx-auto py-1">
      {/* Tab select */}
      <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-850">
        <button
          onClick={() => { setActiveTab('ASK'); audio.playClick(); }}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-1.5 ${
            activeTab === 'ASK' ? 'bg-slate-900 text-cyan-300 shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Proximity Query</span>
        </button>
        <button
          onClick={() => { setActiveTab('STATUS'); audio.playClick(); }}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-1.5 ${
            activeTab === 'STATUS' ? 'bg-slate-900 text-cyan-300 shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Tracking Status</span>
        </button>
      </div>

      {activeTab === 'ASK' && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Select Query Type</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { type: 'MATCHING', label: '1. Matching (POI)', vetoed: isVetoedMatching },
                { type: 'MEASURING', label: '2. Measuring (Pin)', vetoed: isVetoedMeasuring },
                { type: 'THERMOMETER', label: '3. Thermometer', vetoed: isVetoedThermometer },
                { type: 'RADAR', label: '4. Radar (Circle)', vetoed: isVetoedRadar },
                { type: 'TENTACLES', label: '5. Tentacles (Circle)', vetoed: isVetoedTentacles },
                { type: 'PHOTO', label: '6. Photo', vetoed: isVetoedPhoto },
              ].map((item) => (
                <button
                  key={item.type}
                  onClick={() => {
                    if (qType === item.type) {
                      setQType(null);
                    } else {
                      setQType(item.type as any);
                    }
                    audio.playClick();
                  }}
                  disabled={item.vetoed}
                  className={`p-3 rounded-xl border text-left text-xs transition-all relative ${
                    item.vetoed
                      ? 'bg-rose-500/5 border-rose-500/20 text-rose-400/50 cursor-not-allowed'
                      : qType === item.type
                      ? 'bg-cyan-500/5 border-cyan-500 text-cyan-300 font-bold'
                      : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-850 hover:text-slate-200'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.vetoed && (
                    <span className="absolute top-1 right-1 text-[8px] bg-rose-500 text-slate-950 font-black px-1 rounded uppercase">
                      Banned
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-850 pt-4 space-y-4">
            {qType === null ? (
              <div className="text-center py-8 px-5 bg-slate-950/40 border border-slate-850/60 rounded-3xl space-y-2">
                <Compass className="w-10 h-10 text-slate-700 mx-auto mb-2 animate-pulse" />
                <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">No Query Type Selected</h4>
                <p className="text-[10px] text-slate-500 max-w-[240px] mx-auto leading-relaxed">
                  Select a proximity query type above to configure parameters, preview the live coverage on the map, and plan your next cut.
                </p>
              </div>
            ) : (
              <>
                {/* MATCHING FORM */}
                {qType === 'MATCHING' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Select POI Type</label>
                      <select
                        value={matchingPoi}
                        onChange={(e) => {
                          setMatchingPoi(e.target.value);
                          audio.playClick();
                        }}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                      >
                        {MATCHING_POIS.map((p) => {
                          const isVetoed = room.vetoedTypes.includes(`MATCHING:${p}`);
                          return (
                            <option key={p} value={p} disabled={isVetoed}>
                              {p} {isVetoed ? '(BANNED)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      <b>Math:</b> Calculates if Seeker and Hider closest "{matchingPoi}" are the same cell. Slices grid in/out.
                    </p>
                  </div>
                )}

                {/* MEASURING FORM */}
                {qType === 'MEASURING' && (
                  <div className="space-y-3 text-left">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">Target Address or Location</span>
                    <div className="relative">
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={addressInput}
                          onChange={(e) => {
                            setAddressInput(e.target.value);
                            setShowSuggestions(true);
                          }}
                          onFocus={() => setShowSuggestions(true)}
                          placeholder="Type address or POI name (e.g. Park)..."
                          className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleGeocodeAddress();
                              setShowSuggestions(false);
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            handleGeocodeAddress();
                            setShowSuggestions(false);
                          }}
                          disabled={geocodingLoading || !addressInput.trim()}
                          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 rounded-xl text-xs font-black transition-colors"
                        >
                          {geocodingLoading ? 'Searching...' : 'Set Pin'}
                        </button>
                      </div>

                      {/* Suggestions list */}
                      {showSuggestions && addressSuggestions.length > 0 && (
                        <div className="absolute z-50 left-0 right-0 mt-1 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl max-h-48 overflow-y-auto divide-y divide-slate-900">
                          {addressSuggestions.map((item, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setAddressInput(item.display_name);
                                const lat = parseFloat(item.lat);
                                const lng = parseFloat(item.lon);
                                onPinDropped(lat, lng);
                                setGeocodingError(null);
                                setAddressSuggestions([]);
                                setShowSuggestions(false);
                                audio.playSuccess();
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-slate-900 transition-colors text-[11px] text-slate-300 hover:text-cyan-400 font-medium truncate block"
                            >
                              📍 {item.display_name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          enablePinSelection('CUSTOM_PIN');
                          audio.playClick();
                        }}
                        className="w-full py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-cyan-400 hover:text-cyan-300 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-1.5 shadow-md"
                      >
                        <MapPin className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                        <span>Select Pin on Map</span>
                      </button>
                    </div>

                    {geocodingError && (
                      <p className="text-[10px] text-amber-400 font-bold leading-normal">{geocodingError}</p>
                    )}

                    {customPin && isPinVetoed(customPin.lat, customPin.lng, room.vetoedTypes) && (
                      <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl flex items-center space-x-2 text-xs text-rose-300">
                        <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                        <span>This pin location (or one close to it) has been vetoed! Select another spot.</span>
                      </div>
                    )}

                    {customPin ? (
                      <div className="bg-cyan-500/10 border border-cyan-500/20 p-3 rounded-xl flex items-center justify-between text-xs text-cyan-300">
                        <div>
                          <span className="font-bold uppercase tracking-wider block text-[9px] text-cyan-400">Target Pin Registered</span>
                          <span className="font-mono mt-1 block">Lat: {customPin.lat.toFixed(4)} • Lng: {customPin.lng.toFixed(4)}</span>
                        </div>
                        <button onClick={clearCustomPin} className="text-red-400 hover:text-red-200 text-[10px] font-bold">Clear</button>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-500 italic">Enter an address or landmark name above to locate the pin on the map.</p>
                    )}
                    <p className="text-[10px] text-slate-400 leading-normal">
                      <b>Math:</b> Draws perpendicular bisector between Seeker and Pin. Keeps half-plane containing Hider.
                    </p>
                  </div>
                )}

                {/* THERMOMETER FORM */}
                {qType === 'THERMOMETER' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Target Distance</label>
                      <select
                        value={thermometerDistance}
                        onChange={(e) => {
                          setThermometerDistance(parseFloat(e.target.value));
                          audio.playClick();
                        }}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-200"
                      >
                        <option value={0.5} disabled={room.vetoedTypes.includes('THERMOMETER:DIST:0.5')}>
                          0.5 miles (805m) {room.vetoedTypes.includes('THERMOMETER:DIST:0.5') ? '(BANNED)' : ''}
                        </option>
                        <option value={3.0} disabled={room.vetoedTypes.includes('THERMOMETER:DIST:3')}>
                          3.0 miles (4.8km) {room.vetoedTypes.includes('THERMOMETER:DIST:3') ? '(BANNED)' : ''}
                        </option>
                        {room.gameSize !== 'S' && (
                          <option value={10.0} disabled={room.vetoedTypes.includes('THERMOMETER:DIST:10')}>
                            10.0 miles (16km) {room.vetoedTypes.includes('THERMOMETER:DIST:10') ? '(BANNED)' : ''}
                          </option>
                        )}
                        {room.gameSize === 'L' && (
                          <option value={50.0} disabled={room.vetoedTypes.includes('THERMOMETER:DIST:50')}>
                            50.0 miles (80km) {room.vetoedTypes.includes('THERMOMETER:DIST:50') ? '(BANNED)' : ''}
                          </option>
                        )}
                      </select>
                    </div>

                    {!thermometerActive ? (
                      <button
                        onClick={handleStartThermometer}
                        className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl shadow"
                      >
                        🔥 Start Tracking Distance
                      </button>
                    ) : (
                      <div className="bg-slate-950/80 border border-slate-850 p-4 rounded-xl space-y-2 text-center">
                        <span className="text-[9px] font-bold text-orange-400 uppercase tracking-widest animate-pulse">Thermometer Tracking Active</span>
                        <p className="text-[10px] text-slate-300">
                          Walk to cover <b>{thermometerDistance} mi</b>. Path is visually drawn on map.
                        </p>
                        <button
                          onClick={() => setThermometerActive(false)}
                          className="text-[9px] text-red-400 border border-red-500/20 px-2.5 py-1 rounded-lg"
                        >
                          Reset Thermometer
                        </button>
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400 leading-normal">
                      <b>Math:</b> Compares starting and ending proximity. Keeps Hotter/Colder bisector slice.
                    </p>
                  </div>
                )}

                {/* RADAR FORM */}
                {qType === 'RADAR' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Search Circle Radius (Miles)</label>
                      <select
                        value={radarDistance}
                        onChange={(e) => {
                          setRadarDistance(parseFloat(e.target.value));
                          audio.playClick();
                        }}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-200"
                      >
                        <option value={0.25} disabled={room.vetoedTypes.includes('RADAR:DIST:0.25')}>
                          0.25 miles (400m) {room.vetoedTypes.includes('RADAR:DIST:0.25') ? '(BANNED)' : ''}
                        </option>
                        <option value={0.50} disabled={room.vetoedTypes.includes('RADAR:DIST:0.5')}>
                          0.50 miles (800m) {room.vetoedTypes.includes('RADAR:DIST:0.5') ? '(BANNED)' : ''}
                        </option>
                        <option value={1.00} disabled={room.vetoedTypes.includes('RADAR:DIST:1')}>
                          1.00 mile (1.6km) {room.vetoedTypes.includes('RADAR:DIST:1') ? '(BANNED)' : ''}
                        </option>
                        <option value={3.00} disabled={room.vetoedTypes.includes('RADAR:DIST:3')}>
                          3.00 miles (4.8km) {room.vetoedTypes.includes('RADAR:DIST:3') ? '(BANNED)' : ''}
                        </option>
                        <option value={5.00} disabled={room.vetoedTypes.includes('RADAR:DIST:5')}>
                          5.00 miles (8.0km) {room.vetoedTypes.includes('RADAR:DIST:5') ? '(BANNED)' : ''}
                        </option>
                        <option value={10.00} disabled={room.vetoedTypes.includes('RADAR:DIST:10')}>
                          10.00 miles (16km) {room.vetoedTypes.includes('RADAR:DIST:10') ? '(BANNED)' : ''}
                        </option>
                        <option value={25.00} disabled={room.vetoedTypes.includes('RADAR:DIST:25')}>
                          25.00 miles (40km) {room.vetoedTypes.includes('RADAR:DIST:25') ? '(BANNED)' : ''}
                        </option>
                        <option value={50.00} disabled={room.vetoedTypes.includes('RADAR:DIST:50')}>
                          50.00 miles (80km) {room.vetoedTypes.includes('RADAR:DIST:50') ? '(BANNED)' : ''}
                        </option>
                      </select>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      <b>Math:</b> Boolean intersection. Yes = restricts search inside circle. No = subtracts circle.
                    </p>
                  </div>
                )}

                {/* TENTACLES FORM */}
                {qType === 'TENTACLES' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">POI Type</label>
                        <select
                          value={tentaclePoi}
                          onChange={(e) => {
                            setTentaclePoi(e.target.value);
                            audio.playClick();
                          }}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-200"
                        >
                          <option value="Museums" disabled={room.vetoedTypes.includes('TENTACLES:POI:Museums')}>Museums (1mi) {room.vetoedTypes.includes('TENTACLES:POI:Museums') ? '(BANNED)' : ''}</option>
                          <option value="Libraries" disabled={room.vetoedTypes.includes('TENTACLES:POI:Libraries')}>Libraries (1mi) {room.vetoedTypes.includes('TENTACLES:POI:Libraries') ? '(BANNED)' : ''}</option>
                          <option value="Movie Theatres" disabled={room.vetoedTypes.includes('TENTACLES:POI:Movie Theatres')}>Movie Theatres (1mi) {room.vetoedTypes.includes('TENTACLES:POI:Movie Theatres') ? '(BANNED)' : ''}</option>
                          <option value="Hospitals" disabled={room.vetoedTypes.includes('TENTACLES:POI:Hospitals')}>Hospitals (1mi) {room.vetoedTypes.includes('TENTACLES:POI:Hospitals') ? '(BANNED)' : ''}</option>
                          {room.gameSize === 'L' && (
                            <>
                              <option value="Metro Lines" disabled={room.vetoedTypes.includes('TENTACLES:POI:Metro Lines')}>Metro Lines (15mi) {room.vetoedTypes.includes('TENTACLES:POI:Metro Lines') ? '(BANNED)' : ''}</option>
                              <option value="Zoos" disabled={room.vetoedTypes.includes('TENTACLES:POI:Zoos')}>Zoos (15mi) {room.vetoedTypes.includes('TENTACLES:POI:Zoos') ? '(BANNED)' : ''}</option>
                              <option value="Aquariums" disabled={room.vetoedTypes.includes('TENTACLES:POI:Aquariums')}>Aquariums (15mi) {room.vetoedTypes.includes('TENTACLES:POI:Aquariums') ? '(BANNED)' : ''}</option>
                              <option value="Amusement Parks" disabled={room.vetoedTypes.includes('TENTACLES:POI:Amusement Parks')}>Amusement Parks (15mi) {room.vetoedTypes.includes('TENTACLES:POI:Amusement Parks') ? '(BANNED)' : ''}</option>
                            </>
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Radius (Miles)</label>
                        <select
                          value={tentacleDistance}
                          onChange={(e) => {
                            setTentacleDistance(parseFloat(e.target.value));
                            audio.playClick();
                          }}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-200"
                        >
                          <option value={1.0}>1.0 mile</option>
                          {room.gameSize === 'L' && <option value={15.0}>15.0 miles</option>}
                        </select>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      <b>Math:</b> Outside = circle eliminated. Inside = restricts search to circle, then isolates nearest POI Voronoi cell.
                    </p>
                  </div>
                )}

                {/* PHOTO FORM */}
                {qType === 'PHOTO' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Photo Subject</label>
                      <select
                        value={photoSubject}
                        onChange={(e) => {
                          setPhotoSubject(e.target.value);
                          audio.playClick();
                        }}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-200"
                      >
                        {(PHOTO_SUBJECTS[room.gameSize] || PHOTO_SUBJECTS.M).map((subj) => {
                          const isVetoed = room.vetoedTypes.includes(`PHOTO:SUBJ:${subj}`);
                          return (
                            <option key={subj} value={subj} disabled={isVetoed}>
                              {subj} {isVetoed ? '(BANNED)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      <b>Task:</b> Hiders must take and send a photograph of this subject. Safe to download and verify.
                    </p>
                  </div>
                )}

                <button
                  onClick={handlePreview}
                  className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-2xl font-black text-xs tracking-wider uppercase transition-transform active:scale-[0.99] cursor-pointer"
                >
                  🔍 Preview Query on Map
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: GENERAL TRACKING STATUS */}
      {activeTab === 'STATUS' && (
        <div className="space-y-4">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1 font-mono">Live Tracking metrics</span>

          <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4 text-left space-y-2">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Remaining Play Zone</h4>
            <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-900">
              <div>
                <span className="text-slate-500 block text-[9px] uppercase tracking-wider">Active Search Grid Cells</span>
                <span className="text-slate-200 font-extrabold text-sm">{room.grid.filter((c) => c.active).length} / {room.grid.length}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase tracking-wider">Active Curses in play</span>
                <span className="text-rose-400 font-extrabold text-sm">{room.activeCurses.length} Active</span>
              </div>
            </div>
          </div>

          {/* Sync Catch button hold */}
          <div className="bg-slate-900 border border-slate-850 rounded-3xl p-5 shadow-2xl text-center space-y-4">
            <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider">Apprehend confirmation</h3>
            <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
              If you have physically spotted and tagged the Hider team in the real world, both players must hold this button simultaneously to stop the clock.
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
    </div>
  );
}
