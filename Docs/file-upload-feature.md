# File Upload Feature

**Date:** 2026-05-19
**Branch:** main

## Summary

Added a file upload option inside the textarea card on the home page. Users can attach plain-text requirement documents, which are read client-side and appended to the textarea input before generation.

---

## Files Changed

### `app/page.tsx`
- Added `useRef` to the React import.
- Added `fileChips` state (`string[]`) to track the names of loaded files.
- Added `fileInputRef` (`useRef<HTMLInputElement>`) to programmatically trigger the hidden file picker.
- Added `ACCEPTED_EXTS` set and `handleFileChange` async function that reads each file as text and appends it to the textarea with a `--- filename ---` separator.
- Added a hidden `<input type="file" multiple accept="...">` element rendered inside the right panel (triggered via ref, never visible).
- Added a **file chips row** inside the textarea card — appears only when at least one file has been loaded; each chip shows a paperclip icon and the filename.
- Added an **"Attach" button** to the bottom toolbar (alongside "Recent" and "Templates") that calls `fileInputRef.current?.click()`.

### `app/layout.tsx`
- Updated page title to **"Story Forge"** and description.
- Added lightning bolt icon in a violet square to the header brand.
- Updated header links (JIRA Settings with external-link icon, Sign out) with dark styling.
- Forced dark background (`bg-zinc-950`) on `<body>`.

### `app/globals.css`
- Removed the `@media (prefers-color-scheme: dark)` block.
- Set dark theme values (`#0a0a0a` / `#ededed`) as the unconditional default so the UI is always dark.

### `components/SignOutButton.tsx`
- Updated button text color from `text-zinc-500` to `text-zinc-400 hover:text-white`.
- Added a sign-out arrow SVG icon next to the label.

---

## Packages Used

No new packages were added. The feature is implemented entirely with browser-native APIs:

| API | Purpose |
|-----|---------|
| `File.text()` | Reads the selected file as a UTF-8 string (Promise-based, no FileReader boilerplate) |
| `useRef` (React) | Holds a reference to the hidden `<input type="file">` so the "Attach" button can trigger it |
| `useState` (React) | `fileChips` array tracks which files have been loaded for display |

---

## Accepted File Types

| Extension | Description |
|-----------|-------------|
| `.txt` | Plain text |
| `.md`, `.markdown` | Markdown |
| `.csv` | CSV spreadsheets |
| `.json` | JSON |
| `.yaml`, `.yml` | YAML |
| `.xml` | XML |
| `.rst` | reStructuredText |

Files outside this list are silently skipped.

---

## Behavior

1. User clicks **Attach** in the toolbar → native OS file picker opens (multi-select enabled).
2. For each valid file: content is appended to the textarea as `{existing text}\n\n--- filename.ext ---\n{file content}`. If the textarea is empty, the file content replaces it directly (no leading separator).
3. Each loaded file name appears as a pill chip between the textarea and toolbar.
4. File content becomes part of the normal generation payload — no API changes required.
