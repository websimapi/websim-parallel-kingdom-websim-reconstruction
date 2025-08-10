const { useState, useEffect, useSyncExternalStore, useMemo, useCallback } = React;
import { GAME_CONFIG } from './game-config.js';

const room = new WebsimSocket();

// --- Main App Component ---
function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  
  useEffect(() => {
    async function initialize() {
      await room.initialize();
      
      const myId = room.clientId;
      const me = room.presence[myId];

      if (!me) {
        const startPos = { lat: 34.0522, lng: -118.2437 }; // Downtown LA
        room.updatePresence({
          lat: startPos.lat,
          lng: startPos.lng,
          inventory: {},
          lastJumpTime: 0,
        });
      }
      
      // The first player to join initializes the resources
      if (Object.keys(room.roomState).length === 0) {
        console.log("First player! Initializing world state...");
        initializeWorldState();
      }

      setIsInitialized(true);
    }
    initialize();
  }, []);

  if (!isInitialized) {
    return <div>Loading Parallel Kingdom...</div>;
  }

  return <Game />;
}

// --- Game Logic and State Management ---
function initializeWorldState() {
  const initialResources = {};
  const bounds = {
    minLat: 34.04,
    maxLat: 34.06,
    minLng: -118.26,
    maxLng: -118.23,
  };
  const numResources = 100;

  for (let i = 0; i < numResources; i++) {
    const id = `res_${Date.now()}_${i}`;
    const lat = bounds.minLat + Math.random() * (bounds.maxLat - bounds.minLat);
    const lng = bounds.minLng + Math.random() * (bounds.maxLng - bounds.minLng);
    const type = GAME_CONFIG.resources.types[Math.floor(Math.random() * GAME_CONFIG.resources.types.length)];
    
    initialResources[id] = { id, lat, lng, type: type.id };
  }

  room.updateRoomState({ resources: initialResources });
}

function haversineDistance(coords1, coords2) {
    const toRad = x => x * Math.PI / 180;
    const R = 6371e3; // metres

    const dLat = toRad(coords2.lat - coords1.lat);
    const dLon = toRad(coords2.lng - coords1.lng);
    const lat1 = toRad(coords1.lat);
    const lat2 = toRad(coords2.lat);

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
}


// --- Game Component ---
function Game() {
  const presence = useSyncExternalStore(room.subscribePresence, () => room.presence);
  const roomState = useSyncExternalStore(room.subscribeRoomState, () => room.roomState);
  
  const [targetCoords, setTargetCoords] = useState(null);
  
  const myPresence = presence[room.clientId];
  const myPos = myPresence ? { lat: myPresence.lat, lng: myPresence.lng } : null;

  const handleMapClick = useCallback((coords) => {
    setTargetCoords(coords);
  }, []);

  const handleGather = useCallback((resourceId) => {
    if (!myPos) return;

    const resource = roomState.resources[resourceId];
    if (!resource) return;

    const distance = haversineDistance(myPos, resource);

    if (distance <= GAME_CONFIG.map.interactionRadiusMeters) {
        const resourceType = GAME_CONFIG.resources.types.find(t => t.id === resource.type);
        if (!resourceType) return;

        const newInventory = { ...myPresence.inventory };
        newInventory[resource.type] = (newInventory[resource.type] || 0) + 1;
        
        room.updatePresence({ inventory: newInventory });
        room.updateRoomState({ resources: { [resourceId]: null } }); // Remove resource
        console.log(`Gathered ${resource.type}!`);
    } else {
        alert("You are too far away to gather this resource.");
    }
  }, [myPos, myPresence, roomState.resources]);


  const players = useMemo(() => {
    return Object.entries(presence).map(([id, data]) => ({
      id,
      ...data,
      ...room.peers[id]
    }));
  }, [presence]);

  const resources = roomState.resources ? Object.values(roomState.resources) : [];

  return (
    <div className="game-container">
      <MapComponent
        players={players}
        resources={resources}
        myPos={myPos}
        targetCoords={targetCoords}
        onMapClick={handleMapClick}
        onGather={handleGather}
      />
      {myPresence && (
        <UIComponent
          presence={myPresence}
          targetCoords={targetCoords}
          clearTarget={() => setTargetCoords(null)}
        />
      )}
    </div>
  );
}

