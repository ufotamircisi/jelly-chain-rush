import logo from './ui/logo/jelly_chain_rush_logo.png';
import navPlay from './ui/nav/nav_icon_play.png';
import navIsland from './ui/nav/nav_icon_island.png';
import navMarket from './ui/nav/nav_icon_market.png';
import statEnergy from './ui/stats/icon_energy.png';
import statDiamond from './ui/stats/icon_diamond.png';
import statShake from './ui/stats/icon_shake.png';
import levelRoadMap from './ui/level-road/level_road_map.png';
import levelNodeDefault from './ui/level-road/level_node_default.png';
import levelNodeCompleted from './ui/level-road/level_node_completed.png';
import levelNodeLocked from './ui/level-road/level_node_locked.png';
import superChest from './rewards/super-chest.png';

export const UI_ASSETS = {
  logo,
  nav: {
    play: navPlay,
    island: navIsland,
    market: navMarket
  },
  stats: {
    energy: statEnergy,
    diamond: statDiamond,
    shake: statShake
  },
  levelRoad: {
    map: levelRoadMap,
    nodeDefault: levelNodeDefault,
    nodeCompleted: levelNodeCompleted,
    nodeLocked: levelNodeLocked
  },
  rewards: {
    superChest
  }
} as const;
