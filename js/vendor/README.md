# Vendored dependencies

These files are vendored (checked into the repo) rather than loaded from a
CDN at runtime, so the app has no third-party network dependency and no
supply-chain trust in a CDN's "latest" content.

| File               | Package        | Version | Source                                      |
|--------------------|-----------------|---------|----------------------------------------------|
| `d3-force.js`       | d3-force        | 3.0.0   | https://github.com/d3/d3-force               |
| `d3-quadtree.js`    | d3-quadtree     | 3.0.1   | https://github.com/d3/d3-quadtree             |
| `d3-dispatch.js`    | d3-dispatch     | 3.0.1   | https://github.com/d3/d3-dispatch             |
| `d3-timer.js`       | d3-timer        | 3.0.1   | https://github.com/d3/d3-timer                |

All four are ISC-licensed (© Mike Bostock / D3 contributors).

Each file was fetched once from jsDelivr's `+esm` bundling endpoint
(`https://cdn.jsdelivr.net/npm/<package>@<version>/+esm`), which resolves the
package's internal source into a single ES module. `d3-force.js`'s import
specifiers were then rewritten from CDN paths to relative paths pointing at
the sibling files in this directory.

To upgrade: re-fetch each `+esm` URL at the new version, re-apply the same
import-path rewrite in `d3-force.js`, and re-run the smoke test below.

```js
import("./d3-force.js").then((d3force) => {
  const nodes = [{ id: "a" }, { id: "b" }];
  const sim = d3force
    .forceSimulation(nodes)
    .force("charge", d3force.forceManyBody().strength(-30))
    .force("link", d3force.forceLink([{ source: "a", target: "b" }]).id((n) => n.id))
    .stop();
  for (let i = 0; i < 50; i++) sim.tick();
  console.log(nodes); // should have finite, non-NaN x/y
});
```
