import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { RoomState, Team, Player, Card, ActiveQuestion, ActiveCurse, GridCell, POI } from './src/types';
import { getDistance, generateGrid, cutMatching, cutMeasuring, cutThermometer, cutRadar, cutTentacles, generateDynamicPOIs } from './src/lib/geo';
import { BASE_DECK, getBonusMinutesForSize, getCurseDiscardRequirement } from './src/lib/cardsData';

const app = express();
const PORT = 3000;

// Increase body limit to support base64 photo uploads
app.use(express.json({ limit: '15mb' }));

// Memory storage for Rooms and Active SSE Connections
const rooms: Record<string, RoomState> = {};
const clientsByRoom: Record<string, express.Response[]> = {};

// Helper to broadcast room updates to all connected players
function broadcastRoom(code: string) {
  const room = rooms[code];
  if (!room) return;
  const clients = clientsByRoom[code] || [];
  const message = `data: ${JSON.stringify(room)}\n\n`;
  clients.forEach((client) => {
    try {
      client.write(message);
    } catch (e) {
      // client might have disconnected
    }
  });
}

// Generate unique 4-letter uppercase room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms[code] ? generateRoomCode() : code;
}

function getAvailableDeck(room: RoomState): Omit<Card, 'id'>[] {
  const drawnIds = room.drawnCurseIds || [];
  return BASE_DECK.filter((card) => {
    if (card.type === 'CURSE' && card.curseId) {
      return !drawnIds.includes(card.curseId);
    }
    return true;
  });
}

// Draw cards from deck
function drawCardsFromDeck(room: RoomState, count: number, currentHand: Card[]): Card[] {
  const drawn: Card[] = [];
  if (!room.drawnCurseIds) {
    room.drawnCurseIds = [];
  }
  for (let i = 0; i < count; i++) {
    const available = getAvailableDeck(room);
    const randomIndex = Math.floor(Math.random() * available.length);
    const cardTemplate = available[randomIndex];

    // Record drawn curse
    if (cardTemplate.type === 'CURSE' && cardTemplate.curseId) {
      room.drawnCurseIds.push(cardTemplate.curseId);
    }

    const card: Card = {
      ...cardTemplate,
      id: `card_${Date.now()}_${Math.floor(Math.random() * 10000)}_${i}`,
    };
    drawn.push(card);
  }
  return [...currentHand, ...drawn];
}

function mapGooglePlaceType(googleTypes: string[]): string {
  if (googleTypes.includes('airport')) return 'Commercial Airport';
  if (googleTypes.includes('transit_station') || googleTypes.includes('subway_station') || googleTypes.includes('train_station')) return 'Rail Station';
  if (googleTypes.includes('zoo')) return 'Zoo';
  if (googleTypes.includes('aquarium')) return 'Aquarium';
  if (googleTypes.includes('amusement_park')) return 'Amusement Park';
  if (googleTypes.includes('museum')) return 'Museum';
  if (googleTypes.includes('library')) return 'Library';
  if (googleTypes.includes('hospital')) return 'Hospital';
  if (googleTypes.includes('park')) return 'Park';
  if (googleTypes.includes('movie_theater')) return 'Movie Theatre';
  return 'Scenic Point';
}

async function fetchGooglePlacesNearby(
  centerLat: number,
  centerLng: number,
  radiusMiles: number,
  apiKey: string
): Promise<POI[]> {
  const radiusMeters = Math.min(50000, Math.round(radiusMiles * 1609.34));
  
  const typeGroups = [
    ["transit_station", "subway_station", "train_station", "airport"],
    ["park", "zoo", "aquarium", "amusement_park"],
    ["museum", "library", "hospital", "movie_theater"]
  ];

  const allPois: POI[] = [];
  const seenIds = new Set<string>();

  try {
    const fetchPromises = typeGroups.map(async (types) => {
      const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.types'
        },
        body: JSON.stringify({
          includedTypes: types,
          maxResultCount: 20,
          locationRestriction: {
            circle: {
              center: {
                latitude: centerLat,
                longitude: centerLng
              },
              radius: radiusMeters
            }
          }
        })
      });

      if (!response.ok) {
        let errMsg = '';
        try {
          const errData = await response.json();
          errMsg = JSON.stringify(errData);
        } catch (_) {}
        console.warn(`Google API error for types ${types.join(',')}: ${response.status} ${response.statusText}. Details: ${errMsg}`);
        return [];
      }

      const data = await response.json() as { places?: any[] };
      return data.places || [];
    });

    const results = await Promise.all(fetchPromises);
    const flatPlaces = results.flat();

    for (const p of flatPlaces) {
      if (!p.id || seenIds.has(p.id)) continue;
      seenIds.add(p.id);

      const name = typeof p.displayName === 'object' ? p.displayName?.text : p.displayName;
      if (!name) continue;

      const lat = p.location?.latitude;
      const lng = p.location?.longitude;
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;

      const types = p.types || [];
      const mappedType = mapGooglePlaceType(types);

      allPois.push({
        id: p.id,
        name: `${mappedType} - ${name}`,
        lat,
        lng,
        type: mappedType
      });
    }
  } catch (error) {
    console.error("Error fetching places from Google Maps:", error);
  }

  return allPois;
}

