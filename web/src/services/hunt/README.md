# services/hunt — Map of the hunt-domain logic layer

This folder owns the non-React hunt logic: district regulations, season
windows, live district facts, and region contacts. If you are touching what a
hunting district says about itself — seasons, regulations rows, contact info —
land here first.

One job per file. Read them in this order:

1. **[regsTypes.ts](./regsTypes.ts)** — the normalized hunting-regulation
   contract: the single row shape every species maps into, plus the
   geography vocabulary that keys it. Consumers read ONLY this shape, so
   adding a species is a build-time adapter + (if its geography differs)
   a resolver entry — never an engine change.

2. **[fetchHuntingRegs.ts](./fetchHuntingRegs.ts)** — loads the unified
   regulations dataset through the shared regs fetcher
   (`services/regsApi/client.ts`: API → stored copies → built-in copy) and
   returns the rows with their freshness.

3. **[districtSeasonWindows.ts](./districtSeasonWindows.ts)** — parses
   the RAW season date ranges into open/next windows (handles the
   Nov→Feb year wrap).

4. **[huntingDistrictsLive.ts](./huntingDistrictsLive.ts)** — live FWP
   REST lookups against the hunting-district boundary service.

5. **[regionContacts.ts](./regionContacts.ts)** — FWP region office
   contact rows for the district contact surfaces.

## Rules of thumb

- **Don't inline a policy constant.** Anything with FWP-rule meaning gets
  a named constant with an inline citation.
- **Don't bypass the normalized row shape.** Components consume
  `regsTypes` rows via the hooks layer (`useDistrictRegulations`,
  `useDistrictHuntStatus`) — never a species-specific shape.
- **Season parsing lives in one place.** Reuse `districtSeasonWindows`
  for any open/closed/next question; don't re-derive dates in a
  component.

## Verified-FWP sources

- Hunting regulations & season dates — https://fwp.mt.gov/hunt/regulations
- District boundaries — FWP hunting-district MapServer (see
  `huntingDistrictsLive.ts` header for the endpoint + field contract).
