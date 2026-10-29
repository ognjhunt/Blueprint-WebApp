# SuperSplat Viewer (vendored)

PlayCanvas's open-source, view-only Gaussian splat viewer, used to show a site its
3D preview without offering the file for download (owner decision 2026-10-29).

- Package: `@playcanvas/supersplat-viewer@1.37.0` (MIT; see `LICENSE.txt`)
- npm integrity: `sha512-8dy9mn9lFFL04PhWbwlHchzE/ky55FwuIVcz65Mf1+BN2UFMNGtGDV/BYPirI92ijJofUCUZS8eDT5OVGy/a1g==`
- `index.js` sha256: `818a439821fbd9a3e36c885318cba164452db023b6187c676cd5d8b6cd73b30b`
- Copied unchanged from the package's `public/`: `index.js`, `index.css`.
- `settings.json`: the package's own `defaultSettings()`, checked with `validateSettings(…, { limits: true })`.
- `index.html` and `boot.js` are Blueprint's: the page has no inline script (the site CSP
  allows none), and `boot.js` loads content only from `/api/website-atlas-preview-views/`.

To update, replace `index.js`/`index.css` from a release at least two weeks old and
re-record the integrity and sha256 above.