// Add logs to room history
function addHistoryLog(room: RoomState, message: string) {
  const time = new Date().toLocaleTimeString();
  room.history.unshift(`[${time}] ${message}`);
}

// --- API ENDPOINTS ---

// Server health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', roomsCount: Object.keys(rooms).length });
});

// Create Room
app.post('/api/rooms', async (req, res) => {
  const { centerLat, centerLng, radiusMiles, gameSize, teams, hidingTimeLimit } = req.body;
  
  const code = generateRoomCode();
  const grid = generateGrid(centerLat, centerLng, radiusMiles);

  // Fetch real Google Places POIs or fall back to high-fidelity simulation
  let pois: POI[] = [];
  const mapsKey = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
  if (mapsKey && mapsKey !== 'YOUR_API_KEY') {
    pois = await fetchGooglePlacesNearby(centerLat, centerLng, radiusMiles, mapsKey);
  }

  if (pois.length < 10) {
    pois = generateDynamicPOIs(centerLat, centerLng, radiusMiles);
  }

  // Pre-initialize teams if passed
  const initializedTeams: Team[] = [];
  if (teams && Array.isArray(teams)) {
    teams.forEach((teamName: string, idx: number) => {
      initializedTeams.push({
        id: `team_${Date.now()}_${idx}_${Math.floor(Math.random() * 1000)}`,
        name: teamName,
        role: 'SEEKER',
        score: 0,
        players: [],
      });
    });
  }

  const room: RoomState = {
    code,
    centerLat,
    centerLng,
    radiusMiles,
    gameSize,
    gamePhase: 'LOBBY',
    hiderTeamIndex: 0,
    hiderSequence: [],
    teams: initializedTeams,
    players: [],
    grid,
    activeQuestion: null,
    pendingDraft: null,
    hiderHand: [],
    activeCurses: [],
    timerStart: null,
    timerAccumulated: 0,
    vetoedTypes: [],
    hidingTimeLimit: hidingTimeLimit || 10,
    history: [],
    pois,
    drawnCurseIds: [],
    lastHidingScoreDetails: null,
  };

  rooms[code] = room;
  addHistoryLog(room, `Room created with size: ${gameSize} (${radiusMiles} mi radius), hiding time: ${hidingTimeLimit || 10} min, and teams: ${teams?.join(', ') || 'none'}.`);

  res.json(room);
});

// Fetch Room details
app.get('/api/rooms/:code', (req, res) => {
  const { code } = req.params;
  const room = rooms[code.toUpperCase()];
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json(room);
});

// Join Room
app.post('/api/rooms/:code/join', (req, res) => {
  const { code } = req.params;
  const { playerName, teamName } = req.body;
  const room = rooms[code.toUpperCase()];

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  // Create player
  const playerId = `player_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const player: Player = {
    id: playerId,
    name: playerName,
    team: teamName,
    lastUpdate: Date.now(),
  };

  // Add player
  room.players.push(player);

  // Manage team membership
  let team = room.teams.find((t) => t.name === teamName);
  if (!team) {
    team = {
      id: `team_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: teamName,
      role: 'SEEKER', // defaults to seeker
      score: 0,
      players: [playerName],
    };
    room.teams.push(team);
  } else if (!team.players.includes(playerName)) {
    team.players.push(playerName);
  }

  addHistoryLog(room, `Player "${playerName}" joined Team "${teamName}".`);
  broadcastRoom(code.toUpperCase());

  res.json({ player, room });
});

// Update Location
app.post('/api/rooms/:code/update-location', (req, res) => {
  const { code } = req.params;
  const { playerName, lat, lng } = req.body;
  const room = rooms[code];

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const player = room.players.find((p) => p.name === playerName);
  if (player) {
    const isHider = room.teams[room.hiderTeamIndex]?.name === player.team;
    if (isHider && room.hidingStationPin) {
      player.lat = room.hidingStationPin.lat;
      player.lng = room.hidingStationPin.lng;
    } else {
      player.lat = lat;
      player.lng = lng;
    }
    player.lastUpdate = Date.now();

    // Also update team coordinate representative
    const team = room.teams.find((t) => t.name === player.team);
    if (team) {
      if (isHider && room.hidingStationPin) {
        team.lat = room.hidingStationPin.lat;
        team.lng = room.hidingStationPin.lng;
      } else {
        team.lat = lat;
        team.lng = lng;
      }
      team.lastActive = Date.now();
    }
  }

  broadcastRoom(code);
  res.json({ success: true });
});

