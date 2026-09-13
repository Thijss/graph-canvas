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

This is a fully client-side tool — everything runs in your browser and nothing
you type is ever sent anywhere:

- No backend, no database, no analytics or third-party requests.
- All graph and boundary data lives only in the page's memory and three `<textarea>`
  fields; nothing is saved to disk or a network unless you copy it yourself.
- The only network requests are same-origin fetches of bundled files in the
  `public/templates/` folder when you select a template.
- User input is rendered using safe DOM APIs (`textContent`/`setAttribute`),
  not `innerHTML`, so there's no script-injection risk from anything you type.
