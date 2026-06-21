import yesilJelibonAyicik from './candies/yesil_jelibon_ayicik.png';
import morJelibon from './candies/mor_jelibon.png';
import kirmiziKalp from './candies/kirmizi_kalp.png';
import sariYildiz from './candies/sari_yildiz.png';
import maviSeker from './candies/mavi_seker.png';
import turuncuJellyBean from './candies/turuncu_jelly_bean.png';
import pembeLollipop from './candies/pembe_lollipop.png';
import gokkusagiSeker from './candies/gokkusagi_seker.png';
import enerjiYildizi from './candies/special/enerji_yildizi.png';
import renkBombasi from './candies/special/renk_bombasi.png';

export interface CandyAssetPreviewItem {
  name: string;
  path: string;
  src: string;
}

export const CANDY_ASSET_PACK: CandyAssetPreviewItem[] = [
  { name: 'yesil_jelibon_ayicik', path: 'src/assets/candies/yesil_jelibon_ayicik.png', src: yesilJelibonAyicik },
  { name: 'mor_jelibon', path: 'src/assets/candies/mor_jelibon.png', src: morJelibon },
  { name: 'kirmizi_kalp', path: 'src/assets/candies/kirmizi_kalp.png', src: kirmiziKalp },
  { name: 'sari_yildiz', path: 'src/assets/candies/sari_yildiz.png', src: sariYildiz },
  { name: 'mavi_seker', path: 'src/assets/candies/mavi_seker.png', src: maviSeker },
  { name: 'turuncu_jelly_bean', path: 'src/assets/candies/turuncu_jelly_bean.png', src: turuncuJellyBean },
  { name: 'pembe_lollipop', path: 'src/assets/candies/pembe_lollipop.png', src: pembeLollipop },
  { name: 'gokkusagi_seker', path: 'src/assets/candies/gokkusagi_seker.png', src: gokkusagiSeker },
  { name: 'enerji_yildizi', path: 'src/assets/candies/special/enerji_yildizi.png', src: enerjiYildizi },
  { name: 'renk_bombasi', path: 'src/assets/candies/special/renk_bombasi.png', src: renkBombasi }
];
