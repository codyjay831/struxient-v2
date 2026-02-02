# Layout Surfaces vs Pages Canon v1

## 1. Definitions
- **"Page"**: Standard contained content. Optimized for readability. Uses (main) route group.
- **"Surface"**: Edge-to-edge canvas or cockpit. Optimized for execution/spatial orientation. Uses (fullbleed) route group.

## 2. Structural Rules
- `(app)/layout.tsx`: Root shell only (Sidebar, Auth, Context Providers). **MUST NOT** apply container padding or width constraints.
- `(main)/layout.tsx`: Applies standard container padding (using `.container`).
- `(fullbleed)/layout.tsx`: Zero padding. Children occupy 100% of the `<main>` viewport.

Route groups do not change URLs; they only select layout behavior.

## 3. Route Mapping
| Route | Type | Route Group |
|-------|------|-------------|
| /customers | Page | (main) |
| /jobs | Page | (main) |
| /flowspec (list) | Page | (main) |
| /flowspec/[id] | Surface | (fullbleed) |
| /workstation | Surface | (fullbleed) |

## 4. Non-Goals
- Does NOT change engine behavior or truth handling.
- Does NOT imply every route must be full-bleed.

## 5. Drift Prevention
- **NO ROOT CONTAINER LOGIC**: `(app)/layout.tsx` must not conditionally apply container/padding/width constraints by route. Use route groups `(main)` vs `(fullbleed)`.
- **NO ESCAPE HACKS**: Forbid negative margins (e.g., `-mx-8`) to "break out" of a container. Move the route to `(fullbleed)` instead.

## 6. Verification Checklist
- [ ] `/workstation`: `!!document.querySelector('main > .container') === false`
- [ ] `/customers`: `!!document.querySelector('main > .container') === true`