// Start Game
app.post('/api/rooms/:code/start-game', (req, res) => {
  const { code } = req.params;
  const room = rooms[code];

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  if (room.teams.length < 2) {
    return res.status(400).json({ error: 'At least 2 teams are required to start.' });
  }

  // Create random hiding sequence
  const indices = room.teams.map((_, i) => i);
  // Shuffle indices
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  room.hiderSequence = indices;
  room.hiderTeamIndex = indices[0];

  // Set roles: first index is hider, rest are seekers
  room.teams.forEach((team, idx) => {
    team.role = idx === room.hiderTeamIndex ? 'HIDER' : 'SEEKER';
  });

  room.gamePhase = 'HIDING';
  room.timerStart = null;
  room.timerAccumulated = 0;
  room.activeQuestion = null;
  room.activeCurses = [];
  room.vetoedTypes = [];
  room.hidingStationPin = null;
  room.pendingDraft = null;
  room.hidingEndTime = null;
  room.drawnCurseIds = [];

  // Initialize hider's first hand: empty by default
  room.hiderHand = [];

  addHistoryLog(room, `Game Started! Team "${room.teams[room.hiderTeamIndex].name}" is selected to HIDE.`);
  broadcastRoom(code);

  res.json(room);
});

// Start Hiding Timer
app.post('/api/rooms/:code/start-hiding', (req, res) => {
  const { code } = req.params;
  const room = rooms[code];

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  // Setting custom hiding timer limit in seconds (fallback to 10 minutes)
  const durationMin = room.hidingTimeLimit || 10;
  const hidingLimitSec = durationMin * 60; 
  room.hidingEndTime = Date.now() + hidingLimitSec * 1000;

  addHistoryLog(room, `Hiding countdown started. ${durationMin} minutes remaining.`);
  broadcastRoom(code);

  res.json(room);
});

// Transit Drop Pin
app.post('/api/rooms/:code/arrived-transit', (req, res) => {
  const { code } = req.params;
  const { lat, lng } = req.body;
  const room = rooms[code];

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  room.hidingStationPin = { lat, lng };
  // For testing purposes, set the hider's team location at the first pin they drop/set
  const hiderTeam = room.teams[room.hiderTeamIndex];
  if (hiderTeam) {
    hiderTeam.lat = lat;
    hiderTeam.lng = lng;
    hiderTeam.lastActive = Date.now();
  }

  // Also update player coordinates
  room.players.forEach((player) => {
    if (player.team === hiderTeam?.name) {
      player.lat = lat;
      player.lng = lng;
      player.lastUpdate = Date.now();
    }
  });

  // Drop pin history log
  addHistoryLog(room, `Hider arrived at Chosen Transit Station. Circle boundary dropped. (TESTING: Locked Hider coordinates to drop pin)`);
  broadcastRoom(code);

  res.json(room);
});

// Hiding Complete -> Seeking Starts
app.post('/api/rooms/:code/done-hiding', (req, res) => {
  const { code } = req.params;
  const room = rooms[code];

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  room.gamePhase = 'SEEKING';
  room.timerStart = Date.now();
  room.timerAccumulated = 0;

  addHistoryLog(room, `Hiding completed! The clock is counting UP. Seekers can ask questions now!`);
  broadcastRoom(code);

  res.json(room);
});

// Propose Question
app.post('/api/rooms/:code/propose-question', (req, res) => {
  const { code } = req.params;
  const { question } = req.body; // active question payload
  const room = rooms[code];

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  // Server-side validation
  let isVetoed = false;
  let reason = '';
  if (question.type === 'MATCHING') {
    if (room.vetoedTypes.includes(`MATCHING:${question.poiType}`)) {
      isVetoed = true;
      reason = `MATCHING with POI "${question.poiType}" has been vetoed.`;
    }
  } else if (question.type === 'MEASURING') {
    // Check if the pin is vetoed
    const lat = question.customPin?.lat || 0;
    const lng = question.customPin?.lng || 0;
    const threshold = 0.0009; // Approx 100 meters
    for (const v of room.vetoedTypes) {
      if (v.startsWith('MEASURING:PIN:')) {
        const parts = v.split(':');
        const vLat = parseFloat(parts[2]);
        const vLng = parseFloat(parts[3]);
        if (!isNaN(vLat) && !isNaN(vLng)) {
          if (Math.abs(lat - vLat) < threshold && Math.abs(lng - vLng) < threshold) {
            isVetoed = true;
            reason = `MEASURING with this pin (or one very close to it) has been vetoed.`;
            break;
          }
        }
      }
    }
  } else if (question.type === 'THERMOMETER') {
    if (room.vetoedTypes.includes(`THERMOMETER:DIST:${question.distanceValue}`)) {
      isVetoed = true;
      reason = `THERMOMETER with distance ${question.distanceValue} mi has been vetoed.`;
    }
  } else if (question.type === 'RADAR') {
    if (room.vetoedTypes.includes(`RADAR:DIST:${question.distanceValue}`)) {
      isVetoed = true;
      reason = `RADAR with radius ${question.distanceValue} mi has been vetoed.`;
    }
  } else if (question.type === 'TENTACLES') {
    if (room.vetoedTypes.includes(`TENTACLES:POI:${question.poiType}`)) {
      isVetoed = true;
      reason = `TENTACLES with POI "${question.poiType}" has been vetoed.`;
    }
  } else if (question.type === 'PHOTO') {
    if (room.vetoedTypes.includes(`PHOTO:SUBJ:${question.selectedSubject}`)) {
      isVetoed = true;
      reason = `PHOTO of "${question.selectedSubject}" has been vetoed.`;
    }
  }

  if (isVetoed) {
    return res.status(400).json({ error: reason });
  }

  // Set the active question
  room.activeQuestion = {
    ...question,
    id: `q_${Date.now()}`,
    status: 'PENDING',
  };

  addHistoryLog(room, `Seekers proposed a ${question.type} question: "${question.title}"`);
  broadcastRoom(code);

  res.json(room);
});

