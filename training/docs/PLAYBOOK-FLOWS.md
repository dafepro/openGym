# Playbook interaction contract

The main navigation has two destinations: **Practice** and **Me**. A practice is a complete ordered session. A drill is a single activity within that session. The drill catalog is only opened by **Add drill** or **Swap** in the organizer.

## Player with an assignment

1. Practice opens the assigned whole session. Its title and **Start practice** precede numbered drill strips.
2. The drill name opens instructions. The small right thumbnail opens an approved demonstration directly, muted and playing; it does not start or complete athletic work.
3. Start creates one immutable assignment snapshot and enters the first drill. Existing work offers Resume instead of replacing it. An explicit Resume action opens the drill and resumes its paused clock (or starts its ready work row) in one step; browser hash navigation alone does not.
4. The active drill owns work tracking. Leaving or watching a demonstration pauses active work; returning from a demonstration leaves an explicit resume action.
5. Exit offers Save and leave, Discard without saving, and Resume practice. Only the explicit resume action restarts a paused timer.
6. The final explicit Finish practice action records the last work row and saves the same session immediately; there is no second mandatory Save screen. The saved recap restores the persistent navigation. Timer events alone never save or mark a session complete. Finished or partial sessions are in Me, where they can be inspected and deleted.

## Player choosing independent practice

**Surprise me** shows a compatible whole-session proposal immediately. Its visible setup defaults to outdoor, 6×6 m, solo, and ball plus cones. The player can change setting, square space, gear, player count, requested drill count, and video-only preference. Unlisted space requirements are excluded by default; a separate opt-in allows the player to inspect them, and the proposal explicitly marks the unresolved space check. The recommendation helper uses those exact conditions and history. Shuffle changes the seed; Start uses the exact proposal shown. An empty match has no enabled start action. A small candidate pool is stated honestly.

**My own drill** asks for a name, optional setup, and how to do it. The default tracks elapsed time without inventing repetitions. Timed sets and reps/sets expose compact target presets with optional exact controls. Optional canonical skill and freeform labels are retained. Start my drill first saves the reusable drill, then starts a single-drill practice. Save for later only saves. My saved drills can start directly or be added to an open organizer. A compact Edit action prefills the existing drill; Save changes updates that reusable ID, while Cancel edit leaves the saved version intact. Delete is offered only inside the editor and requires explicit confirmation. Existing saved practices and history retain their immutable copies.

Here, recording a drill means recording athletic work. Video filming/upload is not implied or implemented.

**Choose my own practice** opens Saved and Recent whole-session choices. Start appears above the chosen session's numbered strips. Make it fit today creates an editable copy and preserves its original saved/history snapshot. New practice opens an empty organizer; a populated unsaved draft requires explicit replacement confirmation.

## Parent or self-organizer

The compact Organizer link opens the current assignment as an editable copy on first use. It subsequently preserves the current draft, including an intentionally empty draft.

1. Name the practice, optionally add a note for the player (up to 500 characters), and inspect its ordered drill strips.
2. Expand a strip to edit tracking, targets, feet, or rest; move it up/down, swap, or remove it. Undo restores a removed drill with its edited targets and original position until the sequence changes again.
3. Add drill opens the contextual catalog with search, skill/context filters, video-only and video-first sorting, and the existing recommendation strategies.
4. Add/remove choices update the draft without reordering the catalog beneath the pointer. Done returns to the same organizer.
5. My own drill can add a custom drill; when entered through Swap, it replaces that exact slot. Re-adding an already selected saved custom drill is idempotent.
6. Preview as player validates and snapshots the draft, then displays the player entry screen with a disabled Start action. Nothing is recorded.
7. Create practice link shares the previewed snapshot. Copy link has an explicit fallback for unavailable clipboard access. Returning to the organizer and editing requires another preview before the link changes.
8. Save practice writes a local reusable session with a compare-and-swap guard. Start practice begins the validated current draft.

## Persistence and failure boundaries

- Existing history and active-session persistence retain their IndexedDB contracts.
- Saved whole practices and reusable custom drills use separate versioned localStorage keys scoped by database name.
- Stale-tab writes, malformed storage, invalid targets, and storage exhaustion do not overwrite existing records.
- Unfinished form and organizer fields survive in-app navigation. A full page reload does not preserve unsaved form/draft edits.
- Recent sessions reuse exact validated assignment snapshots, deduplicated by assignment ID and revision; display metadata is not inserted into the strict assignment schema.
- Media previews only use approved same-origin media identities. A shared link does not authorize new video paths.

## Verification

`components/playbook-views.test.jsx` covers whole-practice hierarchy, non-recording preview, exact recent snapshots, approved media boundaries, self-paced custom defaults, explicit random context, empty random matches, and contextual organizer/catalog separation. Domain tests validate custom storage, compatibility, deterministic generation, and session entry. The fifteen `components/playbook-integration.test.jsx` journeys mount real React hooks with the actual controller and fake IndexedDB: start/back/resume/final completion, personal-drill reload/edit/work/history/delete, hidden invalid targets and cancel edit, nested catalog filtering and immutable saved practices, random no-match recovery/start/discard, exact note/share previews, help/exit pause and explicit resume for self-paced and timed work, paused timed early completion, duplicate final-forward protection, delayed-save Back→Resume ordering for free/timed work, and durable pause visibility across remount. These virtual-DOM tests do not verify browser layout, media playback, animation, or hit testing. The executed 64-case isolated browser matrix covers native playback, rendered hit testing, motion frames, responsive layout, and the end-to-end user flows; see the implementation status for scope and evidence.
