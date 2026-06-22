import { ISLAND_BASE_ASSET } from './assets/islandAssetManifest';
import './islandPreview.css';

document.body.innerHTML = `
  <main class="island-preview-shell">
    <header>
      <h1>Island Asset Preview</h1>
      <p>Island base PNG shown on dark, light, checkerboard, and high-contrast backgrounds.</p>
    </header>
    <section class="island-preview-grid">
      ${[
        ['dark', 'Dark'],
        ['light', 'Light'],
        ['checker', 'Checker'],
        ['box-test', 'Box test']
      ].map(([key, label]) => `
        <figure class="island-preview-swatch island-preview-swatch-${key}">
          <img src="${ISLAND_BASE_ASSET.src}" alt="${ISLAND_BASE_ASSET.name}" />
          <figcaption>${label}</figcaption>
        </figure>
      `).join('')}
    </section>
  </main>
`;