// Answer Question (Accepting & Cutting Map)
app.post('/api/rooms/:code/answer-question', (req, res) => {
  const { code } = req.params;
  const { answerValue, photoUrl } = req.body; // boolean for YES/NO questions, or base64 photo
  const room = rooms[code];

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const q = room.activeQuestion;
  if (!q) {
    return res.status(400).json({ error: 'No active question found to answer.' });
  }

  q.status = 'ANSWERED';
  if (photoUrl) q.photoUrl = photoUrl;

  const hiderTeam = room.teams[room.hiderTeamIndex];
  const hiderLat = hiderTeam?.lat || room.centerLat;
  const hiderLng = hiderTeam?.lng || room.centerLng;

  // Let's identify seeker location
  const seekerTeam = room.teams.find((t) => t.role === 'SEEKER');
  const seekerLat = seekerTeam?.lat || room.centerLat;
  const seekerLng = seekerTeam?.lng || room.centerLng;

  // Track initial active grid cells
  const initialActive = room.grid.filter((c) => c.active).length;

  let description = '';

  // Execute Geospatial Cutting
  if (q.type === 'MATCHING') {
    const isYes = answerValue === true;
    const pois = room.pois && room.pois.length > 0 ? room.pois : generateDynamicPOIs(room.centerLat, room.centerLng, room.radiusMiles);
    room.grid = cutMatching(room.grid, pois, isYes, seekerLat, seekerLng);
    description = `Matching Question answered: ${isYes ? 'YES' : 'NO'}.`;
  } else if (q.type === 'MEASURING') {
    if (q.customPin) {
      room.grid = cutMeasuring(
        room.grid,
        seekerLat,
        seekerLng,
        q.customPin.lat,
        q.customPin.lng,
        hiderLat,
        hiderLng
      );
      description = `Measuring Question resolved. Sliced by perpendicular bisector containing Hider.`;
    }
  } else if (q.type === 'THERMOMETER') {
    const isHotter = answerValue === true;
    if (q.startPin && q.endPin) {
      room.grid = cutThermometer(
        room.grid,
        q.startPin.lat,
        q.startPin.lng,
        q.endPin.lat,
        q.endPin.lng,
        isHotter
      );
      description = `Thermometer Question answered: ${isHotter ? 'HOTTER' : 'COLDER'}. Sliced accordingly.`;
    }
  } else if (q.type === 'RADAR') {
    const isYes = answerValue === true;
    if (q.distanceValue !== undefined) {
      room.grid = cutRadar(room.grid, seekerLat, seekerLng, q.distanceValue, isYes);
      description = `Radar Question answered: ${isYes ? 'YES (Within)' : 'NO (Outside)'}. Circle of ${q.distanceValue} mi cut.`;
    }
  } else if (q.type === 'TENTACLES') {
    if (q.distanceValue !== undefined) {
      const pois = room.pois && room.pois.length > 0 ? room.pois : generateDynamicPOIs(room.centerLat, room.centerLng, room.radiusMiles);
      const result = cutTentacles(
        room.grid,
        seekerLat,
        seekerLng,
        q.distanceValue,
        hiderLat,
        hiderLng,
        pois
      );
      room.grid = result.grid;
      description = `Tentacle Question resolved: ${result.hiderStatusDesc}`;
    }
  } else if (q.type === 'PHOTO') {
    description = `Photo Question completed with photo of "${q.selectedSubject}".`;
  }

  const finalActive = room.grid.filter((c) => c.active).length;
  const eliminated = initialActive - finalActive;

  q.mathResult = {
    isYes: answerValue,
    eliminatedCount: eliminated,
    description,
  };

  addHistoryLog(room, `Question Answered! ${description} Eliminated ${eliminated} search cells.`);

  // Reward drawing for Hider
  const drawCount = q.rewardDraw || 1;
  const pickCount = q.rewardPick || 1;

  if (room.freeQuestionsRemaining && room.freeQuestionsRemaining > 0) {
    room.freeQuestionsRemaining -= 1;
    addHistoryLog(room, `The seekers' question was free! Hider receives no reward card drafts for this question.`);
  } else {
    if (drawCount > pickCount) {
      const draftOptions: Card[] = [];
      if (!room.drawnCurseIds) {
        room.drawnCurseIds = [];
      }
      for (let i = 0; i < drawCount; i++) {
        const available = getAvailableDeck(room);
        const randomIndex = Math.floor(Math.random() * available.length);
        const cardTemplate = available[randomIndex];

        // Record drawn curse
        if (cardTemplate.type === 'CURSE' && cardTemplate.curseId) {
          room.drawnCurseIds.push(cardTemplate.curseId);
        }

        const card: Card = {
          ...cardTemplate,
          id: `card_${Date.now()}_${Math.floor(Math.random() * 10000)}_${i}`,
        };
        draftOptions.push(card);
      }
      room.pendingDraft = {
        id: `draft_${Date.now()}`,
        options: draftOptions,
        pickCount: pickCount,
      };
      addHistoryLog(room, `Hider triggers card draft choice: choose ${pickCount} cards out of ${drawCount} options.`);
    } else {
      room.hiderHand = drawCardsFromDeck(room, pickCount, room.hiderHand);
      addHistoryLog(room, `Hider rewarded: drew ${pickCount} cards (Hider hand size: ${room.hiderHand.length}).`);
    }
  }

  broadcastRoom(code);
  res.json(room);
});

