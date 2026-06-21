import { CANDY_ASSET_PACK } from './assets/candyAssetManifest';
import './assetPreview.css';

const root = document.getElementById('asset-preview-root');

if (!root) {
  document.body.innerHTML = `
    <main class="asset-preview-shell">
      <header>
        <h1>Candy Asset Preview</h1>
        <p>Dark, light, and checkerboard backgrounds use the final imported PNG files.</p>
      </header>
      <section id="asset-preview-root" class="asset-preview-grid" aria-live="polite"></section>
    </main>
  `;
}

const previewRoot = document.getElementById('asset-preview-root');

if (!previewRoot) {
  throw new Error('Missing asset preview root');
}

const backgrounds = [
  { key: 'dark', label: 'Dark' },
  { key: 'light', label: 'Light' },
  { key: 'checker', label: 'Checker' }
];

previewRoot.innerHTML = CANDY_ASSET_PACK.map((asset) => `
  <article class="asset-card">
    <h2>${asset.name}</h2>
    <p>${asset.path}</p>
    <div class="asset-backgrounds">
      ${backgrounds.map((background) => `
        <figure class="asset-swatch asset-swatch-${background.key}">
          <img src="${asset.src}" alt="${asset.name}" width="96" height="96" />
          <figcaption>${background.label}</figcaption>
        </figure>
      `).join('')}
    </div>
  </article>
`).join('');
