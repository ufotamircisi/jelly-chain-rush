import Phaser from 'phaser';
import './style.css';
import { MainScene } from './scenes/MainScene';

const params = new URLSearchParams(window.location.search);

if (params.has('buildingPreview')) {
  void import('./buildingPreview');
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
    scene: [MainScene]
  };

  new Phaser.Game(config);
}