// Clear Active Question (Acknowledge and dismiss resolved question)
app.post('/api/rooms/:code/clear-question', (req, res) => {
  const { code } = req.params;
  const room = rooms[code];

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  addHistoryLog(room, `Active question cleared/dismissed.`);
  room.activeQuestion = null;

  broadcastRoom(code);
  res.json(room);
});

// Pick cards from draft
app.post('/api/rooms/:code/pick-draft', (req, res) => {
  const { code } = req.params;
  const { cardIds } = req.body;
  const room = rooms[code];

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  if (!room.pendingDraft) {
    return res.status(400).json({ error: 'No active card draft found.' });
  }

  const selectedCards = room.pendingDraft.options.filter((c) => cardIds.includes(c.id));
  if (selectedCards.length !== room.pendingDraft.pickCount) {
    return res.status(400).json({ error: `Must select exactly ${room.pendingDraft.pickCount} cards.` });
  }

  room.hiderHand.push(...selectedCards);
  addHistoryLog(room, `Hider completed card draft, picking: ${selectedCards.map((c) => `"${c.title}"`).join(', ')}.`);

  room.pendingDraft = null;

  broadcastRoom(code);
  res.json(room);
});

// Veto Question
app.post('/api/rooms/:code/veto-question', (req, res) => {
  const { code } = req.params;
  const { cardId } = req.body;
  const room = rooms[code];

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const q = room.activeQuestion;
  if (!q) {
    return res.status(400).json({ error: 'No active question found to veto.' });
  }

  // Consume veto card from hand
  room.hiderHand = room.hiderHand.filter((c) => c.id !== cardId);

  q.status = 'VETOED';

  // Encode specific fine-grained data point as banned/vetoed
  let vetoKey = '';
  let readableDataPoint = '';

  if (q.type === 'MATCHING') {
    vetoKey = `MATCHING:${q.poiType}`;
    readableDataPoint = `MATCHING questions for "${q.poiType}"`;
  } else if (q.type === 'MEASURING') {
    const lat = q.customPin?.lat || 0;
    const lng = q.customPin?.lng || 0;
    vetoKey = `MEASURING:PIN:${lat.toFixed(6)}:${lng.toFixed(6)}`;
    readableDataPoint = `MEASURING with pin [${lat.toFixed(4)}, ${lng.toFixed(4)}]`;
  } else if (q.type === 'THERMOMETER') {
    vetoKey = `THERMOMETER:DIST:${q.distanceValue}`;
    readableDataPoint = `THERMOMETER with distance ${q.distanceValue} mi`;
  } else if (q.type === 'RADAR') {
    vetoKey = `RADAR:DIST:${q.distanceValue}`;
    readableDataPoint = `RADAR with radius ${q.distanceValue} mi`;
  } else if (q.type === 'TENTACLES') {
    vetoKey = `TENTACLES:POI:${q.poiType}`;
    readableDataPoint = `TENTACLES with POI "${q.poiType}"`;
  } else if (q.type === 'PHOTO') {
    vetoKey = `PHOTO:SUBJ:${q.selectedSubject}`;
    readableDataPoint = `PHOTO with subject "${q.selectedSubject}"`;
  } else {
    vetoKey = q.type;
    readableDataPoint = q.type;
  }

  room.vetoedTypes.push(vetoKey);

  addHistoryLog(room, `Hiders VETOED the question! Specific ${readableDataPoint} is BANNED for the rest of this round.`);
  
  // Clean up active question
  room.activeQuestion = null;

  broadcastRoom(code);
  res.json(room);
});

