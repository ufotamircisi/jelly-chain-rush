import ruinedSekerTezgahi from './buildings/ruined/seker_tezgahi.png';
import ruinedJelibonStandi from './buildings/ruined/jelibon_standi.png';
import ruinedLollipopArabasi from './buildings/ruined/lollipop_arabasi.png';
import ruinedDondurmaBufesi from './buildings/ruined/dondurma_bufesi.png';
import ruinedSekerDukkani from './buildings/ruined/seker_dukkani.png';
import ruinedMarshmallowEvi from './buildings/ruined/marshmallow_evi.png';
import ruinedKaramelAtolyesi from './buildings/ruined/karamel_atolyesi.png';
import ruinedJelibonAtolyesi from './buildings/ruined/jelibon_atolyesi.png';
import ruinedRenkKaristirmaLaboratuvari from './buildings/ruined/renk_karistirma_laboratuvari.png';
import ruinedEnerjiYildiziJeneratoru from './buildings/ruined/enerji_yildizi_jeneratoru.png';
import ruinedSekerFabrikasi from './buildings/ruined/seker_fabrikasi.png';
import ruinedPaketlemeMerkezi from './buildings/ruined/paketleme_merkezi.png';
import ruinedSekerTreniDuragi from './buildings/ruined/seker_treni_duragi.png';
import ruinedCikolataKoprusu from './buildings/ruined/cikolata_koprusu.png';
import ruinedSekerLimani from './buildings/ruined/seker_limani.png';
import ruinedBuyukSekerMeydani from './buildings/ruined/buyuk_seker_meydani.png';
import ruinedX1000CarpanKulesi from './buildings/ruined/x1000_carpan_kulesi.png';
import ruinedMegaSekerSarayi from './buildings/ruined/mega_seker_sarayi.png';
import renovatedSekerTezgahi from './buildings/renovated/seker_tezgahi.png';
import renovatedJelibonStandi from './buildings/renovated/jelibon_standi.png';
import renovatedLollipopArabasi from './buildings/renovated/lollipop_arabasi.png';
import renovatedDondurmaBufesi from './buildings/renovated/dondurma_bufesi.png';
import renovatedSekerDukkani from './buildings/renovated/seker_dukkani.png';
import renovatedMarshmallowEvi from './buildings/renovated/marshmallow_evi.png';
import renovatedKaramelAtolyesi from './buildings/renovated/karamel_atolyesi.png';
import renovatedJelibonAtolyesi from './buildings/renovated/jelibon_atolyesi.png';
import renovatedRenkKaristirmaLaboratuvari from './buildings/renovated/renk_karistirma_laboratuvari.png';
import renovatedEnerjiYildiziJeneratoru from './buildings/renovated/enerji_yildizi_jeneratoru.png';
import renovatedSekerFabrikasi from './buildings/renovated/seker_fabrikasi.png';
import renovatedPaketlemeMerkezi from './buildings/renovated/paketleme_merkezi.png';
import renovatedSekerTreniDuragi from './buildings/renovated/seker_treni_duragi.png';
import renovatedCikolataKoprusu from './buildings/renovated/cikolata_koprusu.png';
import renovatedSekerLimani from './buildings/renovated/seker_limani.png';
import renovatedBuyukSekerMeydani from './buildings/renovated/buyuk_seker_meydani.png';
import renovatedX1000CarpanKulesi from './buildings/renovated/x1000_carpan_kulesi.png';
import renovatedMegaSekerSarayi from './buildings/renovated/mega_seker_sarayi.png';

export interface BuildingAssetDefinition {
  id: number;
  slug: string;
  displayNameTr: string;
  ruined: string;
  renovated: string;
}

