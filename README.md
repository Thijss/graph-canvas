# GraphCanvas

GraphCanvas is a gravity-centered graph editor with station grouping.

Demo: https://thijss.github.io/graph-canvas/

## License

All rights reserved; copying, modifying, distributing, publishing, sublicensing, or otherwise using this software requires prior written permission, while use of the deployed instance is permitted.

## Running locally

This is a static site (no build step). Serve it with:

```
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser.

(A local server is required — opening `index.html` directly via `file://` won't
work, since loading template data uses `fetch()`.)

## Development

Install the development dependencies and run the JavaScript linter with:

```bash
npm install
npm run lint
```

## Adding templates

Add each built-in template as a `.txt` file in `templates/` and register it in
`templates/index.json`:

```json
{
  "id": "my-template",
  "title": "My template",
  "description": "A short description shown in the template picker.",
  "file": "MY-TEMPLATE.txt"
}
```

Template files keep the existing format: edge definitions, followed by a line
containing `----------`, followed by station definitions.

## Privacy & security

This is a fully client-side tool — everything runs in your browser and nothing
you type is ever sent anywhere:

- No backend, no database, no analytics or third-party requests.
- All graph/station data lives only in the page's memory and two `<textarea>`
  fields; nothing is saved to disk or a network unless you copy it yourself.
- The only network requests are same-origin fetches of bundled files in the
  `templates/` folder when you select a template.
- User input is rendered using safe DOM APIs (`textContent`/`setAttribute`),
  not `innerHTML`, so there's no script-injection risk from anything you type.