// Play Powerup Card
app.post('/api/rooms/:code/play-powerup', (req, res) => {
  const { code } = req.params;
  const { cardId, targetCardId } = req.body;
  const room = rooms[code];

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const cardIndex = room.hiderHand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) {
    return res.status(400).json({ error: 'Powerup card not found in hand.' });
  }

  const card = room.hiderHand[cardIndex];

  if (targetCardId === 'DISCARD_ONLY') {
    room.hiderHand = room.hiderHand.filter((c) => c.id !== cardId);
    addHistoryLog(room, `Hider discarded "${card.title}" to satisfy hand size limit.`);
    broadcastRoom(code);
    return res.json(room);
  }

  if (card.title === 'Duplicate') {
    const target = room.hiderHand.find((c) => c.id === targetCardId);
    if (!target) {
      return res.status(400).json({ error: 'Target card to duplicate not found.' });
    }
    // Clone target
    const cloned: Card = {
      ...target,
      id: `card_${Date.now()}_cloned_${Math.floor(Math.random() * 1000)}`,
    };
    // Consume duplicate and add clone
    room.hiderHand.splice(cardIndex, 1);
    room.hiderHand.push(cloned);
    addHistoryLog(room, `Hider played "Duplicate" to clone "${target.title}".`);
  } 
  else if (card.title === 'Discard 1, Draw 2') {
    const target = room.hiderHand.find((c) => c.id === targetCardId);
    if (!target) {
      return res.status(400).json({ error: 'Target card to discard not found.' });
    }
    // Remove the playing card and the target discard card
    room.hiderHand = room.hiderHand.filter((c) => c.id !== cardId && c.id !== targetCardId);
    // Draw 2
    room.hiderHand = drawCardsFromDeck(room, 2, room.hiderHand);
    addHistoryLog(room, `Hider played "Discard 1, Draw 2", discarding "${target.title}".`);
  } 
  else if (card.title === 'Discard 2, Draw 3') {
    const { targetCardIds } = req.body; // Expect array of 2 IDs
    if (!targetCardIds || targetCardIds.length !== 2) {
      return res.status(400).json({ error: 'Must select exactly 2 cards to discard.' });
    }
    room.hiderHand = room.hiderHand.filter((c) => c.id !== cardId && !targetCardIds.includes(c.id));
    room.hiderHand = drawCardsFromDeck(room, 3, room.hiderHand);
    addHistoryLog(room, `Hider played "Discard 2, Draw 3" to reshuffle hand.`);
  } 
  else if (card.title === 'Draw 1, Expand 1') {
    // Hand expand is visual/local validation during play, just draw card on server
    room.hiderHand = room.hiderHand.filter((c) => c.id !== cardId);
    room.hiderHand = drawCardsFromDeck(room, 1, room.hiderHand);
    addHistoryLog(room, `Hider played "Draw 1, Expand 1" to permanently expand max hand limit.`);
  } 
  else if (card.title === 'Randomize') {
    room.hiderHand = room.hiderHand.filter((c) => c.id !== cardId);
    room.hiderHand = drawCardsFromDeck(room, 1, room.hiderHand);
    addHistoryLog(room, `Hider played "Randomize" to cycles 1 card.`);
  }
  else if (card.title === 'Move / Escape') {
    room.hiderHand = room.hiderHand.filter((c) => c.id !== cardId);
    addHistoryLog(room, `Hider played "Move / Escape" to relocate boundary circle pin.`);
  }

  broadcastRoom(code);
  res.json(room);
});

