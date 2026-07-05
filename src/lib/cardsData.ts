import { Card, GameSize, CardRarity } from '../types';

export const BASE_DECK: Omit<Card, 'id'>[] = [
  // --- TIME BONUSES (55 cards total) ---
  // Red (25 qty)
  ...Array(25).fill(null).map((_, i) => ({
    title: 'Red Time Bonus',
    type: 'TIME' as const,
    rarity: 'RED' as const,
    desc: 'Adds a small time bonus to your final hiding score at the end of the round if held in hand.',
    bonusMinutes: 2, // 2m (S) / 3m (M) / 5m (L) - handled dynamically by game size
  })),

  // Orange (15 qty)
  ...Array(15).fill(null).map((_, i) => ({
    title: 'Orange Time Bonus',
    type: 'TIME' as const,
    rarity: 'ORANGE' as const,
    desc: 'Adds a medium time bonus to your final hiding score at the end of the round if held in hand.',
    bonusMinutes: 4, // 4m (S) / 6m (M) / 10m (L)
  })),

  // Yellow (10 qty)
  ...Array(10).fill(null).map((_, i) => ({
    title: 'Yellow Time Bonus',
    type: 'TIME' as const,
    rarity: 'YELLOW' as const,
    desc: 'Adds a large time bonus to your final hiding score at the end of the round if held in hand.',
    bonusMinutes: 6, // 6m (S) / 9m (M) / 15m (L)
  })),

  // Green (3 qty)
  ...Array(3).fill(null).map((_, i) => ({
    title: 'Green Time Bonus',
    type: 'TIME' as const,
    rarity: 'GREEN' as const,
    desc: 'Adds an extra large time bonus to your final hiding score at the end of the round if held in hand.',
    bonusMinutes: 8, // 8m (S) / 12m (M) / 20m (L)
  })),

  // Blue (2 qty)
  ...Array(2).fill(null).map((_, i) => ({
    title: 'Blue Time Bonus',
    type: 'TIME' as const,
    rarity: 'BLUE' as const,
    desc: 'Adds an ultimate time bonus to your final hiding score at the end of the round if held in hand.',
    bonusMinutes: 12, // 12m (S) / 18m (M) / 30m (L)
  })),

  // --- POWER UPS (21 cards total) ---
  // Veto (4 qty)
  ...Array(4).fill(null).map((_, i) => ({
    title: 'Veto',
    type: 'POWERUP' as const,
    rarity: 'COMMON' as const,
    desc: 'Veto an incoming question. Consumes this card, sends a "Vetoed" notification, and bans that specific question category/data-type for the rest of the round.',
    costDesc: 'None. Play in response to an incoming question.',
  })),

  // Duplicate (2 qty)
  ...Array(2).fill(null).map((_, i) => ({
    title: 'Duplicate',
    type: 'POWERUP' as const,
    rarity: 'COMMON' as const,
    desc: 'Clones another target card in your hand.',
    costDesc: 'None. Select a card in your hand to duplicate.',
  })),

  // Discard 1 Draw 2 (4 qty)
  ...Array(4).fill(null).map((_, i) => ({
    title: 'Discard 1, Draw 2',
    type: 'POWERUP' as const,
    rarity: 'COMMON' as const,
    desc: 'Discard one card from your hand to instantly draw two new random cards.',
    costDesc: 'Must select 1 card from your hand to discard.',
  })),

  // Discard 2 Draw 3 (4 qty)
  ...Array(4).fill(null).map((_, i) => ({
    title: 'Discard 2, Draw 3',
    type: 'POWERUP' as const,
    rarity: 'COMMON' as const,
    desc: 'Discard two cards from your hand to instantly draw three new random cards.',
    costDesc: 'Must select 2 cards from your hand to discard.',
  })),

  // Draw 1 Expand 1 (2 qty)
  ...Array(2).fill(null).map((_, i) => ({
    title: 'Draw 1, Expand 1',
    type: 'POWERUP' as const,
    rarity: 'COMMON' as const,
    desc: 'Permanently increases your max hand size by +1 for this round, and draws 1 card.',
    costDesc: 'None.',
  })),

  // --- CURSES (24 cards total) ---
  {
    title: 'Curse of The Zoologist',
    type: 'CURSE' as const,
    rarity: 'COMMON' as const,
    desc: 'Force the Seekers to find and photograph a wild animal in the same category as one you submit.',
    costDesc: 'Take a photo of a wild animal (fish, bird, mammal, reptile, amphibian, or bug).',
    seekerEffect: 'YOU HAVE BEEN CURSED! All questions and Seekers UI are locked. You must take a photo of a wild animal in the same category as the Hider\'s animal (e.g. bird, bug, mammal) to break the curse.',
    dismissalDesc: 'Take a photo of a wild animal in the same category for verification.',
    curseId: 'curse_1',
  },
  {
    title: 'Curse Of The Unguided Tourist',
    type: 'CURSE' as const,
    rarity: 'COMMON' as const,
    desc: 'Send Seekers a Google Street View snippet from within 500ft of their position. They must find the exact location in real life without internet research.',
    costDesc: 'Seeker(s) must be outside. You must take/find a Street View screenshot parallel to the horizon with a human-built structure.',
    seekerEffect: 'YOU HAVE BEEN CURSED! All questions and transportation are locked. The Hider has sent a Street View image from within 500ft (152m). You must locate it in real life and send a photo of yourselves standing there to verify.',
    dismissalDesc: 'Arrive at the mystery structure and take a photo for verification.',
    curseId: 'curse_2',
  },
  {
    title: 'Curse Of The Endless Tumble',
    type: 'CURSE' as const,
    rarity: 'COMMON' as const,
    desc: 'Seekers must roll a die at least 100ft (30m) and have it land on a 5 or a 6. If they hit someone accidentally, you get a bonus.',
    costDesc: 'Roll a die. If it lands on 5 or 6, this curse has no effect (card consumed). Otherwise, play it.',
    seekerEffect: 'YOU HAVE BEEN CURSED! Roll a die a full 100ft (30m) unaided (using only initial throw and gravity) and have it land on a 5 or a 6. If you accidentally hit someone with the die, tell the Hiders to award them a [S10/M20/L30] minute bonus!',
    dismissalDesc: 'Successfully throw a die 100ft and land on 5 or 6.',
    curseId: 'curse_3',
  },
  {
    title: 'Curse Of The Hidden Hangman',
    type: 'CURSE' as const,
    rarity: 'COMMON' as const,
    desc: 'Seekers must play and win a game of hangman against you before asking questions or boarding transport.',
    costDesc: 'Discard 2 cards from your hand.',
    seekerEffect: 'YOU HAVE BEEN CURSED! You must play a game of Hangman against the Hiders and win before you can ask another question or board transportation.',
    dismissalDesc: 'Play Hangman with the hider and win.',
    curseId: 'curse_4',
  },
  {
    title: 'Curse Of The Overflowing Chalice',
    type: 'CURSE' as const,
    rarity: 'COMMON' as const,
    desc: 'For the next three questions, you may draw (not keep) an additional card when drawing from the hider deck.',
    costDesc: 'Discard 1 card from your hand.',
    seekerEffect: 'The Hider has drunk from the Overflowing Chalice. No active restriction on Seekers, but Hiders get drawing benefits.',
    dismissalDesc: 'Instantly dismissed (beneficial for hider).',
    curseId: 'curse_5',
  },
  {
    title: 'Curse Of The Mediocre Travel Agent',
    type: 'CURSE' as const,
    rarity: 'COMMON' as const,
    desc: 'Force the Seekers to travel to a designated public place within 0.25mi (S/M) or 0.5mi (L) and vacation there for 5m (S/M) or 10m (L).',
    costDesc: 'None. Choose a place nearby them on the map.',
    seekerEffect: 'YOU HAVE BEEN CURSED! You must travel to the designated "vacation spot" selected by the Hider, stay there for [S5 / M5 / L10] minutes, and send three photos of you enjoying your "vacation" plus bring back a souvenir. If you lose the souvenir, Hiders get an extra [S30 / M45 / L60] minutes!',
    dismissalDesc: 'Travel to the spot, wait out the time, take 3 vacation photos, and procure a physical souvenir.',
    curseId: 'curse_6',
  },
  {
    title: 'Curse Of The Luxury Car',
    type: 'CURSE' as const,
    rarity: 'COMMON' as const,
    desc: 'Take a photo of a car. Seekers must photograph a more expensive car to proceed.',
    costDesc: 'Take a photo of a nearby car.',
    seekerEffect: 'YOU HAVE BEEN CURSED! The Hiders photographed a car. You must find and photograph a MORE expensive car before asking another question.',
    dismissalDesc: 'Find a more expensive car and upload a photo.',
    curseId: 'curse_7',
  },
  {
    title: 'Curse Of The U-Turn',
    type: 'CURSE' as const,
    rarity: 'COMMON' as const,
    desc: 'Force Seekers to disembark their transport at the next station (if served by another transit within 0.5h (S/M) or 1h (L)).',
    costDesc: 'Seekers must be traveling away from you (their next station is further from you than they currently are).',
    seekerEffect: 'YOU HAVE BEEN CURSED! You must disembark your current vehicle at the very next station, provided another form of transit serves it within [S0.5 / M0.5 / L1] hours.',
    dismissalDesc: 'Disembark at the next station as instructed.',
    curseId: 'curse_8',
  },
  {
    title: 'Curse Of The Bridge Troll',
    type: 'CURSE' as const,
    rarity: 'COMMON' as const,
    desc: 'Force Seekers to ask their next question from physically underneath a bridge.',
    costDesc: 'Seekers must be at least [S1 / M5 / L30] miles ([S0.3 / M1.5 / L9.1] km) away from you.',
    seekerEffect: 'YOU HAVE BEEN CURSED! The Bridge Troll demands that your next question be asked from physically underneath a bridge.',
    dismissalDesc: 'Stand physically under a bridge and ask your next question.',
    curseId: 'curse_9',
  },
  {
    title: 'Curse Of Water Weight',
    type: 'CURSE' as const,
    rarity: 'COMMON' as const,
    desc: 'Seekers must acquire and carry at least 2 liters of liquid per seeker. If lost/abandoned, you get a large time bonus.',
    costDesc: 'Seekers must be within 1,000ft (300m) of a body of water.',
    seekerEffect: 'YOU HAVE BEEN CURSED! You cannot ask another question until you acquire and carry at least 2 liters of liquid PER SEEKER. You must carry this liquid for the rest of your run. If you abandon or lose the water, Hiders get a [S30 / M30 / L60] minute bonus!',
    dismissalDesc: 'Acquire the required liquid (2L per seeker) and confirm you are carrying it.',
    curseId: 'curse_10',
  },
  {
    title: 'Curse Of The Jammed Door',
    type: 'CURSE' as const,
    rarity: 'COMMON' as const,
    desc: 'For the next [S0.5 / M1 / L3] hours, Seekers must roll 2 dice to enter any doorway. If they do not roll 7+, they cannot enter. Retries allowed after 5m/10m/15m.',
    costDesc: 'Discard 2 cards from your hand.',
    seekerEffect: 'YOU HAVE BEEN CURSED! For the next [S0.5 / M1 / L3] hours, you cannot pass through any doorway (building, business, train, or vehicle) without rolling 2 dice and getting a 7 or higher. If you fail, you must wait [S5 / M10 / L15] minutes before re-attempting that specific doorway.',
    dismissalDesc: 'Confirm you have carried out the jammed door rules for the duration.',
    curseId: 'curse_11',
  },
  {
    title: 'Curse Of The Cairn',
    type: 'CURSE' as const,
    rarity: 'COMMON' as const,
    desc: 'Stack a freestanding rock tower of size N. Seekers must build a rock tower of the same height under the same rules.',
    costDesc: 'Stack as many rocks as you can freestanding. Base rock doesn\'t count. Each rock touches only one other. Must stand 5s. If it falls, use the highest height achieved.',
    seekerEffect: 'YOU HAVE BEEN CURSED! The Hider constructed a freestanding rock tower that was N rocks high. You must find rocks in nature and construct a freestanding rock tower of the SAME height. It must stand for at least 5 seconds without falling. If it falls, you must restart!',
    dismissalDesc: 'Build a freestanding rock tower of height N and verify.',
    curseId: 'curse_12',
  },
  {
    title: 'Curse Of The Urban Explorer',
    type: 'CURSE' as const,
    rarity: 'COMMON' as const,
    desc: 'For the rest of the run, Seekers cannot ask questions while on transit or inside any train/transit station.',
    costDesc: 'Discard 2 cards from your hand.',
    seekerEffect: 'YOU HAVE BEEN CURSED! For the rest of this run, you are strictly prohibited from asking questions while on transit or inside a train/transit station.',
    dismissalDesc: 'Acknowledge transit question ban (active restriction).',
    curseId: 'curse_13',
  },
  {
    title: 'Curse Of The Impressionable Consumer',
    type: 'CURSE' as const,
    rarity: 'COMMON' as const,
    desc: 'Seekers must enter a location or buy a product they saw a physical advertisement for. Advertisement must be 100ft+ from product.',
    costDesc: 'None. The Seekers\' next question is completely free (costs no reward/time penalty).',
    seekerEffect: 'YOU HAVE BEEN CURSED! You must find a physical advertisement out in the world, then enter that business/location or purchase that product to proceed. The ad must be at least 100ft (30m) away from the location/product.',
    dismissalDesc: 'Locate ad, visit business or purchase product, and verify.',
    curseId: 'curse_14',
  },
  {
    title: 'Curse Of The Egg Partner',
    type: 'CURSE' as const,
    rarity: 'COMMON' as const,
    desc: 'Seekers must acquire an egg and treat it as a team member. If it cracks, you get a major time bonus.',
    costDesc: 'Discard 2 cards from your hand. Cannot be played in the endgame.',
    seekerEffect: 'YOU HAVE BEEN CURSED! You must buy or acquire a raw egg immediately. This egg is now an official team member. You must carry it everywhere. If it cracks or is abandoned before the end of the run, Hiders get an extra [S30 / M45 / L60] minutes!',
    dismissalDesc: 'Acquire a raw egg and verify you are carrying it safely.',
    curseId: 'curse_15',
  },
  {
    title: 'Curse Of The Distant Cuisine',
    type: 'CURSE' as const,
    rarity: 'COMMON' as const,
    desc: 'Force Seekers to visit a restaurant serving food from a foreign country equal or further than one you are at.',
    costDesc: 'You must physically be at a restaurant serving food from a specific foreign country.',
    seekerEffect: 'YOU HAVE BEEN CURSED! The Hider is at a foreign restaurant. You must visit a restaurant serving food from a country that is an equal or greater geographical distance away from your current location before asking another question.',
    dismissalDesc: 'Visit an eligible foreign restaurant and upload a photo.',
    curseId: 'curse_16',
  },
  {
    title: 'Curse Of The Right Turn',
    type: 'CURSE' as const,
    rarity: 'COMMON' as const,
    desc: 'For the next [S20 / M40 / L60] minutes, Seekers can only turn right at street intersections.',
    costDesc: 'Discard 1 card from your hand.',
    seekerEffect: 'YOU HAVE BEEN CURSED! For the next [S20 / M40 / L60] minutes, you are ONLY allowed to turn right at street intersections. If you hit a dead end, you can do a full 180 after walking at least 1,000ft (304m).',
    dismissalDesc: 'Acknowledge right-turn only rules for the duration.',
    curseId: 'curse_17',
  },
  {
    title: 'Curse Of The Labyrinth',
    type: 'CURSE' as const,
    rarity: 'COMMON' as const,
    desc: 'Draw a solvable maze and send it. Seekers must solve it before asking another question.',
    costDesc: 'Spend up to [S10 / M20 / L30] minutes drawing a solvable maze on paper. No internet help.',
    seekerEffect: 'YOU HAVE BEEN CURSED! The Hiders drew a maze and uploaded a photo of it. You must solve it (draw the path through it) before you can ask another question.',
    dismissalDesc: 'Solve the maze and confirm with the hiders.',
    curseId: 'curse_18',
  },
  {
    title: 'Curse Of The Bird Guide',
    type: 'CURSE' as const,
    rarity: 'COMMON' as const,
    desc: 'Film a bird continuously for N minutes. Seekers must film a bird for the same duration or longer.',
    costDesc: 'Film a bird continuously for as long as possible (up to [S5 / M10 / L15] minutes). If the bird leaves the frame, the timer stops.',
    seekerEffect: 'YOU HAVE BEEN CURSED! The Hiders filmed a bird continuously for N seconds. You must find and film a bird in real life for the SAME duration or longer before you can ask another question.',
    dismissalDesc: 'Successfully film a bird for the target duration and verify.',
    curseId: 'curse_19',
  },
  {
    title: 'Curse Of Spotty Memory',
    type: 'CURSE' as const,
    rarity: 'COMMON' as const,
    desc: 'Disable a random question category. Seekers roll a die to determine which category is blocked after each question asked.',
    costDesc: 'Discard 1 TIME card from your hand.',
    seekerEffect: 'YOU HAVE BEEN CURSED! For the rest of the run, one random category of questions is disabled at all times. Roll a die to determine which category is locked. After asking your next question, roll again to block a new category.',
    dismissalDesc: 'Active persistent restriction (Acknowledge and roll).',
    curseId: 'curse_20',
  },
  {
    title: 'Curse Of The Lemon Phylactery',
    type: 'CURSE' as const,
    rarity: 'COMMON' as const,
    desc: 'Seekers must find a lemon and affix it to their outer clothing. If it falls, you get a major time bonus.',
    costDesc: 'Discard 1 POWERUP card from your hand. Cannot be played in the endgame.',
    seekerEffect: 'YOU HAVE BEEN CURSED! Each seeker must find a lemon and affix it securely to their outermost clothing or skin. If any lemon falls off or is detached before your run ends, the Hiders get an extra [S30 / M45 / L60] minutes!',
    dismissalDesc: 'Find a lemon, affix it, and verify you are wearing it.',
    curseId: 'curse_21',
  },
  {
    title: 'Curse Of The Drained Brain',
    type: 'CURSE' as const,
    rarity: 'COMMON' as const,
    desc: 'Choose three specific questions. Seekers are banned from asking them for the rest of the run.',
    costDesc: 'Discard your entire remaining hand of cards!',
    seekerEffect: 'YOU HAVE BEEN CURSED! The Hider has banned three specific question categories/types from being asked for the rest of this run.',
    dismissalDesc: 'Acknowledge three banned questions.',
    curseId: 'curse_22',
  },
  {
    title: 'Curse Of The Ransom Note',
    type: 'CURSE' as const,
    rarity: 'COMMON' as const,
    desc: 'Seekers must construct their next question physically out of letters and words cut from printed material (minimum 5 words).',
    costDesc: 'Spell out "Ransom Note" using a physical ransom note (letters cut out of paper) and verify.',
    seekerEffect: 'YOU HAVE BEEN CURSED! Your next question must be physically composed of letters and words cut out of printed materials (like newspapers, magazines, flyers). It must be coherent and contain at least 5 words. Upload a photo of the note to ask the question.',
    dismissalDesc: 'Construct a ransom note question and upload it as verification.',
    curseId: 'curse_23',
  },
  {
    title: 'Curse Of The Gambler\'s Feet',
    type: 'CURSE' as const,
    rarity: 'COMMON' as const,
    desc: 'For the next [S20 / M40 / L60] minutes, Seekers must roll a die before taking steps, and can only walk that many steps.',
    costDesc: 'Roll a die. If it lands on an EVEN number, this curse has no effect (card consumed). Otherwise, play it.',
    seekerEffect: 'YOU HAVE BEEN CURSED! For the next [S20 / M40 / L60] minutes, you must roll a die before taking steps. You can only walk the number of steps rolled, then you must roll again to continue walking!',
    dismissalDesc: 'Confirm you followed the gambler\'s feet walking rules for the duration.',
    curseId: 'curse_24',
  },
];

