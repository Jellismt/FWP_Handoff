# Stub services

An FWP-authenticated endpoint the app needs but cannot reach yet is implemented
here as a `*.stub.ts` file returning a clearly-fake fixture. See:

- `docs/rules/data-stubs.md` for the file convention.
- `docs/stubs/STUB-NNN.md` for each stub's contract.
- `registry.ts` for the registry (gated by `npm run check:stubs`).

When the real endpoint lands, put the real implementation under
`web/src/services/public/`, delete the
`*.stub.ts`, and remove its registry row and contract doc.
