import React, { useEffect, useRef } from 'react';
import { RoomState, POI } from '../types';
import { getDistance, generateDynamicPOIs } from '../lib/geo';

declare const L: any; // Use global Leaflet from CDN

interface PoiIconInfo {
  bgColor: string;
  borderColor: string;
  svg: string;
}

function getPoiIconInfo(type: string, isVetoed: boolean): PoiIconInfo {
  const normType = type.toLowerCase();
  
  // Icon SVGs (standard lucide paths but simplified for embedding, with 14px size)
  const svgs = {
    plane: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3.5c-.5-.5-2.5 0-4 1.5L13.5 8.5 5.3 6.7c-.9-.2-1.8.3-2 1.2-.2.9.3 1.8 1.2 2l7.6 1.7-4.1 4.1-3.3-.8c-.7-.2-1.5.1-1.9.8-.3.6-.1 1.4.4 1.8l3.1 2.3c.5.4 1.2.5 1.8.2l2.3-3.1c.4-.5.3-1.3-.2-1.9l-.8-3.3 4.1-4.1 1.7 7.6c.2.9 1.1 1.4 2 1.2.9-.2 1.4-1.1 1.2-2z"/></svg>`,
    train: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4M8 12h8M12 2v10"/></svg>`,
    tree: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19 7-7H5l7 7zM12 2l7 7H5l7-7zM12 11l7 7H5l7-7zM12 19v3"/></svg>`,
    paw: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 10c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM5 10c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM19 10c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM12 19c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z"/></svg>`,
    fish: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 4.4 6 11 6 11s6-6.6 6-11z"/><circle cx="12" cy="8" r="3"/></svg>`,
    star: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    museum: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><path d="M12 2 3 7h18z"/></svg>`,
    book: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10M6 10h10"/></svg>`,
    film: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="15" x="2" y="3" rx="2.1"/><path d="M6 3v15M18 3v15M2 8h4M2 13h4M18 8h4M18 13h4"/></svg>`,
    hospital: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 8v8M8 12h8"/></svg>`,
    mountain: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>`,
    waves: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.6 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M2 12c.6.5 1.2 1 2.5 1 3 0 3-2 5.5-2 2.6 0 2.6 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M2 18c.6.5 1.2 1 2.5 1 3 0 3-2 5.5-2 2.6 0 2.6 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>`,
    compass: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
  };

  if (normType.includes('airport')) {
    return { bgColor: '#c084fc', borderColor: '#7e22ce', svg: svgs.plane };
  }
  if (normType.includes('rail') || normType.includes('train') || normType.includes('transit') || normType.includes('subway')) {
    return { bgColor: '#818cf8', borderColor: '#4f46e5', svg: svgs.train };
  }
  if (normType.includes('park') || normType.includes('golf') || normType.includes('landmass')) {
    return { bgColor: '#34d399', borderColor: '#059669', svg: svgs.tree };
  }
  if (normType.includes('zoo')) {
    return { bgColor: '#4ade80', borderColor: '#16a34a', svg: svgs.paw };
  }
  if (normType.includes('aquarium')) {
    return { bgColor: '#22d3ee', borderColor: '#0891b2', svg: svgs.fish };
  }
  if (normType.includes('amusement')) {
    return { bgColor: '#f472b6', borderColor: '#db2777', svg: svgs.star };
  }
  if (normType.includes('museum') || normType.includes('consulate')) {
    return { bgColor: '#fbbf24', borderColor: '#d97706', svg: svgs.museum };
  }
  if (normType.includes('library')) {
    return { bgColor: '#fb923c', borderColor: '#ea580c', svg: svgs.book };
  }
  if (normType.includes('theatre') || normType.includes('theater')) {
    return { bgColor: '#a78bfa', borderColor: '#7c3aed', svg: svgs.film };
  }
  if (normType.includes('hospital')) {
    return { bgColor: '#f43f5e', borderColor: '#e11d48', svg: svgs.hospital };
  }
  if (normType.includes('mountain')) {
    return { bgColor: '#60a5fa', borderColor: '#2563eb', svg: svgs.mountain };
  }
  if (normType.includes('water') || normType.includes('coast') || normType.includes('sea') || normType.includes('river') || normType.includes('ocean')) {
    return { bgColor: '#38bdf8', borderColor: '#0284c7', svg: svgs.waves };
  }

  // Fallback default
  return { bgColor: '#94a3b8', borderColor: '#475569', svg: svgs.compass };
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

function isPoiCategoryHighlighted(
  poiType: string,
  previewQType: string | null,
  previewMatchingPoi: string,
  previewTentaclePoi: string
): boolean {
  if (!previewQType) return true;
  if (previewQType === 'MATCHING') {
    return poiType.toLowerCase() === previewMatchingPoi.toLowerCase();
  }
  if (previewQType === 'TENTACLES') {
    const target = getTentaclePoiType(previewTentaclePoi).toLowerCase();
    if (target === 'rail station') {
      return (
        poiType.toLowerCase() === 'rail station' ||
        poiType.toLowerCase() === 'transit line' ||
        poiType.toLowerCase().includes('train')
      );
    }
    return poiType.toLowerCase().includes(target);
  }
  return true;
}

interface MapComponentProps {
  room: RoomState;
  userName: string;
  selectionMode: 'CUSTOM_PIN' | 'TRANSIT_PIN' | null;
  onPinDropped: (lat: number, lng: number) => void;
  onSetPinDirectly?: (lat: number, lng: number, pinType: 'CUSTOM' | 'TRANSIT') => void;
  customPin: { lat: number; lng: number } | null;
  transitPin: { lat: number; lng: number } | null;
  previewQType: 'MATCHING' | 'MEASURING' | 'THERMOMETER' | 'RADAR' | 'TENTACLES' | 'PHOTO' | null;
  previewMatchingPoi: string;
  previewRadarDistance: number;
  previewTentaclePoi: string;
  previewTentacleDistance: number;
}

export default function MapComponent({
  room,
  userName,
  selectionMode,
  onPinDropped,
  onSetPinDirectly,
  customPin,
  transitPin,
  previewQType,
  previewMatchingPoi,
  previewRadarDistance,
  previewTentaclePoi,
  previewTentacleDistance,
}: MapComponentProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Default view to game center
    const center: [number, number] = [room.centerLat, room.centerLng];
    const zoom = room.gameSize === 'S' ? 14 : room.gameSize === 'M' ? 12 : 9;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView(center, zoom);

    // CartoDB Dark Matter - Beautiful dark modern tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    layerGroupRef.current = L.layerGroup().addTo(map);

    // Setup interactive pin drop listener on click
    map.on('click', (e: any) => {
      if (selectionMode) {
        onPinDropped(e.latlng.lat, e.latlng.lng);
      }
    });

    // Clean up
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [room.centerLat, room.centerLng, room.gameSize]);

  // Re-enable click triggers if selection mode changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.off('click');
    map.on('click', (e: any) => {
      if (selectionMode) {
        onPinDropped(e.latlng.lat, e.latlng.lng);
      }
    });
  }, [selectionMode, onPinDropped]);

  // Fly/pan to customPin when it is placed or changed
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (customPin) {
      map.flyTo([customPin.lat, customPin.lng], map.getZoom() || 13, { duration: 1.5 });
    }
  }, [customPin]);

  // Redraw overlays whenever state, pins, or players change
  useEffect(() => {
    const map = mapRef.current;
    const layers = layerGroupRef.current;
    if (!map || !layers) return;

    // Clear previous elements
    layers.clearLayers();

    // Identify seeker team position
    const seekerTeam = room.teams.find((t) => t.role === 'SEEKER');
    const seekerLat = seekerTeam?.lat || room.centerLat;
    const seekerLng = seekerTeam?.lng || room.centerLng;

    // 1. Draw outer Game Area circular boundary
    L.circle([room.centerLat, room.centerLng], {
      radius: room.radiusMiles * 1609.34, // convert miles to meters
      color: '#38bdf8', // Neon Sky Blue
      weight: 2,
      fillColor: '#0c4a6e',
      fillOpacity: 0.05,
      dashArray: '5, 10',
    }).addTo(layers);

    // 2. Draw Active Grid Cells (Active = Neon Cyan, Inactive = completely empty/sliced)
    // To make it super fast, we only draw active cells
    const activeCells = room.grid.filter((cell) => cell.active);
    
    // Grid coordinate resolution calculations (approximate lat/lng box size)
    const N = 32;
    const milesPerDegreeLat = 69.0;
    const milesPerDegreeLng = 69.0 * Math.cos((room.centerLat * Math.PI) / 180);
    const cellLatSpan = (room.radiusMiles / milesPerDegreeLat) * 2 / (N - 1);
    const cellLngSpan = (room.radiusMiles / milesPerDegreeLng) * 2 / (N - 1);

    activeCells.forEach((cell) => {
      const bounds = [
        [cell.lat - cellLatSpan / 2, cell.lng - cellLngSpan / 2],
        [cell.lat + cellLatSpan / 2, cell.lng + cellLngSpan / 2],
      ];

      L.rectangle(bounds, {
        color: '#06b6d4', // cyan border
        weight: 0.5,
        fillColor: '#0891b2',
        fillOpacity: 0.18,
      }).addTo(layers);
    });

    // 3. Draw dynamic POIs if game is started
    if (room.gamePhase !== 'LOBBY') {
      const pois = room.pois && room.pois.length > 0
        ? room.pois
        : generateDynamicPOIs(room.centerLat, room.centerLng, room.radiusMiles);

      // Find closest POI of matching category to seeker if previewing MATCHING or TENTACLES
      let closestPoi: any = null;
      let minDistance = Infinity;
      if (previewQType === 'MATCHING') {
        const matchingPois = pois.filter((p) => p.type.toLowerCase() === previewMatchingPoi.toLowerCase());
        matchingPois.forEach((p) => {
          const d = getDistance(seekerLat, seekerLng, p.lat, p.lng);
          if (d < minDistance) {
            minDistance = d;
            closestPoi = p;
          }
        });
      } else if (previewQType === 'TENTACLES') {
        const targetType = getTentaclePoiType(previewTentaclePoi).toLowerCase();
        const tentaclePois = pois.filter((p) => {
          if (targetType === 'rail station') {
            return (
              p.type.toLowerCase() === 'rail station' ||
              p.type.toLowerCase() === 'transit line' ||
              p.type.toLowerCase().includes('train')
            );
          }
          return p.type.toLowerCase().includes(targetType);
        });
        tentaclePois.forEach((p) => {
          const d = getDistance(seekerLat, seekerLng, p.lat, p.lng);
          if (d < minDistance) {
            minDistance = d;
            closestPoi = p;
          }
        });
      }

      // Draw dashed line to closest if found
      if (closestPoi) {
        L.polyline([[seekerLat, seekerLng], [closestPoi.lat, closestPoi.lng]], {
          color: previewQType === 'MATCHING' ? '#fbbf24' : '#f43f5e',
          weight: 3,
          dashArray: '4, 8',
        })
          .bindTooltip(
            `Nearest ${previewQType === 'MATCHING' ? previewMatchingPoi : previewTentaclePoi} (${minDistance.toFixed(2)} mi)`,
            {
              permanent: true,
              direction: 'center',
              className: 'bg-slate-950/95 text-cyan-300 border border-cyan-500/20 px-2 py-1 rounded-lg text-[9px] font-bold font-mono',
            }
          )
          .addTo(layers);
      }

      pois.forEach((poi) => {
        const isVetoed = room.vetoedTypes.includes(poi.type);
        const iconInfo = getPoiIconInfo(poi.type, isVetoed);

        const isHighlighted = isPoiCategoryHighlighted(
          poi.type,
          previewQType,
          previewMatchingPoi,
          previewTentaclePoi
        );

        const isClosest = closestPoi && closestPoi.id === poi.id;

        let bgColor = iconInfo.bgColor;
        let borderColor = isVetoed ? '#ef4444' : '#ffffff';
        let opacity = isVetoed ? '0.3' : '1.0';
        let scaleClass = 'hover:scale-125';
        let filterStyle = '';
        let borderGlow = '';

        if (previewQType === 'MATCHING' || previewQType === 'TENTACLES') {
          if (isClosest) {
            borderColor = '#fbbf24';
            borderGlow = 'box-shadow: 0 0 12px #fbbf24, 0 0 4px #fbbf24;';
            scaleClass = 'scale-125 animate-bounce';
          } else if (!isHighlighted) {
            filterStyle = 'filter: grayscale(100%) contrast(70%);';
            opacity = '0.2';
          }
        }

        const markerIcon = L.divIcon({
          className: 'custom-poi-marker',
          html: `
            <div style="
              position: relative;
              display: flex;
              align-items: center;
              justify-content: center;
              width: 26px;
              height: 26px;
              border-radius: 9999px;
              border: 2px solid ${borderColor};
              background-color: ${isVetoed ? '#3f1f1f' : bgColor};
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.5);
              opacity: ${opacity};
              color: ${isVetoed ? '#fca5a5' : '#ffffff'};
              transition: transform 0.2s;
              ${filterStyle}
              ${borderGlow}
            " class="${scaleClass}">
              <div style="display: flex; align-items: center; justify-content: center;">
                ${iconInfo.svg}
              </div>
              ${isVetoed ? `
                <div style="
                  position: absolute;
                  top: 50%;
                  left: 0;
                  width: 100%;
                  height: 2px;
                  background-color: #ef4444;
                  transform: translateY(-50%) rotate(45deg);
                "></div>
              ` : ''}
            </div>
          `,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
          popupAnchor: [0, -13]
        });

        // Identify current player's team role for popup button checks
        const playerRecord = room.players.find((p) => p.name === userName);
        const playerTeam = playerRecord ? room.teams.find((t) => t.name === playerRecord.team) : null;
        const isHiderTeam = playerTeam?.role === 'HIDER';

        const marker = L.marker([poi.lat, poi.lng], { icon: markerIcon });
        
        let popupHtml = `
          <div style="background-color: #0f172a; color: #f1f5f9; font-family: sans-serif; padding: 4px; border-radius: 8px;">
            <b style="font-size: 11px; color: #ffffff; display: block; margin-bottom: 2px;">${poi.name}</b>
            <span style="font-size: 9px; color: #94a3b8; display: block;">Type: ${poi.type}${isVetoed ? ' <span style="color: #ef4444; font-weight: bold;">(VETOED)</span>' : ''}</span>
        `;

        let showPinBtn = false;
        let btnText = '📍 Set Pin';
        let pinType: 'CUSTOM' | 'TRANSIT' | null = null;

        if (selectionMode === 'TRANSIT_PIN' || (isHiderTeam && room.gamePhase === 'HIDING')) {
          showPinBtn = true;
          btnText = '📍 Set Transit Pin';
          pinType = 'TRANSIT';
        } else if (selectionMode === 'CUSTOM_PIN' || (!isHiderTeam && room.gamePhase === 'SEEKING')) {
          showPinBtn = true;
          btnText = '📍 Set Custom Pin';
          pinType = 'CUSTOM';
        }

        if (showPinBtn && pinType) {
          popupHtml += `
            <button id="poi-select-${poi.id}" style="
              margin-top: 8px;
              width: 100%;
              padding: 5px 10px;
              background-color: ${pinType === 'CUSTOM' ? '#fbbf24' : '#ec4899'};
              color: #0f172a;
              font-weight: 900;
              font-size: 9px;
              text-transform: uppercase;
              border-radius: 5px;
              border: none;
              cursor: pointer;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              text-align: center;
              display: block;
            ">
              ${btnText}
            </button>
          `;
        }

        popupHtml += `</div>`;

        marker.bindPopup(popupHtml, { className: 'custom-leaflet-popup' });
        
        marker.on('click', (e: any) => {
          if (selectionMode) {
            // Close the popup so we don't display it during confirmation
            marker.closePopup();
            const pinType = selectionMode === 'CUSTOM_PIN' ? 'CUSTOM' : 'TRANSIT';
            if (onSetPinDirectly) {
              onSetPinDirectly(poi.lat, poi.lng, pinType);
            }
          }
        });

        marker.on('popupopen', () => {
          const btn = document.getElementById(`poi-select-${poi.id}`);
          if (btn) {
            btn.onclick = (e) => {
              e.preventDefault();
              if (onSetPinDirectly && pinType) {
                onSetPinDirectly(poi.lat, poi.lng, pinType);
              } else {
                onPinDropped(poi.lat, poi.lng);
              }
              marker.closePopup();
            };
          }
        });

        marker.addTo(layers);
      });
    }

    // Identify current player's team role
    const playerRecord = room.players.find((p) => p.name === userName);
    const playerTeam = playerRecord ? room.teams.find((t) => t.name === playerRecord.team) : null;
    const isHiderTeam = playerTeam?.role === 'HIDER';

    // 4. Draw players/teams
    room.teams.forEach((team) => {
      if (!team.lat || !team.lng) return;

      const isCurrentHider = team.role === 'HIDER';

      // Hide the hider from seeker's screen completely during active game phases!
      if (isCurrentHider && !isHiderTeam && (room.gamePhase === 'HIDING' || room.gamePhase === 'SEEKING')) {
        // Hider is hidden from Seekers!
        return;
      }

      const color = isCurrentHider ? '#f43f5e' : '#3b82f6'; // Pink/Red for Hider, Blue for Seeker
      
      // Beautiful custom pulse marker
      L.circleMarker([team.lat, team.lng], {
        radius: 8,
        color: '#ffffff',
        weight: 2,
        fillColor: color,
        fillOpacity: 1.0,
      })
        .bindPopup(`<b>Team: ${team.name}</b><br/>Role: ${team.role}<br/>Players: ${team.players.join(', ')}`)
        .addTo(layers);

      // Pulse ring for the live hiding team
      if (isCurrentHider) {
        L.circle([team.lat, team.lng], {
          radius: 50,
          color: '#f43f5e',
          weight: 1,
          fillColor: '#f43f5e',
          fillOpacity: 0.1,
        }).addTo(layers);
      }
    });

    // 5. Draw Transit Station zone if selected (Mandatory hiding circle)
    // Only show the transit drop pin and zone to the Hider team so seekers don't know the exact zone center!
    const transitPinToDraw = isHiderTeam ? (transitPin || room.hidingStationPin) : null;
    if (transitPinToDraw) {
      const radiusMeters = room.gameSize === 'L' ? 800 : 400; // Small/Medium: 400m; Large: 800m
      L.circle([transitPinToDraw.lat, transitPinToDraw.lng], {
        radius: radiusMeters,
        color: '#ec4899', // Pink
        weight: 3,
        fillColor: '#f472b6',
        fillOpacity: 0.15,
        dashArray: '3, 6',
      })
        .bindPopup(`<b>Mandatory Hiding Zone</b><br/>Radius: ${radiusMeters}m around transit drop station`)
        .addTo(layers);

      // Star icon or pin marker at the transit center
      L.circleMarker([transitPinToDraw.lat, transitPinToDraw.lng], {
        radius: 6,
        color: '#ffffff',
        weight: 1.5,
        fillColor: '#db2777',
        fillOpacity: 1.0,
      }).addTo(layers);
    }

    // 6. Draw Custom Measuring Question pin if active
    const pinToDraw = customPin || room.activeQuestion?.customPin;
    if (pinToDraw) {
      L.circleMarker([pinToDraw.lat, pinToDraw.lng], {
        radius: 8,
        color: '#fbbf24', // Amber gold
        weight: 2,
        fillColor: '#f59e0b',
        fillOpacity: 1.0,
      })
        .bindPopup('<b>Custom Target Pin</b><br/>Used for Measuring comparison question')
        .addTo(layers);
    }

    // 7. Draw Thermometer Line if Seeker is tracking distance
    if (room.activeQuestion?.type === 'THERMOMETER' && room.activeQuestion.startPin) {
      const start = room.activeQuestion.startPin;
      const end = room.activeQuestion.endPin || seekerTeam; // default to seeker location

      if (end && end.lat && end.lng) {
        // Draw start pin
        L.circleMarker([start.lat, start.lng], {
          radius: 6,
          color: '#ffffff',
          weight: 1.5,
          fillColor: '#f97316', // Orange
          fillOpacity: 1.0,
        }).addTo(layers);

        // Draw line tracking path
        L.polyline([[start.lat, start.lng], [end.lat, end.lng]], {
          color: '#f97316',
          weight: 3,
          dashArray: '5, 5',
        }).addTo(layers);
      }
    }

    // 8. Draw active Radar Question circle if in preview or pending
    const radarDistValue = room.activeQuestion?.type === 'RADAR'
      ? room.activeQuestion.distanceValue
      : (previewQType === 'RADAR' ? previewRadarDistance : null);

    if (radarDistValue) {
      const radiusM = radarDistValue * 1609.34;
      L.circle([seekerLat, seekerLng], {
        radius: radiusM,
        color: '#a855f7', // Purple
        weight: 2,
        fillColor: '#a855f7',
        fillOpacity: 0.1,
        dashArray: room.activeQuestion?.type === 'RADAR' ? undefined : '3, 6',
      })
        .bindTooltip(`Radar Circle (${radarDistValue} mi)`, { sticky: true, className: 'bg-slate-950 text-purple-300 border border-purple-500/20 text-[9px] px-2 py-1 rounded-lg' })
        .addTo(layers);
    }

    // 9. Draw active Tentacles Question circle
    const tentaclesDistValue = room.activeQuestion?.type === 'TENTACLES'
      ? room.activeQuestion.distanceValue
      : (previewQType === 'TENTACLES' ? previewTentacleDistance : null);

    if (tentaclesDistValue) {
      const radiusM = tentaclesDistValue * 1609.34;
      L.circle([seekerLat, seekerLng], {
        radius: radiusM,
        color: '#e11d48', // Rose
        weight: 2,
        fillColor: '#f43f5e',
        fillOpacity: 0.08,
        dashArray: room.activeQuestion?.type === 'TENTACLES' ? undefined : '3, 6',
      })
        .bindTooltip(`Tentacles Circle (${tentaclesDistValue} mi)`, { sticky: true, className: 'bg-slate-950 text-rose-300 border border-rose-500/20 text-[9px] px-2 py-1 rounded-lg' })
        .addTo(layers);
    }

  }, [
    room,
    userName,
    customPin,
    transitPin,
    selectionMode,
    previewQType,
    previewMatchingPoi,
    previewRadarDistance,
    previewTentaclePoi,
    previewTentacleDistance
  ]);

  return (
    <div className="relative w-full h-full min-h-full md:min-h-[400px] md:rounded-2xl overflow-hidden md:border md:border-slate-800 md:shadow-2xl">
      <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: '100%' }} />

      {selectionMode && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-slate-900/90 backdrop-blur-md border border-amber-500/50 px-4 py-2 rounded-full text-sm font-medium text-amber-300 shadow-lg z-[1000] flex items-center space-x-2 animate-pulse">
          <span>📍 Click on the map to drop the {selectionMode === 'CUSTOM_PIN' ? 'Target Pin' : 'Transit Drop Pin'}</span>
        </div>
      )}
    </div>
  );
}
