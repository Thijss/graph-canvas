# Development Guide

## Overview

GraphCanvas is a client-side Vite application. The browser owns the graph
state, parsing, layout simulation, rendering, editor UI, persistence, and
file export. There is no backend or application server.

## Getting started

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Run the available checks before submitting changes:

```bash
npm run lint
npm test
npm run test:coverage
npm run build
```

The site is deployed as a static build from `dist/`.

## Testing

Unit tests use Vitest. They cover pure parsing, serialization, configuration,
and browser storage behavior without starting the development server:

```bash
npm test                 # Run the unit tests once
npm run test:watch       # Re-run tests while files change
npm run test:coverage    # Run tests and write a coverage report
npm run test:e2e         # Run browser smoke tests
```

Coverage output is written to `coverage/`, which is ignored by Git. The
coverage percentage is useful for finding untested code, but it is not a
quality score by itself; prioritize important behavior and edge cases over
maximizing the number.

Place unit tests under `tests/` and name them `*.test.js`. Keep tests focused
on observable behavior. Parser and configuration tests should remain
independent of the DOM; tests for `localStorage` use Vitest's jsdom environment.
Browser smoke tests are kept separate because they exercise the built
application in a real browser.

Playwright's Chromium browser must be installed once on a new machine:

```bash
npx playwright install chromium
```

The browser smoke tests start Vite automatically and cover only critical
end-to-end flows: loading the editor, entering graph data, restoring it after
a refresh, and exporting a text file. They do not replace manual testing of
visual layout, dragging, zooming, and other detailed interactions.

## Source layout

```text
src/js/
  editors/       Visual and text editor controls
  graph/         Parsing, simulation, rendering, and graph orchestration
  interaction/  Canvas gestures and viewport calculations
  io/            File parsing, downloads, and export dialog workflow
  config.js      Shared constants, palettes, and configuration helpers
  dialogs.js     Shared simple dialog wiring
  dom.js         Central DOM element lookup
  persistence.js localStorage-backed editor and settings persistence
  state.js       Mutable application state
  main.js        Application bootstrap and event wiring
```

`src/styles/` contains the CSS split by visual responsibility. `src/styles.css`
is the stylesheet entrypoint. Static templates and bundled content live under
`public/`.

## Runtime data flow

The application follows this path:

```text
editor text
  -> graph/parser.js
  -> graph/engine.js
  -> graph/simulation.js
  -> graph/renderer.js
  -> SVG graph
```

The editor modules maintain the visual controls and keep their source
textareas synchronized. `engine.js` is the bridge between DOM editor values,
the shared state object, simulation configuration, and rendering.

`state.js` is intentionally a single mutable object. D3 mutates node
positions in place, so simulation and rendering modules can share live node
objects without maintaining a second positions or velocities structure.

## Module boundaries

### Editors

The modules in `editors/` own editor-specific DOM behavior:

- `edge-editor.js` manages edges and floating nodes.
- `boundary-editor.js` manages boundary types, names, and members.
- `group-editor.js` manages groups and members.
- `editor-controls.js` contains shared picker, chip-list, list-state, and
  delete-button controls.
- `editor-mode.js` wires visual/text mode toggles.

When adding a reusable editor control, put it in `editor-controls.js`. Keep
serialization and validation rules in the relevant editor or parser rather
than hiding them in generic DOM helpers.

### Graph

`parser.js` is responsible for converting source text into normalized graph
records and serializing normalized records back to text. It should remain
independent of the DOM.

`simulation.js` contains node measurement, layout algorithms, D3 force setup,
and custom forces. `renderer.js` creates the SVG representation. `engine.js`
coordinates parsing, layout, simulation updates, and redraws.

### Interaction

`zoom.js` contains pure coordinate and view calculations. Keep it independent
of DOM events where possible.

`canvas-interaction.js` owns browser event wiring for panning, zooming, node
dragging, resize, and fullscreen behavior.

### I/O

`file-io.js` contains text splitting, graph file reading, serialization for
downloads, and SVG/PNG generation. `export-dialog.js` owns the multi-step
export dialog and delegates actual file work to `file-io.js`.

## Graph text format

The first section contains edge definitions:

```text
source target optional,label,style
standalone-node
```

Optional sections are separated by these exact markers:

```text
-----BOUNDARIES-----
-----GROUPS-----
```

Boundary and group members that are not present in the edge-derived node set
are ignored by the parser. Preserve this behavior when changing the format,
because existing templates and saved files depend on it.

## Adding features

Use the narrowest responsible module:

1. Add parsing or serialization rules to `graph/parser.js`.
2. Add graph layout or force behavior to `graph/simulation.js`.
3. Add SVG output to `graph/renderer.js`.
4. Add editor controls under `editors/`.
5. Add canvas gestures to `interaction/canvas-interaction.js`.
6. Add file format or download behavior to `io/file-io.js`.
7. Keep `main.js` limited to application bootstrap and cross-module wiring.

Prefer passing state or dependencies into reusable functions over importing
application-wide mutable state into lower-level helpers. Avoid adding generic
`utils` or `helpers` modules; place new code with the domain that owns it.

## Persistence and compatibility

Editor text and selected settings are stored through `persistence.js`.
Positions are intentionally transient and are recalculated when the graph is
loaded.

When changing parser output, editor serialization, localStorage keys, or the
text format, consider existing saved graphs and templates. Preserve backwards
compatibility unless the format change is intentional and documented.