// Cast Curse
app.post('/api/rooms/:code/cast-curse', (req, res) => {
  const { code } = req.params;
  const { cardId, fulfilledCost, discardCardIds } = req.body;
  const room = rooms[code];

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const cardIndex = room.hiderHand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) {
    return res.status(400).json({ error: 'Curse card not found in hand.' });
  }

  const card = room.hiderHand[cardIndex];

  if (fulfilledCost === false) {
    // Consume card
    room.hiderHand.splice(cardIndex, 1);
    addHistoryLog(room, `Hider attempted to play "${card.title}" but failed to fulfill the casting cost. Card consumed.`);
    broadcastRoom(code);
    return res.json(room);
  }

  // Handle discarding costs if present
  const reqInfo = getCurseDiscardRequirement(card);
  if (reqInfo) {
    if (reqInfo.count === -1) {
      // Discard entire remaining hand (except the curse card itself)
      const otherCards = room.hiderHand.filter((c) => c.id !== cardId);
      const discardedTitles = otherCards.map((c) => `"${c.title}"`).join(', ');
      
      // Clear hand completely except the curse card (which is spent anyway)
      room.hiderHand = [];
      addHistoryLog(room, `Hider played "${card.title}" and discarded entire remaining hand: [${discardedTitles}].`);
    } else if (reqInfo.count > 0) {
      const ids = discardCardIds || [];
      if (ids.length !== reqInfo.count) {
        return res.status(400).json({ error: `Must select exactly ${reqInfo.count} card(s) to discard.` });
      }
      
      // Validate that all selected IDs exist in hand (and are not the curse card itself)
      const handWithoutCurse = room.hiderHand.filter((c) => c.id !== cardId);
      const toDiscard: Card[] = [];
      
      for (const id of ids) {
        const found = handWithoutCurse.find((c) => c.id === id);
        if (!found) {
          return res.status(400).json({ error: `Selected card to discard is not in your hand.` });
        }
        if (reqInfo.filterType && found.type !== reqInfo.filterType) {
          return res.status(400).json({ error: `Selected card "${found.title}" does not match required type ${reqInfo.filterType}.` });
        }
        toDiscard.push(found);
      }
      
      // Remove the curse card and the discarded cards
      room.hiderHand = room.hiderHand.filter((c) => c.id !== cardId && !ids.includes(c.id));
      const discardedTitles = toDiscard.map((c) => `"${c.title}"`).join(', ');
      addHistoryLog(room, `Hider played "${card.title}" and discarded: [${discardedTitles}].`);
    }
  } else {
    // Simply remove the curse card itself from hand
    room.hiderHand.splice(cardIndex, 1);
  }

  // Cast Curse successfully! Add to room activeCurses list
  const curse: ActiveCurse = {
    id: `active_curse_${Date.now()}`,
    cardId: card.id,
    title: card.title,
    desc: card.desc,
    costDesc: card.costDesc || 'None',
    seekerEffect: card.seekerEffect || 'All questions locked.',
    dismissalDesc: card.dismissalDesc || 'Dismissal required.',
    resolved: false,
    pendingConfirmation: false,
  };

  room.activeCurses.push(curse);
  addHistoryLog(room, `⚠️ HIDER CASTED A CURSE! Seekers are hit by "${card.title}". UI LOCKED.`);

  if (card.curseId === 'curse_14' || card.title === 'Curse Of The Impressionable Consumer') {
    room.freeQuestionsRemaining = (room.freeQuestionsRemaining || 0) + 1;
    addHistoryLog(room, `Modifier active: The Seekers' next question will be completely free (Hider receives no card rewards).`);
  }

  broadcastRoom(code);
  res.json(room);
});

// Seeker claims completion of active curse, requesting dismissal confirmation
app.post('/api/rooms/:code/claim-curse', (req, res) => {
  const { code } = req.params;
  const { curseId } = req.body;
  const room = rooms[code];

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const curse = room.activeCurses.find((c) => c.id === curseId);
  if (!curse) {
    return res.status(404).json({ error: 'Curse not found.' });
  }

  curse.pendingConfirmation = true;
  addHistoryLog(room, `Seekers claimed completion for curse "${curse.title}". Pending Hider approval.`);

  // PAUSE TIMER: Save current elapsed time into timerAccumulated and pause clock
  if (room.timerStart) {
    room.timerAccumulated += Math.floor((Date.now() - room.timerStart) / 1000);
    room.timerStart = null;
    addHistoryLog(room, `⏱️ Game clock PAUSED during curse dismissal verification.`);
  }

  broadcastRoom(code);
  res.json(room);
});

// Dismiss Curse (Seeker claims completed, Hider confirms)
app.post('/api/rooms/:code/dismiss-curse', (req, res) => {
  const { code } = req.params;
  const { curseId, confirmed } = req.body;
  const room = rooms[code];

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  if (confirmed) {
    const curse = room.activeCurses.find((c) => c.id === curseId);
    if (curse) {
      room.activeCurses = room.activeCurses.filter((c) => c.id !== curseId);
      addHistoryLog(room, `✅ Curse "${curse.title}" has been successfully DISMISSED by Hider confirmation.`);
    }
  } else {
    const curse = room.activeCurses.find((c) => c.id === curseId);
    if (curse) {
      curse.pendingConfirmation = false;
      addHistoryLog(room, `❌ Seeker dismissal claim for "${curse.title}" was REJECTED by Hider.`);
    } else {
      addHistoryLog(room, `Seeker dismissal claim was REJECTED by Hider.`);
    }
  }

  // RESUME TIMER if no other curses are pending confirmation
  const hasPending = room.activeCurses.some((c) => c.pendingConfirmation);
  if (!hasPending && room.gamePhase === 'SEEKING' && !room.timerStart) {
    room.timerStart = Date.now();
    addHistoryLog(room, `⏱️ Game clock RESUMED.`);
  }

  broadcastRoom(code);
  res.json(room);
});

