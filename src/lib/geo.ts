import { GridCell, POI } from '../types';

// Standard Haversine distance in miles
export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

export function isPointInPolygon(point: { lat: number; lng: number }, polygon: { lat: number; lng: number }[]): boolean {
  if (polygon.length < 3) return false;
  const x = point.lng;
  const y = point.lat;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Generate an N x N grid inside a bounding box, clipping to a circular radius or a custom polygon
export function generateGrid(
  centerLat: number,
  centerLng: number,
  radiusMiles: number,
  customPolygon?: { lat: number; lng: number }[]
): GridCell[] {
  const grid: GridCell[] = [];
  const N = 32; // 32x32 = 1024 cells, perfect balance of fidelity & rendering speed

  if (customPolygon && customPolygon.length >= 3) {
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    for (const p of customPolygon) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    }

    for (let i = 0; i < N; i++) {
      const lat = minLat + (i / (N - 1)) * (maxLat - minLat);
      for (let j = 0; j < N; j++) {
        const lng = minLng + (j / (N - 1)) * (maxLng - minLng);
        const inside = isPointInPolygon({ lat, lng }, customPolygon);
        grid.push({
          id: `cell_${i}_${j}`,
          lat,
          lng,
          active: inside,
        });
      }
    }
    return grid;
  }

  // Approximate degree conversion
  const milesPerDegreeLat = 69.0;
  const milesPerDegreeLng = 69.0 * Math.cos((centerLat * Math.PI) / 180);

  const latSpan = radiusMiles / milesPerDegreeLat;
  const lngSpan = radiusMiles / milesPerDegreeLng;

  const minLat = centerLat - latSpan;
  const maxLat = centerLat + latSpan;
  const minLng = centerLng - lngSpan;
  const maxLng = centerLng + lngSpan;

  for (let i = 0; i < N; i++) {
    const lat = minLat + (i / (N - 1)) * (maxLat - minLat);
    for (let j = 0; j < N; j++) {
      const lng = minLng + (j / (N - 1)) * (maxLng - minLng);
      const d = getDistance(centerLat, centerLng, lat, lng);
      
      grid.push({
        id: `cell_${i}_${j}`,
        lat,
        lng,
        active: d <= radiusMiles, // starts active if inside the circular game boundaries
      });
    }
  }

  return grid;
}

// 1. MATCHING: Voronoi tessellation logic
// If YES: keep cells where Seeker's closest POI is the cell's closest POI
// If NO: eliminate cells where Seeker's closest POI is the cell's closest POI
export function cutMatching(
  grid: GridCell[],
  pois: POI[],
  answerIsSame: boolean,
  seekerLat: number,
  seekerLng: number
): GridCell[] {
  if (pois.length === 0) return grid;

  // Find Seeker's closest POI
  let seekerClosestPoi: POI = pois[0];
  let minSeekerDist = Infinity;
  for (const poi of pois) {
    const d = getDistance(seekerLat, seekerLng, poi.lat, poi.lng);
    if (d < minSeekerDist) {
      minSeekerDist = d;
      seekerClosestPoi = poi;
    }
  }

  return grid.map((cell) => {
    if (!cell.active) return cell;

    // Find cell's closest POI
    let cellClosestPoi: POI = pois[0];
    let minCellDist = Infinity;
    for (const poi of pois) {
      const d = getDistance(cell.lat, cell.lng, poi.lat, poi.lng);
      if (d < minCellDist) {
        minCellDist = d;
        cellClosestPoi = poi;
      }
    }

    const isSamePoi = cellClosestPoi.id === seekerClosestPoi.id;
    const shouldKeep = answerIsSame ? isSamePoi : !isSamePoi;

    return {
      ...cell,
      active: shouldKeep,
    };
  });
}

// 2. MEASURING: Perpendicular bisector slice between Seeker and Custom Pin
// Keeps the half plane containing the Hider
export function cutMeasuring(
  grid: GridCell[],
  seekerLat: number,
  seekerLng: number,
  pinLat: number,
  pinLng: number,
  hiderLat: number,
  hiderLng: number
): GridCell[] {
  // Determine if Hider is closer to Seeker or to the Custom Pin
  const hiderDistToSeeker = getDistance(hiderLat, hiderLng, seekerLat, seekerLng);
  const hiderDistToPin = getDistance(hiderLat, hiderLng, pinLat, pinLng);
  const hiderIsCloserToSeeker = hiderDistToSeeker < hiderDistToPin;

  return grid.map((cell) => {
    if (!cell.active) return cell;

    const cellDistToSeeker = getDistance(cell.lat, cell.lng, seekerLat, seekerLng);
    const cellDistToPin = getDistance(cell.lat, cell.lng, pinLat, pinLng);
    const cellIsCloserToSeeker = cellDistToSeeker < cellDistToPin;

    const shouldKeep = hiderIsCloserToSeeker === cellIsCloserToSeeker;

    return {
      ...cell,
      active: shouldKeep,
    };
  });
}

