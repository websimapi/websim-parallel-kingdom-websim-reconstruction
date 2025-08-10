export const GAME_CONFIG = {
  "gameTitle": "Parallel Kingdom (WebSim Reconstruction)",
  "version": "1.0",
  "coreConcept": {
    "description": "A persistent, massively multiplayer online role-playing game that uses the player's real-world GPS position to place their avatar in a fantasy overlay on a live map. Players gather resources, fight monsters, build structures, claim territory, craft equipment, trade with others, and engage in both PvE and PvP interactions. The world is persistent — all player actions alter the shared game world for everyone.",
    "playModes": ["mobileGPS", "desktopJumpSystem"],
    "coordinateSystem": {
      "type": "latLong",
      "normalization": "gridSnap",
      "gridCellSizeMeters": 10
    },
    "sessionPersistence": true,
    "maxConcurrentPlayersPerRegion": 200
  },
  "map": {
    "tileSource": "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    "tileAttribution": '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    "zoomLevels": { "min": 14, "max": 19, "default": 17 },
    "interactionRadiusMeters": 50,
  },
  "player": {
    "movement": {
      "desktop": { "mode": "JumpSystem", "jumpCost": { "food": 0 }, "cooldownSeconds": 5 },
    },
    "baseStats": { "level": 1, "xp": 0, "maxHP": 100, "attack": 10, "defense": 5, "speed": 1.0 },
    "inventory": { "capacity": 50 }
  },
  "resources": {
    "spawnLogic": {
      "spawnRatePerKm2": 20,
      "respawnMinutes": 5,
    },
    "types": [
      { "id": "wood", "source": "tree", "icon": "🌳", "gatherXP": 5 },
      { "id": "stone", "source": "rock", "icon": "🪨", "gatherXP": 6 },
      { "id": "ore", "source": "oreVein", "icon": "⛏️", "gatherXP": 8 },
      { "id": "herb", "source": "plant", "icon": "🌿", "gatherXP": 4 }
    ]
  },
};

