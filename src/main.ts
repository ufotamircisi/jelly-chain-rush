import Phaser from 'phaser';
import './style.css';
import { MainScene } from './scenes/MainScene';

const params = new URLSearchParams(window.location.search);

if (params.has('buildingPreview')) {
  void import('./buildingPreview');
} else if (params.has('islandPreview')) {
  void import('./islandPreview');
} else if (params.has('assetPreview')) {
  void import('./assetPreview');
} else {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'game',
    width: 380,
    height: 380,
    transparent: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    render: {
      antialias: true,
      antialiasGL: true,
      pixelArt: false
    },
    scene: [MainScene]
  };
  // `resolution` is removed from Phaser 3.60+ types but still honoured at runtime
  // in most builds. Cap at 3 so high-DPR Android devices (2.5x-3x) render sharp
  // candy textures without an excessive render-buffer size.
  (config as Record<string, unknown>)['resolution'] = Math.min(window.devicePixelRatio || 1, 3);

  new Phaser.Game(config);
}
