# Notifications & Notice Patterns — Engage MT Rules

When to use which Calcite component for which kind of message.

## Component decision tree

```
Is this a critical / blocking message?
├── YES — Modal / Dialog (Calcite <calcite-dialog>)
│         For: destructive confirmation, login, permission requests, emergency acknowledge.
│
└── NO
    │
    Is this a transient confirmation or info?
    ├── YES — Toast (Calcite <calcite-alert>) with auto-dismiss
    │         For: "Layer added", "Settings saved", "Couldn't load this layer"
    │
    └── NO
        │
        Is this contextual help or persistent guidance?
        ├── YES — Inline notice (Calcite <calcite-notice>) non-dismissible or session-dismissible
        │         For: "No layers visible — open layer panel", contextual guidance
        │
        └── NO
            │
            Is this a sticky time-sensitive alert?
            ├── YES — Banner (custom <EmergencyBanner>) at top of app
            │         For: fire closures, emergency CWD bulletins, urgent regulation changes
            │
            └── NO
                │
                Is this a feature detail or panel content?
                ├── YES (desktop) — Right rail panel
                ├── YES (mobile)  — Bottom sheet
                └── ELSE — Reconsider: maybe inline content
```

## Severity → component mapping

| Severity | Component | Auto-dismiss | Dismissible? |
|---|---|---|---|
| `success` | toast | 4s | yes |
| `info` | toast OR inline notice | 6s | yes |
| `advisory` | inline notice | no | session |
| `warning` | toast (transient) + banner (if critical-until-acknowledged) | 8s toast / persistent banner | yes / banner-only-dismiss-on-ack |
| `emergency` | banner with mandatory acknowledge | no | requires Acknowledge tap |

## Toast (Calcite `<calcite-alert>`)

- Top-right of viewport (desktop), top-center (mobile).
- Auto-dismiss after 4–8 seconds (severity-driven).
- One toast at a time; second overwrites or queues.
- Icon + brief text + optional CTA + close button.
- aria-live="polite" for success/info; "assertive" for error.

```tsx
<calcite-alert
  open
  kind="success"
  icon="check-square"
  label="Layer enabled"
  auto-close-duration="medium"
>
  <div slot="title">Layer added</div>
  <div slot="message">BMA boundaries visible on map.</div>
</calcite-alert>
```

## Inline notice (Calcite `<calcite-notice>`)

- Lives inside a panel, form, or page section.
- Stays until user dismisses or context changes.
- Used for: guidance, context, sub-feature errors (not page-level).
- Optional close action; if non-dismissible (e.g., "Login required"), no close.

```tsx
<calcite-notice open kind="warning" icon="exclamation-mark-triangle">
  <div slot="title">No layers visible</div>
  <div slot="message">Open the layer panel to toggle some on.</div>
  <calcite-link slot="link">Show layers</calcite-link>
</calcite-notice>
```

## Modal dialog (Calcite `<calcite-dialog>`)

- Blocks interaction with the app behind it.
- Used for: destructive confirmations ("Delete this draft?"), login flow, permission requests, emergency acknowledge.
- Always has focus trap.
- Always has Esc-to-cancel for non-destructive flows.
- Title + message + action buttons (primary + secondary).

```tsx
<calcite-dialog
  open
  modal
  heading="Delete this draft?"
  description="Your changes will be lost."
  scale="m"
  kind="danger"
>
  <calcite-button slot="footer-end" kind="danger">Delete</calcite-button>
  <calcite-button slot="footer-end" appearance="outline">Cancel</calcite-button>
</calcite-dialog>
```

## Sheet (mobile bottom)

`<calcite-sheet>` slid up from the bottom of the viewport on mobile:
- Used for: feature detail, multi-step form, tap-query results.
- Swipe-down dismissible.
- Tap-outside dismissible (unless modal).
- Max 90vh height.

## Panel (desktop right rail)

`<calcite-panel>` inside `<calcite-shell-panel slot="panel-end">`:
- Used for: tap-query results, search results, feature detail, multi-step form.
- Close button always visible.
- Persistent across tab switches (until user closes).

## Banner (custom)

Sticky at top of app for `warning` (critical) and `emergency`:
- Above the header.
- Cannot be obscured by other UI.
- Multiple banners stack (max 3 visible + "+N more").
- `emergency` cannot be dismissed without Acknowledge.

```tsx
<EmergencyBanner severity="warning" actionable>
  <Icon name="fire" />
  Beartooth-Absaroka WMA fire closure — Northern half closed.
  <Link>Read more</Link>
  <CloseAction />
</EmergencyBanner>
```

## Don'ts

- Don't use modals for non-critical messages.
- Don't auto-dismiss content the user needs to act on.
- Don't queue more than ~3 toasts.
- Don't use multiple severity levels in the same component (e.g., success + warning toast at the same time).
- Don't show banners for things that aren't time-sensitive (use inline notice or in-feed item instead).
- Don't use sounds inside the app.

## Accessibility

- All notifications have appropriate `aria-live` (polite for info, assertive for warning/error).
- All interactive elements meet 44×44 touch target.
- Color is supplemented by icons + text.
- Focus management:
  - Modal: focus moves into dialog on open; returns to trigger on close.
  - Banner emergency: focus moves to Acknowledge action on appear.
  - Toast/inline: focus stays put (don't steal focus for transient items).

## Voice

All notification text follows FWP voice rules: authoritative, accessible, no jargon, no blame.

## Time-sensitive conditions live on the map

There is no push, broadcast, or alert-feed surface in Engage MT. Time-sensitive
conditions (active fires, waterbody closures) render as **map layers** with
their own popups — that is the one place users read them. Don't build a
parallel notification pipeline; a new condition source should become a layer
(or extend an existing one), not a banner system.
