# Manual accessibility checks

The automated gates (ESLint `jsx-a11y`, the axe unit smoke, the axe browser
sweep, and the keyboard e2e spec) catch structure. What they cannot judge is how
the app reads aloud and how it feels under a real screen reader on a real
device. This page holds the scripts for those checks and the record of runs.
**A run is only claimed when it is recorded in the table at the bottom.**

## When to run

Before every store release and after any change to navigation, the map tool
rail, the tap-query panel, the bottom tab bar, or a form. Run the desktop
script on the web build and the two mobile scripts on the Capacitor build.

## Script A — VoiceOver on macOS (Safari, web build)

1. Open the app, press `⌘F5` to start VoiceOver. `VO` = Control+Option.
2. Press Tab once. Expect: "Skip to main content, link". Press Return. Expect:
   focus moves into the main region and VoiceOver announces the page heading.
3. `VO+U`, choose Landmarks. Expect: banner, navigation "Modules", main, and
   the map's complementary regions are listed, each with a name.
4. Tab to the map tool rail ("Map tools, toolbar"). Expect: one Tab stop; the
   arrow keys move between "Find your location", "Basemap", "Markup tools",
   "Measure tools", and "Hide my pins"; each announces its label and pressed
   state where it has one.
5. On "Markup tools" press Space. Expect: a menu opens, focus lands on the
   first item ("Draw a shape, menu item radio"), arrows move between items,
   Escape closes the menu and returns focus to the trigger.
6. Tab to "About Engage MT", press Return. Expect: a dialog opens, focus moves
   inside, Tab stays inside the dialog, Escape closes it and focus returns.
7. Open Hunt → Districts, pick a district. Expect: the freshness chip reads its
   copy ("Effective …", "Built-in copy" / "Downloaded copy" when applicable)
   and any stale warning is announced as a region.
8. Turn on a layer in the layer panel. Expect: the row's checkbox state is
   announced and the freshness chip text follows the layer title.

## Script B — VoiceOver on iOS (Capacitor build)

1. Settings → Accessibility → VoiceOver on. Open Engage MT.
2. Swipe right from the top. Expect: the app header, then the tab bar items
   ("Hunt, tab, 1 of 4" …), each with its selected state.
3. Double-tap Hunt, then Districts. Expect: focus lands on the page heading
   after the route change.
4. In the map, use the rotor to reach "Toolbar" and flick through the tool
   rail. Expect: the same labels as Script A; menus open and close with
   double-tap and the two-finger scrub (Escape).
5. Open Manage → Offline Maps. Expect: the basemap options are a radio group
   with the selected option announced; the storage bar reports "Offline
   storage usage, progress indicator, N percent".
6. Start a track from the Capture cluster. Expect: the recording status chip
   announces "Recording" and the note that recording runs in the foreground.

## Script C — TalkBack on Android (Capacitor build)

1. Settings → Accessibility → TalkBack on. Open Engage MT.
2. Swipe right through the header and tab bar. Expect: each tab reads its name
   and selected state; the hardware back button returns to the previous tab.
3. Repeat steps 3–6 of Script B. Expect: identical labels; the local context
   menu lists headings and landmarks.
4. Lock the phone while recording a track, unlock it. Expect: the recorder
   shows "Paused" and, after Resume, the track continues as a new segment.

## Script D — NVDA on Windows (Edge, web build)

1. Start NVDA. Open the app. Press `H` to walk headings. Expect: exactly one
   level-1 heading per page and a sensible hierarchy beneath it.
2. Press `D` to walk landmarks, then `B` to walk buttons. Expect: every
   icon-only button has a name.
3. Repeat Script A steps 4–6 in browse and focus mode.

## Results

Record every run here. A row means the script was run in full on that build.

| Date | Build (git SHA) | Script | Platform / device | Tester | Result | Findings |
|---|---|---|---|---|---|---|
| — | — | — | — | — | not yet run | — |

Licensed under the MIT License.
