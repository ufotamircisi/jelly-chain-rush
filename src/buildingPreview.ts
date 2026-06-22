import { BUILDING_ASSETS } from './assets/buildingAssetManifest';
import './buildingPreview.css';

const root = document.getElementById('building-preview-root');

if (!root) {
  document.body.innerHTML = `
    <main class="building-preview-shell">
      <header>
        <h1>Building Asset Preview</h1>
        <p>Ruined and renovated PNGs are shown on dark, light, and checkerboard preview backgrounds.</p>
      </header>
      <section id="building-preview-root" class="building-preview-grid" aria-live="polite"></section>
    </main>
  `;
}

const previewRoot = document.getElementById('building-preview-root');

if (!previewRoot) {
  throw new Error('Missing building preview root');
}

const backgrounds = [
  { key: 'dark', label: 'Dark' },
  { key: 'light', label: 'Light' },
  { key: 'checker', label: 'Checker' },
  { key: 'box-test', label: 'Box test' }
];

previewRoot.innerHTML = BUILDING_ASSETS.map((asset) => `
  <article class="building-preview-card">
    <h2>${asset.id}. ${asset.displayNameTr}</h2>
    <p>${asset.slug}</p>
    <div class="building-preview-versions">
      ${(['ruined', 'renovated'] as const).map((state) => `
        <section>
          <h3>${state}</h3>
          <div class="building-preview-backgrounds">
            ${backgrounds.map((background) => `
              <figure class="building-preview-swatch building-preview-swatch-${background.key}">
                <img src="${asset[state]}" alt="${asset.displayNameTr} ${state}" />
                <figcaption>${background.label}</figcaption>
              </figure>
            `).join('')}
          </div>
        </section>
      `).join('')}
    </div>
  </article>
`).join('');