// 3. THERMOMETER: Slice by bisector between Start Pin and End Pin (Seeker current)
// If HOTTER: keep area closer to End Pin (Seeker current)
// If COLDER: keep area closer to Start Pin
export function cutThermometer(
  grid: GridCell[],
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  isHotter: boolean
): GridCell[] {
  return grid.map((cell) => {
    if (!cell.active) return cell;

    const cellDistToStart = getDistance(cell.lat, cell.lng, startLat, startLng);
    const cellDistToEnd = getDistance(cell.lat, cell.lng, endLat, endLng);

    const cellIsCloserToEnd = cellDistToEnd < cellDistToStart;
    const shouldKeep = isHotter ? cellIsCloserToEnd : !cellIsCloserToEnd;

    return {
      ...cell,
      active: shouldKeep,
    };
  });
}

// 4. RADAR: Circle Boolean
// If YES: intersection of current area and circle
// If NO: subtract circle from current area
export function cutRadar(
  grid: GridCell[],
  seekerLat: number,
  seekerLng: number,
  radiusMiles: number,
  answerIsWithin: boolean
): GridCell[] {
  return grid.map((cell) => {
    if (!cell.active) return cell;

    const d = getDistance(cell.lat, cell.lng, seekerLat, seekerLng);
    const isInsideCircle = d <= radiusMiles;

    const shouldKeep = answerIsWithin ? isInsideCircle : !isInsideCircle;

    return {
      ...cell,
      active: shouldKeep,
    };
  });
}

// 5. TENTACLES: POIs within circle of radius R
// If Hider is OUTSIDE the circle: eliminate the circle
// If Hider is INSIDE: restrict map to circle, and then restrict to the specific Voronoi cell Hider is inside
export function cutTentacles(
  grid: GridCell[],
  seekerLat: number,
  seekerLng: number,
  radiusMiles: number,
  hiderLat: number,
  hiderLng: number,
  allPois: POI[]
): { grid: GridCell[]; hiderStatusDesc: string } {
  const hiderDistToSeeker = getDistance(hiderLat, hiderLng, seekerLat, seekerLng);
  const hiderIsInsideCircle = hiderDistToSeeker <= radiusMiles;

  if (!hiderIsInsideCircle) {
    // Eliminate circle from Game Area
    const newGrid = grid.map((cell) => {
      if (!cell.active) return cell;
      const d = getDistance(cell.lat, cell.lng, seekerLat, seekerLng);
      return {
        ...cell,
        active: d > radiusMiles,
      };
    });
    return {
      grid: newGrid,
      hiderStatusDesc: 'Hider is OUTSIDE the tentacle circle! The circle is eliminated.',
    };
  }

  // Hider is INSIDE the circle. Restrict game area to this circle.
  let newGrid = grid.map((cell) => {
    if (!cell.active) return cell;
    const d = getDistance(cell.lat, cell.lng, seekerLat, seekerLng);
    return {
      ...cell,
      active: d <= radiusMiles,
    };
  });

  // Filter POIs that are within the circle
  const poisInCircle = allPois.filter(
    (poi) => getDistance(seekerLat, seekerLng, poi.lat, poi.lng) <= radiusMiles
  );

  if (poisInCircle.length === 0) {
    return {
      grid: newGrid,
      hiderStatusDesc: 'Hider is INSIDE the circle, but no POIs found in radius!',
    };
  }

  // Find which POI in the circle is closest to Hider
  let hiderClosestPoi: POI = poisInCircle[0];
  let minHiderDist = Infinity;
  for (const poi of poisInCircle) {
    const d = getDistance(hiderLat, hiderLng, poi.lat, poi.lng);
    if (d < minHiderDist) {
      minHiderDist = d;
      hiderClosestPoi = poi;
    }
  }

  // The grid area becomes the specific Voronoi cell of hiderClosestPoi
  newGrid = newGrid.map((cell) => {
    if (!cell.active) return cell;

    // Find cell's closest POI among those in the circle
    let cellClosestPoi: POI = poisInCircle[0];
    let minCellDist = Infinity;
    for (const poi of poisInCircle) {
      const d = getDistance(cell.lat, cell.lng, poi.lat, poi.lng);
      if (d < minCellDist) {
        minCellDist = d;
        cellClosestPoi = poi;
      }
    }

    return {
      ...cell,
      active: cellClosestPoi.id === hiderClosestPoi.id,
    };
  });

  return {
    grid: newGrid,
    hiderStatusDesc: `Hider is INSIDE the circle, closest to: "${hiderClosestPoi.name}"!`,
  };
}

