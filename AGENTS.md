# Writing a bookmarklet here

Bookmarklets run on other people's pages: under their CSP, their Trusted
Types, their styles. Lint and tests enforce what they can
(`npm run lint && npm run test:unit && npm run test:e2e`); this file covers
the rest.

- One file per bookmarklet in `bookmarklets/<id>.ts`, shared code in
  `bookmarklets/lib/`. It exports `options` (`satisfies OptionsDefinition`,
  see `lib/options.ts`) and `run(options)`. Every bookmarklet gets
  `lang: "en" | "de"` for its UI text. Option labels and choices come in
  every language; the language choices name each language in its own.
- Configurable bookmarklets offer the settings view (`lib/settings.ts`)
  behind a ⚙ button: the options form and a new link to drag, built from
  the running code, so reconfiguring needs no visit to our site. A
  draggable dialog must ignore the drag events that bubble up from the
  link.
- Each bookmarklet has an icon, `bookmarklets/icons/<id>.txt`: 16 rows of
  16 `#` (lit) or `.` (unlit), pixel art in the logo's colors. The site
  offers it in a bookmark file (Chrome keeps PNG icons of bookmarklets on
  import, Firefox drops them).
- Build the DOM with `h()` (`lib/h.ts`), put the UI in a shadow root with
  `mount()` (`lib/mount.ts`): adopted stylesheets survive a strict
  `style-src`, `:host { all: initial }` keeps the page's styles out, and
  `lib/theme.ts` gives the site's colors. Use `popover="manual"` for the
  top layer instead of `z-index`.
- Running a bookmarklet again must not break a running one: find it by its
  host id and toggle it (see `media-manager.ts`).
- Don't overwrite the page's handlers (`onclick = …`); use
  `addEventListener` with an `AbortController`.
- Every byte ships in a URL: no dependencies beyond `lib/`, and keep CSS in
  strings compact (esbuild doesn't minify it).
- Test in `tests/e2e/`: serve a fixture page that copies the target site's
  markup via `page.route`, run the bookmarklet with `page.evaluate`, and add
  a CSP/Trusted Types case.
- A change to a published bookmarklet changes its hash:
  `tests/unit/published.spec.ts` fails until the hash is updated with a new
  tag `<id>@<version>` (major: options changed incompatibly).
- Commits: Conventional Commits with the bookmarklet id as scope, e.g.
  `fix(media-manager): …`.