// Catch Hider (Ends Round!)
app.post('/api/rooms/:code/catch-hider', (req, res) => {
  const { code } = req.params;
  const room = rooms[code];

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  // Calculate Hiding Time correctly, accounting for paused states
  let timeSpent = room.timerAccumulated;
  if (room.timerStart) {
    timeSpent += Math.floor((Date.now() - room.timerStart) / 1000);
  }

  // Add Time Bonus Cards left in hand!
  let timeBonusesAdded = 0;
  room.hiderHand.forEach((card) => {
    if (card.type === 'TIME') {
      const bonusMin = getBonusMinutesForSize(card.rarity, room.gameSize);
      timeBonusesAdded += bonusMin * 60; // convert to seconds
    }
  });

  const finalScore = timeSpent + timeBonusesAdded;

  // Save score to hider team
  const hiderTeam = room.teams[room.hiderTeamIndex];
  if (hiderTeam) {
    hiderTeam.score = finalScore;
  }

  // Populate last hiding score details for the breakdown display
  room.lastHidingScoreDetails = {
    hiderTeamName: hiderTeam ? hiderTeam.name : 'Hiders',
    baseHidingTime: timeSpent,
    handTimeBonuses: timeBonusesAdded,
    bonusCards: room.hiderHand
      .filter((card) => card.type === 'TIME')
      .map((card) => ({
        title: card.title,
        rarity: card.rarity,
        bonusMin: getBonusMinutesForSize(card.rarity, room.gameSize),
      })),
    finalScore: finalScore,
  };

  // Stop timer
  room.timerStart = null;
  room.gamePhase = 'INTERMISSION';

  addHistoryLog(room, `🚨 HIDER HAS BEEN FOUND! Hiding Time: ${Math.floor(timeSpent / 60)}m ${timeSpent % 60}s. Hand Time Bonuses added: +${Math.floor(timeBonusesAdded / 60)}m. Final Round Score: ${Math.floor(finalScore / 60)}m ${finalScore % 60}s.`);

  broadcastRoom(code);
  res.json(room);
});

// Start Next Round
app.post('/api/rooms/:code/next-round', (req, res) => {
  const { code } = req.params;
  const room = rooms[code];

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  // Move to next hider in sequence
  const currentSeqIdx = room.hiderSequence.indexOf(room.hiderTeamIndex);
  const nextSeqIdx = currentSeqIdx + 1;

  if (nextSeqIdx >= room.hiderSequence.length) {
    // All teams have hidden! Game ends!
    room.gamePhase = 'END';
    addHistoryLog(room, `Game completed! Navigating to Leaderboard.`);
  } else {
    // Set next team as Hider
    room.hiderTeamIndex = room.hiderSequence[nextSeqIdx];
    
    room.teams.forEach((team, idx) => {
      team.role = idx === room.hiderTeamIndex ? 'HIDER' : 'SEEKER';
    });

    room.gamePhase = 'HIDING';
    room.timerStart = null;
    room.timerAccumulated = 0;
    room.freeQuestionsRemaining = 0;
    room.activeQuestion = null;
    room.activeCurses = [];
    room.vetoedTypes = [];
    room.hidingStationPin = null;
    room.hidingEndTime = null;
    room.drawnCurseIds = [];
    room.lastHidingScoreDetails = null;

    // Reset grid to active only if within the circle boundaries (avoids square glitch!)
    room.grid = room.grid.map((c) => {
      const d = getDistance(room.centerLat, room.centerLng, c.lat, c.lng);
      return { ...c, active: d <= room.radiusMiles };
    });

    // Reset hider hand for next team to empty (matches first round starting hand size of 0)
    room.hiderHand = [];

    addHistoryLog(room, `Round started! Team "${room.teams[room.hiderTeamIndex].name}" is now HIDING.`);
  }

  broadcastRoom(code);
  res.json(room);
});

// Reset Room
app.post('/api/rooms/:code/reset', (req, res) => {
  const { code } = req.params;
  const room = rooms[code];

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  room.gamePhase = 'LOBBY';
  room.teams = [];
  room.players = [];
  room.hiderHand = [];
  room.activeQuestion = null;
  room.activeCurses = [];
  room.timerStart = null;
  room.timerAccumulated = 0;
  room.freeQuestionsRemaining = 0;
  room.hidingEndTime = null;
  room.vetoedTypes = [];
  room.drawnCurseIds = [];
  room.lastHidingScoreDetails = null;
  room.grid = generateGrid(room.centerLat, room.centerLng, room.radiusMiles);
  room.history = [];

  addHistoryLog(room, `Room reset successfully.`);
  broadcastRoom(code);

  res.json(room);
});

// SSE Streaming Room State
app.get('/api/rooms/:code/stream', (req, res) => {
  const { code } = req.params;
  const room = rooms[code];

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  if (!clientsByRoom[code]) {
    clientsByRoom[code] = [];
  }
  clientsByRoom[code].push(res);

  // Send initial state immediately
  res.write(`data: ${JSON.stringify(room)}\n\n`);

  req.on('close', () => {
    clientsByRoom[code] = (clientsByRoom[code] || []).filter((c) => c !== res);
  });
});

// --- CLIENT SERVING ---

// Serve static assets in production, mount Vite in development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