export const BUILDING_ASSETS: BuildingAssetDefinition[] = [
  { id: 1, slug: 'seker_tezgahi', displayNameTr: '\u015eeker Tezg\u00e2h\u0131', ruined: ruinedSekerTezgahi, renovated: renovatedSekerTezgahi },
  { id: 2, slug: 'jelibon_standi', displayNameTr: 'Jelibon Stand\u0131', ruined: ruinedJelibonStandi, renovated: renovatedJelibonStandi },
  { id: 3, slug: 'lollipop_arabasi', displayNameTr: 'Lollipop Arabas\u0131', ruined: ruinedLollipopArabasi, renovated: renovatedLollipopArabasi },
  { id: 4, slug: 'dondurma_bufesi', displayNameTr: 'Dondurma B\u00fcfesi', ruined: ruinedDondurmaBufesi, renovated: renovatedDondurmaBufesi },
  { id: 5, slug: 'seker_dukkani', displayNameTr: '\u015eeker D\u00fckk\u00e2n\u0131', ruined: ruinedSekerDukkani, renovated: renovatedSekerDukkani },
  { id: 6, slug: 'marshmallow_evi', displayNameTr: 'Marshmallow Evi', ruined: ruinedMarshmallowEvi, renovated: renovatedMarshmallowEvi },
  { id: 7, slug: 'karamel_atolyesi', displayNameTr: 'Karamel At\u00f6lyesi', ruined: ruinedKaramelAtolyesi, renovated: renovatedKaramelAtolyesi },
  { id: 8, slug: 'jelibon_atolyesi', displayNameTr: 'Jelibon At\u00f6lyesi', ruined: ruinedJelibonAtolyesi, renovated: renovatedJelibonAtolyesi },
  { id: 9, slug: 'renk_karistirma_laboratuvari', displayNameTr: 'Renk Kar\u0131\u015ft\u0131rma Laboratuvar\u0131', ruined: ruinedRenkKaristirmaLaboratuvari, renovated: renovatedRenkKaristirmaLaboratuvari },
  { id: 10, slug: 'enerji_yildizi_jeneratoru', displayNameTr: 'Enerji Y\u0131ld\u0131z\u0131 Jenerat\u00f6r\u00fc', ruined: ruinedEnerjiYildiziJeneratoru, renovated: renovatedEnerjiYildiziJeneratoru },
  { id: 11, slug: 'seker_fabrikasi', displayNameTr: '\u015eeker Fabrikas\u0131', ruined: ruinedSekerFabrikasi, renovated: renovatedSekerFabrikasi },
  { id: 12, slug: 'paketleme_merkezi', displayNameTr: 'Paketleme Merkezi', ruined: ruinedPaketlemeMerkezi, renovated: renovatedPaketlemeMerkezi },
  { id: 13, slug: 'seker_treni_duragi', displayNameTr: '\u015eeker Treni Dura\u011f\u0131', ruined: ruinedSekerTreniDuragi, renovated: renovatedSekerTreniDuragi },
  { id: 14, slug: 'cikolata_koprusu', displayNameTr: '\u00c7ikolata K\u00f6pr\u00fcs\u00fc', ruined: ruinedCikolataKoprusu, renovated: renovatedCikolataKoprusu },
  { id: 15, slug: 'seker_limani', displayNameTr: '\u015eeker Liman\u0131', ruined: ruinedSekerLimani, renovated: renovatedSekerLimani },
  { id: 16, slug: 'buyuk_seker_meydani', displayNameTr: 'B\u00fcy\u00fck \u015eeker Meydan\u0131', ruined: ruinedBuyukSekerMeydani, renovated: renovatedBuyukSekerMeydani },
  { id: 17, slug: 'x1000_carpan_kulesi', displayNameTr: 'x1000 \u00c7arpan Kulesi', ruined: ruinedX1000CarpanKulesi, renovated: renovatedX1000CarpanKulesi },
  { id: 18, slug: 'mega_seker_sarayi', displayNameTr: 'Mega \u015eeker Saray\u0131', ruined: ruinedMegaSekerSarayi, renovated: renovatedMegaSekerSarayi }
];

export function getBuildingAsset(id: number): BuildingAssetDefinition | undefined {
  return BUILDING_ASSETS.find((asset) => asset.id === id);
}
