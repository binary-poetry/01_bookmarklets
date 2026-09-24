# [Bookmarklets by binary poetry](https://github.com/binary-poetry/01_bookmarklets)

The source of the bookmarklets published on
[binarypoetry.ch](https://binarypoetry.ch/):
TypeScript, built into frozen, auditable `javascript:` links.

## Check a published hash

Each published bookmarklet has a tag, `<id>@<version>`. With Node.js, this
reproduces the SHA-256 of the published media manager without trusting the
website:

```sh
git clone --depth 1 --branch media-manager@1.1.1 https://github.com/binary-poetry/01_bookmarklets.git
cd 01_bookmarklets/bookmarklets
```

```sh
printf 'void function bookmarklet(){%s}()' "$(echo 'import { run } from "./media-manager.ts"; run(__BOOKMARKLET_OPTIONS__)' \
  | npx esbuild@0.28.2 --bundle --minify --format=iife \
      --legal-comments=inline --loader=ts \
  | sed 's|__BOOKMARKLET_OPTIONS__|/*<options>*/{"lang":"en"}/*</options>*/|')" \
  | sha256sum # macOS: shasum -a 256
```

esbuild builds the code with a placeholder for the options, `sed` fills in
the options as JSON (with markers, so a bookmarklet can find them later),
and `printf` wraps it into the named function that is published. `$(…)`
drops esbuild's final newline, which the published code doesn't have. For
another bookmarklet or other options, change the file name and the JSON.

## Security

See the [security policy](.github/SECURITY.md).

## License

[MIT-0](LICENSE): use it, change it, no attribution needed.