// --- UI Component ---
function UIComponent({ presence, targetCoords, clearTarget }) {
  const { inventory, lastJumpTime } = presence;
  const cooldown = GAME_CONFIG.player.movement.desktop.cooldownSeconds;
  const [time, setTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeSinceLastJump = (time - (lastJumpTime || 0)) / 1000;
  const isCooledDown = timeSinceLastJump >= cooldown;
  const cooldownRemaining = Math.max(0, cooldown - timeSinceLastJump).toFixed(0);

  const handleJump = () => {
    if (!targetCoords || !isCooledDown) return;
    room.updatePresence({
      lat: targetCoords.lat,
      lng: targetCoords.lng,
      lastJumpTime: Date.now(),
    });
    clearTarget();
  };
  
  const inventoryItems = Object.entries(inventory || {});

  return (
    <div className="ui-container">
      <h3>Inventory</h3>
      {inventoryItems.length > 0 ? (
        <div className="inventory-grid">
          {inventoryItems.map(([name, quantity]) => (
            <div key={name} className="inventory-item">
              <div className="item-name">{name}</div>
              <div className="item-quantity">{quantity}</div>
            </div>
          ))}
        </div>
      ) : (
        <p>Your inventory is empty.</p>
      )}

      {targetCoords && (
        <div className="jump-info">
            <p>Jump target selected.</p>
            <button
                className="action-button"
                onClick={handleJump}
                disabled={!isCooledDown}
            >
                {isCooledDown ? "Jump Now" : `Jumping... (${cooldownRemaining}s)`}
            </button>
        </div>
      )}
    </div>
  );
}

// --- Map Component ---
function MapComponent({ players, resources, myPos, targetCoords, onMapClick, onGather }) {
  const mapRef = React.useRef(null);
  const playerMarkersRef = React.useRef({});
  const resourceMarkersRef = React.useRef({});
  const targetMarkerRef = React.useRef(null);

  // Initialize map
  useEffect(() => {
    if (mapRef.current) return; // already initialized
    
    const map = L.map('map').setView([myPos.lat, myPos.lng], GAME_CONFIG.map.zoomLevels.default);
    mapRef.current = map;

    L.tileLayer(GAME_CONFIG.map.tileSource, {
      attribution: GAME_CONFIG.map.tileAttribution,
      minZoom: GAME_CONFIG.map.zoomLevels.min,
      maxZoom: GAME_CONFIG.map.zoomLevels.max,
    }).addTo(map);

    map.on('click', (e) => {
      onMapClick(e.latlng);
    });

    return () => {
        map.remove();
        mapRef.current = null;
    };
  }, []);

  // Center map on player
  useEffect(() => {
      if(mapRef.current && myPos) {
          mapRef.current.panTo([myPos.lat, myPos.lng], { animate: true });
      }
  }, [myPos?.lat, myPos?.lng]);

  // Update player markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentPlayerIds = new Set(players.map(p => p.id));

    // Update existing or add new markers
    players.forEach(player => {
      if (!player.lat || !player.lng) return;

      const pos = [player.lat, player.lng];
      if (playerMarkersRef.current[player.id]) {
        playerMarkersRef.current[player.id].setLatLng(pos);
      } else {
        const icon = L.icon({
            iconUrl: player.avatarUrl,
            iconSize: [38, 38],
            className: 'leaflet-marker-icon'
        });
        const marker = L.marker(pos, { icon }).addTo(map);
        marker.bindPopup(`<b>${player.username}</b>`);
        playerMarkersRef.current[player.id] = marker;
      }
    });

    // Remove markers for disconnected players
    Object.keys(playerMarkersRef.current).forEach(id => {
      if (!currentPlayerIds.has(id)) {
        playerMarkersRef.current[id].remove();
        delete playerMarkersRef.current[id];
      }
    });
  }, [players]);

  // Update resource markers
  useEffect(() => {
    const map = mapRef.current;
    if(!map) return;
    
    const currentResourceIds = new Set(resources.map(r => r.id));

    resources.forEach(res => {
        if(resourceMarkersRef.current[res.id]) return;

        const resType = GAME_CONFIG.resources.types.find(t => t.id === res.type);
        if(!resType) return;
        
        const icon = L.divIcon({
            html: resType.icon,
            className: 'resource-icon',
            iconSize: [24, 24]
        });

        const marker = L.marker([res.lat, res.lng], { icon }).addTo(map);
        marker.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            onGather(res.id);
        });
        resourceMarkersRef.current[res.id] = marker;
    });

    // Remove gathered resources
    Object.keys(resourceMarkersRef.current).forEach(id => {
        if(!currentResourceIds.has(id)) {
            resourceMarkersRef.current[id].remove();
            delete resourceMarkersRef.current[id];
        }
    });

  }, [resources, onGather]);
  
  // Update target marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (targetCoords) {
        if (targetMarkerRef.current) {
            targetMarkerRef.current.setLatLng(targetCoords);
        } else {
            targetMarkerRef.current = L.circleMarker(targetCoords, {
                color: '#00ffff',
                radius: 10,
                fillOpacity: 0.5,
                dashArray: '5, 5'
            }).addTo(map);
        }
    } else {
        if (targetMarkerRef.current) {
            targetMarkerRef.current.remove();
            targetMarkerRef.current = null;
        }
    }
  }, [targetCoords]);


  return <div id="map"></div>;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

