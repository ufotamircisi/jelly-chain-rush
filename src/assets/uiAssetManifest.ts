import logo from './ui/logo/jelly_chain_rush_logo.png';
import navPlay from './ui/nav/nav_icon_play.png';
import navIsland from './ui/nav/nav_icon_island.png';
import navMarket from './ui/nav/nav_icon_market.png';
import statEnergy from './ui/stats/icon_energy.png';
import statDiamond from './ui/stats/icon_diamond.png';
import statShake from './ui/stats/icon_shake.png';

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
  }
} as const;
