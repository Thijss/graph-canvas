# GraphCanvas

GraphCanvas is a gravity-centered graph editor with node boundarying.

Demo: https://thijss.github.io/graph-canvas/

## License

All rights reserved; copying, modifying, distributing, publishing, sublicensing, or otherwise using this software requires prior written permission, while use of the deployed instance is permitted.

## Running locally

This is a Vite-powered static site. Start the development server with:

```
npm run dev
```

Then open the URL shown by Vite.

Create a production build with `npm run build`; GitHub Pages deploys the
resulting `dist/` directory.

## Development

Install the development dependencies and run the JavaScript linter with:

```bash
npm install
npm run lint
npm run build
```

## Privacy & security

This is a fully client-side tool — graph data is processed in your browser and
is not sent to a backend, analytics service, or third party:

- No backend, no database, no analytics or third-party requests.
- Editor text and selected settings are saved in browser `localStorage` so the
  page can restore them after a refresh. Node positions are not persisted.
- Import reads a file selected by the user. Export creates a local browser
  download and does not upload the graph.
- The app makes same-origin requests for bundled templates, help content, and
  the license text. These files are served from the application's own static
  assets.
- User-entered graph data is rendered with safe DOM APIs (`textContent` and
  `setAttribute`). The help page uses `innerHTML` only for its bundled,
  trusted static content.