export const getBonusMinutesForSize = (rarity: CardRarity, size: GameSize): number => {
  switch (rarity) {
    case 'RED': return size === 'S' ? 2 : size === 'M' ? 3 : 5;
    case 'ORANGE': return size === 'S' ? 4 : size === 'M' ? 6 : 10;
    case 'YELLOW': return size === 'S' ? 6 : size === 'M' ? 9 : 15;
    case 'GREEN': return size === 'S' ? 8 : size === 'M' ? 12 : 20;
    case 'BLUE': return size === 'S' ? 12 : size === 'M' ? 18 : 30;
    default: return 0;
  }
};

export const getCurseValuesForSize = (curseId: string, size: GameSize): { value: number; unit: string } => {
  // Return specific values mentioned in spreadsheet for S, M, L
  switch (curseId) {
    case 'curse_3': // Endless Tumble: accidental hit award
      return { value: size === 'S' ? 10 : size === 'M' ? 20 : 30, unit: 'minutes' };
    case 'curse_6': // Mediocre Travel Agent: vacation duration and lost souvenir award
      return { value: size === 'S' ? 5 : size === 'M' ? 5 : 10, unit: 'minutes (Vacation)' }; // and penalty [S30, M45, L60]
    case 'curse_10': // Water Weight: lost water award
      return { value: size === 'S' ? 30 : size === 'M' ? 30 : 60, unit: 'minutes' };
    case 'curse_11': // Jammed Door: lock duration
      return { value: size === 'S' ? 30 : size === 'M' ? 60 : 180, unit: 'minutes' };
    case 'curse_15': // Egg partner: broken egg penalty
      return { value: size === 'S' ? 30 : size === 'M' ? 45 : 60, unit: 'minutes' };
    case 'curse_17': // Right turn: duration
      return { value: size === 'S' ? 20 : size === 'M' ? 40 : 60, unit: 'minutes' };
    case 'curse_21': // Lemon: fallen lemon penalty
      return { value: size === 'S' ? 30 : size === 'M' ? 45 : 60, unit: 'minutes' };
    case 'curse_24': // Gamblers feet: duration
      return { value: size === 'S' ? 20 : size === 'M' ? 40 : 60, unit: 'minutes' };
    default:
      return { value: 0, unit: '' };
  }
};