// Generate random points (POIs) inside a radius or polygon around a center coordinate to simulate the city landmarks dynamically.
export function generateDynamicPOIs(
  centerLat: number,
  centerLng: number,
  radiusMiles: number,
  customPolygon?: { lat: number; lng: number }[]
): POI[] {
  const pois: POI[] = [];
  const poiTypes = [
    'Commercial Airport', 'Transit Line', 'Street or Path', '1st Admin (State)', 
    '2nd Admin (County)', '3rd Admin (City/Town)', '4th Admin (Borough)', 'Mountain', 
    'Landmass', 'Park', 'Amusement Park', 'Zoo', 'Aquarium', 'Golf Course', 
    'Museum', 'Movie Theatre', 'Hospital', 'Library', 'Foreign Consulate',
    'High Speed Train Line', 'Rail Station', 'International Border', 'Coastline', 'Body of Water'
  ];

  // Specific high-profile names for landmarks based on the type
  const namesByType: Record<string, string[]> = {
    'Commercial Airport': ['International Airport', 'Metro Airfield', 'Central Heliport', 'County Executive Airport'],
    'Transit Line': ['Red Line Metro', 'Blue Line Express', 'Amtrak Corridor', 'Downtown Trolley Loop'],
    'Rail Station': ['Union Terminal', 'Central Grand Station', 'North Platform Hub', 'Transit Crossing'],
    'Park': ['Centennial Park', 'Greenwood Conservatory', 'Riverfront Meadow', 'Memorial Botanical Gardens'],
    'Museum': ['Museum of Modern Art', 'Natural History Exhibition', 'Tech & Science Pavilion', 'Historical Heritage Gallery'],
    'Hospital': ['Saint Jude Medical Center', 'County General Hospital', 'Children\'s Memorial Clinic', 'Mercy Urgent Care'],
    'Library': ['Central Public Archive', 'Carnegie Reading Room', 'Westside Library Depot', 'University Science Library'],
    'Zoo': ['Wild Safari Park', 'Metropolitan Zoological Gardens', 'City Bird Sanctuary'],
    'Aquarium': ['Oceanic Deep Life Center', 'Aquatic Bay Aquarium', 'Coral Marine Conservatory'],
    'Amusement Park': ['Whirlwind Thrill Kingdom', 'Adventure Bay Boardwalk', 'Fantasy Theme Lands'],
    'Movie Theatre': ['Cinema Odyssey Complex', 'Regal Plaza Screens', 'Metro IMAX Theater'],
    'Foreign Consulate': ['Consulate General of Japan', 'Embassy Annex of France', 'Consulate Office of Germany'],
    'Golf Course': ['Highland Country Club', 'Rolling Hills Golf Green', 'Riverway Championship Links'],
    'Mountain': ['Summit Peak Peak', 'Observation Ridge', 'Pine Creek Overlook'],
  };

  const defaultNames = ['Central Landmark', 'Scenic Point', 'Historical Plaque', 'Community Plaza', 'Public Pavilion'];

  // Calculate polygon bounding box if applicable
  let usePolygon = false;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  if (customPolygon && customPolygon.length >= 3) {
    usePolygon = true;
    for (const p of customPolygon) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    }
  }

  // Seed about 4-6 POIs per category to ensure beautiful Voronoi cuts
  let idCount = 1;
  for (const type of poiTypes) {
    const qty = type === 'Commercial Airport' || type === 'Zoo' || type === 'Aquarium' ? 3 : 5;
    const names = namesByType[type] || defaultNames;

    for (let i = 0; i < qty; i++) {
      let lat = centerLat;
      let lng = centerLng;

      if (usePolygon && customPolygon) {
        // Generate inside bounding box and filter by polygon
        let found = false;
        for (let attempt = 0; attempt < 50; attempt++) {
          const randLat = minLat + Math.random() * (maxLat - minLat);
          const randLng = minLng + Math.random() * (maxLng - minLng);
          if (isPointInPolygon({ lat: randLat, lng: randLng }, customPolygon)) {
            lat = randLat;
            lng = randLng;
            found = true;
            break;
          }
        }
        if (!found) {
          // Fallback: pick a random vertex from the polygon
          const vertex = customPolygon[Math.floor(Math.random() * customPolygon.length)];
          lat = vertex.lat + (Math.random() - 0.5) * 0.005;
          lng = vertex.lng + (Math.random() - 0.5) * 0.005;
        }
      } else {
        // Generate coordinates around center within radiusMiles
        const u = Math.random();
        const v = Math.random();
        const r = (radiusMiles * Math.sqrt(u)) / 69.0; // latitude degree scale
        const theta = v * 2 * Math.PI;

        const dLat = r * Math.sin(theta);
        const dLng = (r * Math.cos(theta)) / Math.cos((centerLat * Math.PI) / 180);

        lat = centerLat + dLat;
        lng = centerLng + dLng;
      }

      const suffix = names[i % names.length];
      const name = qty > 1 ? `${type} - ${suffix}` : `${type} ${suffix}`;

      pois.push({
        id: `poi_${idCount++}`,
        name,
        lat,
        lng,
        type,
      });
    }
  }

  return pois;
}