export const MATCHING_POIS = [
  'Commercial Airport', 'Transit Line', 'Station Name Length', 'Street or Path', 
  '1st Admin (State)', '2nd Admin (County)', '3rd Admin (City/Town)', '4th Admin (Borough)', 
  'Mountain', 'Landmass', 'Park', 'Amusement Park', 'Zoo', 'Aquarium', 
  'Golf Course', 'Museum', 'Movie Theatre', 'Hospital', 'Library', 'Foreign Consulate'
];

export const MEASURING_POIS = [
  'Commercial Airport', 'High Speed Train Line', 'Rail Station', 'International Border', 
  '1st Admin Border (State)', '2nd Admin Border (County)', '4th Admin Border (Borough)', 
  'Sea Level', 'Body of Water', 'Coastline', 'Mountain', 'Park', 'Amusement Park', 
  'Zoo', 'Aquarium', 'Golf Course', 'Museum', 'Movie Theatre', 'Hospital', 'Library', 'Foreign Consulate'
];

export const PHOTO_SUBJECTS = {
  S: [
    'A Tree (entire tree)', 'The Sky (shoot directly up)', 'You (Selfie mode, arm extended)', 
    'Widest Street (both sides)', 'Tallest structure in sightline', 'Any building visible from station'
  ],
  M: [
    'A Tree (entire tree)', 'The Sky (shoot directly up)', 'You (Selfie mode, arm extended)', 
    'Widest Street (both sides)', 'Tallest structure in sightline', 'Any building visible from station',
    'Tallest building visible from station', 'Trace Nearest Street/Path', 'Two Buildings', 
    'Restaurant Interior', 'Train Platform', 'Park', 'Grocery Store Aisle', 'Place of Worship'
  ],
  L: [
    'A Tree (entire tree)', 'The Sky (shoot directly up)', 'You (Selfie mode, arm extended)', 
    'Widest Street (both sides)', 'Tallest structure in sightline', 'Any building visible from station',
    'Tallest building visible from station', 'Trace Nearest Street/Path', 'Two Buildings', 
    'Restaurant Interior', 'Train Platform', 'Park', 'Grocery Store Aisle', 'Place of Worship',
    '1/2 Mile of streets traced', 'Tallest mountain visible from station', 'Biggest body of water in your zone', 'Five buildings'
  ]
};

export function getCurseDiscardRequirement(card: Card): { count: number; filterType?: 'TIME' | 'POWERUP'; desc: string } | null {
  if (card.type !== 'CURSE') return null;
  const curseId = card.curseId;
  if (curseId === 'curse_22') {
    return { count: -1, desc: 'Discard your entire remaining hand of other cards!' };
  }
  if (curseId === 'curse_20') {
    return { count: 1, filterType: 'TIME', desc: 'Discard 1 TIME card from your hand.' };
  }
  if (curseId === 'curse_21') {
    return { count: 1, filterType: 'POWERUP', desc: 'Discard 1 POWERUP card from your hand.' };
  }
  
  const cost = card.costDesc || '';
  if (cost.toLowerCase().includes('discard 2 cards')) {
    return { count: 2, desc: 'Discard 2 cards from your hand.' };
  }
  if (cost.toLowerCase().includes('discard 1 card')) {
    return { count: 1, desc: 'Discard 1 card from your hand.' };
  }
  return null;
}
