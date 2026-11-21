# Card Editor — Visual Card & Template Editor

**Card Editor** is a client-side web application for designing custom game cards and reusable templates for tabletop RPGs, board games, and card games. Inspired by [Gulix/geckos](https://github.com/gulix/geckos), it is built with **React 19, TypeScript, Vite, and Konva** and runs entirely in the browser with zero backend required.

---

## Features

- **Two Focused Modes**:
  - **Template Designer Mode**: Edit card width and height plus pack/style colors, and add, drag, resize, rotate, mirror, and snap text boxes, rectangles, dropdown layers, image slots, and rich-text layers directly on the canvas. The template preview uses field defaults instead of a particular card's values.
  - **Card Editor Mode**: Start with an empty deck, add or duplicate cards, and fill in forms generated automatically from the active style (text inputs, textareas, dropdowns, image upload/URL fields, and a rich-text editor).
- **Component Transforms**: Every field type supports rotation (`-360` to `360` degrees) and horizontal/vertical mirroring. Use the inspector controls or the Konva transformer handle; the values persist in the template JSON and are applied in PNG/PDF exports.
- **Color & Transparency**: Every color picker offers a palette, a native color wheel, hex entry, a **Transparent** swatch, the `transparent` keyword, and 8-digit `#RRGGBBAA` hex for partial alpha. Rectangle details stack **Remplissage** (fill) above **Contour** (border), and the border width is editable via **Épaisseur contour**.
- **Rich Text Layers**: A `richtext` field type with an inline toolbar (bold, italic, underline, bullet lists, and game-symbol tokens). Content is stored as HTML and rendered on the Konva canvas with matching styling, word wrapping, and alignment.
- **Magnetic Snapping & Alignment Guides**: Snaps layers automatically to canvas edges, centerlines, and neighboring elements with visual alignment guides while dragging.
- **Style Inheritance (`basedOn`)**: Bundle multiple card layouts (e.g., _Base Card_, _Spell_, _Weapon_, _Legendary_) inside a single Template Pack JSON. Child styles inherit dimensions, colors, and layers from parent styles and override only what changes. Reordering an inherited layer creates a `zOnly` override that preserves every other inherited property.
- **Dynamic JavaScript Render Scripts**: Attach custom JS logic to any layer (`script`) to dynamically alter text, colors, geometry, rotation, mirroring, or conditional visibility (`visible`) based on the card's current field values. Supports `const`/`let`, assignment, `if`/`else`, blocks and `return`; syntax/runtime errors report a 1-based line number, and each evaluation has a step budget. An inline script help panel lists the available variables and overrides.
- **Custom Artwork & Linked Images**: Upload local images or link external image URLs with adjustable opacity and bounding frames. In Template Mode, an image layer can be linked to another image layer; all members of a link group then share one source. Card Mode shows a **single** source editor/upload per group (labelled **Source partagée**), and the shared source is used by the live preview and PNG/PDF exports. Uploads open an interactive cropper in both modes with a configurable export resolution; the loaded image can be zoomed from `25%` to `300%` with the mouse wheel, the slider or the +/- buttons (below `100%` the image shrinks inside the frame), and panned by dragging or with the arrow keys. Artwork is compressed and stored as Blobs in IndexedDB while editing; when a template or deck is saved, those local `idb:` refs are replaced by their inline binary data as `data:image/...` base64 URLs, so exported JSON is self-contained. Already inline Data URLs are kept as-is, and object URLs are cleaned up when images are deleted or pruned. Layers can use dynamically loaded Google Fonts.
- **History**: Undo/redo (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, `Ctrl/Cmd+Y`) covers 50 **full-session** snapshots, including the active style, card, layer selection, and mode. `Réinitialiser` returns to the built-in template with an empty deck and clears history so old sessions cannot be undone.
- **Separate Portable Files**: There is no project file and no document autosave. The only save/load notions are the template pack (`*-template.json`) and the card deck (`*-deck.json`). All imports are validated and rich-text HTML is sanitized before rendering. `Ctrl/Cmd+S` saves the deck in Card mode and the template in Template mode. Old combined project JSON is rejected.
- **Print-Ready Exports**:
  - **Single Card PNG**: High-DPI (`2x`) transparent/crisp PNG export of the active card.
  - **Multi-Card PDF Print Sheet**: Automatically arranges your entire deck onto standard paper sheets — A0–A10, Letter, Legal or Tabloid (`300 DPI`) — with proportional real-world millimeter sizing and corner crop marks. Clicking the **Planche PDF** button opens a dialog to choose paper size, portrait or landscape orientation, gutter, sheet margins (`0`–`100` mm, default `10`) and crop marks before generating the file. The printed card width is read-only and derived from the active template at 150 DPI (375 px → 63.5 mm); invalid or empty decks are rejected before layout.
  - **Portable JSON Files**: Save, share, and reload template packs and decks independently. Uploaded images are embedded directly in the JSON as base64 Data URLs, so no IndexedDB lookup is needed on the receiving machine.
  - Exports render from a detached Konva stage, so the live editor is never mutated, preview zoom never affects output, and jsPDF is loaded on demand.
- **Mode-Focused Workspace**: Card Mode shows only deck management, card content fields, and card PNG/PDF + deck file controls, grouped above **Ajouter une Carte**. Template Mode shows only style/layer editing, pack/style colors, and template file controls, with the template Save/Load group above the built-in template list and export group. Save/Load, add, duplicate, and export buttons are icon-only inside action groups labeled **Card**, **Rendu des cartes**, and **Template**.
- **Responsive Layout**: Deck/style controls sit on the left, the card/template preview is in the middle, and all card/template details are on the right of the preview in both modes. The preview is centered when there is room and remains scrollable for oversized cards; the zoom toolbar is pinned above the scroll area so it is always visible.
- **Resilient Error Handling**: Granular React Error Boundaries isolate the canvas, inspector, and root UI, with a real recovery action that repairs the document and remounts the failed subtree. `try/catch` guards protect JSON imports, script execution, and file exports; invalid files show a dismissible banner.
- **Preview Zoom & Accessible Layers**: Zoom from `25%` to `200%` with the toolbar buttons, by typing any percentage directly, or with `Ctrl/Cmd` + wheel. Scaling is performed by Konva so the whole card shrinks or grows without clipping. The layer tree is a keyboard-accessible listbox: `Enter`/`Space` selects, `Alt+↑/↓` reorders, and arrow keys nudge the selected layer in Template mode (hold `Shift` for 10px steps). Each layer also has a duplicate icon that copies all of its current, resolved settings into a new layer directly above it (one undo step).
- **Safe Imports**: Packs/decks are checked for duplicate card/field IDs, inheritance cycles, and bounded sizes (dimensions, counts, strings, script length). Scripts cannot set an image `src` to a cross-origin URL. Incompatible deck styles are remapped to the active style with a warning rather than silently dropping the deck.
- **Built-in Templates**: At launch or refresh, the GUI offers every template module in `src/data` (any `*.ts` file exporting `pack`), listed alphabetically by pack name; the first one is loaded by default. Shipped packs define layout only — no pre-filled field values — and the deck always starts empty: cards only appear after you load a deck file explicitly or add one yourself.

---

## Keyboard & Pointer Controls

| Action                                    | Control                                                       |
| :---------------------------------------- | :------------------------------------------------------------ |
| Undo / redo                               | `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z` or `Ctrl/Cmd+Y`             |
| Save the active file                      | `Ctrl/Cmd+S` (deck in Card mode, template in Template mode)   |
| Select a layer in the tree                | `Enter` or `Space` while the layer is focused                 |
| Reorder a layer                           | Drag it in the tree, or `Alt+↑` / `Alt+↓`                     |
| Duplicate a layer in Template mode        | Duplicate icon on its row in the layer tree                   |
| Nudge the selected layer in Template mode | Arrow keys (`1px`, or `10px` with `Shift`)                    |
| Rotate / mirror a layer                   | Transformer handle in the canvas, or inspector inputs/buttons |
| Zoom the preview                          | Toolbar buttons, editable percentage, or `Ctrl/Cmd` + wheel   |
| Zoom the image in the cropper             | Mouse wheel, slider, or +/- buttons (`25%`–`300%`)            |
| Scroll an oversized preview               | Scrollbars in the preview area; the zoom toolbar stays pinned |

Shortcuts are ignored while typing in text fields, textareas, selects, or the rich-text editor so browser text editing keeps working normally.

---

## Getting Started

### Prerequisites

- **Node.js** 24 LTS (or 22.12+)
- **npm** (v9 or newer)

### Installation & Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev

# 3. Build for production
npm run build

# Other checks
npm run check     # lint + format check + tests + build (use this before committing)
npm test          # Vitest + Testing Library
npm run lint      # ESLint
npm run format    # Prettier
```

---

## Template Pack JSON Format

A template file is a JSON object representing a **Template Pack** containing one or more **Styles**.

### 1. Root Pack Structure

```json
{
  "name": "Fantasy RPG Pack",
  "styles": [
    {
      "key": "base",
      "name": "Base Card",
      "width": 375,
      "height": 525,
      "backgroundColor": "#1e293b",
      "borderColor": "#f59e0b",
      "fields": [ ... ]
    },
    {
      "key": "rare_spell",
      "name": "Rare Spell",
      "basedOn": "base",
      "borderColor": "#a855f7",
      "fields": [ ... ]
    }
  ]
}
```

| Property | Type          | Required | Description                                                      |
| :------- | :------------ | :------- | :--------------------------------------------------------------- |
| `name`   | `string`      | Yes      | Display name of the template pack (used for exported filenames). |
| `styles` | `CardStyle[]` | Yes      | Array of card style definitions available in this pack.          |

---

### 2. Style Object (`CardStyle`)

Each style defines a card layout. Styles can inherit from another style in the same pack using `basedOn`.

| Property          | Type              | Required | Description                                                             |
| :---------------- | :---------------- | :------- | :---------------------------------------------------------------------- |
| `key`             | `string`          | Yes      | Unique identifier for the style (referenced by `basedOn`).              |
| `name`            | `string`          | Yes      | Human-readable style name shown in the style selector.                  |
| `basedOn`         | `string`          | No       | `key` of a parent style to inherit dimensions, colors, and fields from. |
| `width`           | `number`          | Yes*     | Canvas width in pixels (*optional if inherited via `basedOn`).          |
| `height`          | `number`          | Yes*     | Canvas height in pixels (*optional if inherited via `basedOn`).         |
| `backgroundColor` | `string`          | Yes*     | Card fill color in Hex/CSS format (*optional if inherited).             |
| `borderColor`     | `string`          | Yes*     | Outer card border color (*optional if inherited).                       |
| `fields`          | `TemplateField[]` | Yes      | Ordered list of layers (rendered bottom-to-top).                        |

#### How Style Inheritance (`basedOn`) Works

- **Dimensions & Colors**: Child properties override parent properties if defined; otherwise, parent values are kept.
- **Fields Merging**:
  - If a child field shares the same `id` as a parent field, its properties are merged on top of the parent field.
  - If a child field has a new `id`, it is appended to the top of the layer stack.
  - Multi-level inheritance (e.g., `legendary` → `spell` → `base`) is resolved recursively.

---

### 3. Layer / Field Definition (`TemplateField`)

Every item in `fields` defines both a **canvas layer** and a **card editor input** (for interactive types).

#### Common Properties (All Field Types)

| Property         | Type                                                   | Required | Description                                                                                                |
| :--------------- | :----------------------------------------------------- | :------- | :--------------------------------------------------------------------------------------------------------- |
| `id`             | `string`                                               | Yes      | Unique field key used to store values in `card.values[id]`.                                                |
| `label`          | `string`                                               | Yes      | Label displayed in the Inspector and Card Editor form.                                                     |
| `type`           | `"text" \| "box" \| "select" \| "image" \| "richtext"` | Yes      | Determines rendering behavior and input widget type.                                                       |
| `x`              | `number`                                               | Yes      | Horizontal position in pixels from the left edge.                                                          |
| `y`              | `number`                                               | Yes      | Vertical position in pixels from the top edge.                                                             |
| `width`          | `number`                                               | Yes      | Bounding box width in pixels.                                                                              |
| `height`         | `number`                                               | Yes      | Bounding box height in pixels.                                                                             |
| `z`              | `number`                                               | No       | Stacking order within the style (higher is drawn on top).                                                  |
| `zOnly`          | `boolean`                                              | No       | Marks an inherited-field override that changes only `z`.                                                   |
| `fontFamily`     | `string`                                               | No       | Font family for text/select/richtext fields (a Google Font can be loaded).                                 |
| `verticalAlign`  | `"top" \| "middle" \| "bottom"`                        | No       | Vertical alignment of text inside the bounding box (default `"top"`).                                      |
| `lineHeight`     | `number`                                               | No       | Line-height multiplier, `0.5`–`5` (default `1.25`).                                                        |
| `letterSpacing`  | `number`                                               | No       | Extra spacing between characters, in pixels, `-100`–`100` (default `0`).                                   |
| `stroke`         | `string`                                               | No       | Text outline color.                                                                                        |
| `strokeWidth`    | `number`                                               | No       | Text outline width, or rectangle border width, in pixels, `0`–`100` (default `0` for text, `2` for boxes). |
| `opacity`        | `number`                                               | No       | Layer transparency from `0` to `1` (default `1`).                                                          |
| `rotation`       | `number`                                               | No       | Rotation in degrees around the layer's origin, `-360`–`360` (default `0`).                                 |
| `flipX`          | `boolean`                                              | No       | Mirror the layer horizontally (default `false`).                                                           |
| `flipY`          | `boolean`                                              | No       | Mirror the layer vertically (default `false`).                                                             |
| `editableInCard` | `boolean`                                              | No       | Show the field's input in Card Mode (default `true`); set `false` for decoration.                          |
| `script`         | `string`                                               | No       | Optional JavaScript snippet executed before rendering.                                                     |

Every color property (`backgroundColor`, `borderColor`, `color`, `fill`, `stroke`, image/script-provided colors) accepts a 3- or 6-digit hex color, the `transparent` keyword, or an 8-digit `#RRGGBBAA` value for partial transparency. The editor's color pickers expose all of these forms.

#### Type-Specific Properties

- **`type: "text"`** (Renders text on canvas + `<input>` or `<textarea>` in Card Mode)
  - `fontSize` (`number`, default `16`): Font size in pixels.
  - `color` (`string`, default `"#ffffff"`): Text color.
  - `align` (`"left" | "center" | "right"`, default `"left"`): Horizontal text alignment.
  - _Note_: Fields with `height > 60` automatically render a multi-line `<textarea>` in Card Mode.

- **`type: "box"`** (Renders a decorative rectangle or frame; no form input)
  - `fill` (`string`, default `"#0f172a"`): Interior fill color.
  - `color` (`string`, default `"#334155"`): Border stroke color.
  - `strokeWidth` (`number`, default `2`): Border thickness in pixels, `0`–`100`.

- **`type: "select"`** (Renders selected option label on canvas + `<select>` dropdown in Card Mode)
  - `options` (`Array<{ value: string; label: string }>`): List of selectable choices.
  - `defaultValue` (`string`, optional): Initial option `value` for new cards.
  - `fontSize`, `color`, `align`: Same typography options as `"text"`.

- **`type: "richtext"`** (Renders formatted HTML text on canvas + `RichTextEditor` in Card Mode)
  - Uses the same `fontSize`, `fontFamily`, `color`, and `align` options as `"text"`, plus `verticalAlign`, `lineHeight`, `letterSpacing`, `stroke`, and `strokeWidth`.
  - Stores HTML in `card.values[id]` (e.g. `<b>Fire</b> damage`). Supports `<b>/<strong>`, `<i>/<em>`, `<u>`, `<br>`, and `<ul>/<li>`.
  - A `script` can override the rendered HTML by returning `{ text: "<b>...</b>" }`.
- **`type: "image"`** (Renders artwork on canvas + File Upload / URL input in Card Mode)
  - `defaultValue` (`string`, optional): Default fallback image URL or Data URL. A script can override it by returning `{ src: "..." }` for an unlinked image. External URLs render in the live preview even without CORS headers; PNG/PDF export still requires same-origin or CORS-enabled images because it reads canvas pixels.
  - `opacity` (`number`, default `1`): Layer transparency from `0` to `1`.
  - `linkedTo` (`string`, optional): Id of another image field in the same resolved style whose source this image shares. Links may be chained (`C → B → A`); the first image in the chain owns the source. Use `""` to explicitly clear an inherited link. In Template Mode, choose **Image liée à** in the image inspector. Imported packs reject links to missing/non-image fields and cycles.
  - **Shared-source behavior**: Card Mode shows only the group root's input/upload, with a **Source partagée (n)** badge. Editing or removing that source updates every linked image everywhere (preview, PNG, and PDF). A per-field script `src` override is ignored for linked images so the group cannot diverge. If a root is decorative (`editableInCard: false`) but any linked member is editable, the source still gets one editor.

---

## Saving & Loading

Templates and decks are intentionally the only two save/load notions — different files and different control groups. Template pack save/load buttons are placed above the list of built-in templates; deck save/load buttons stay with the deck. There is no document autosave, no localStorage session, no recovery banner, and no pagehide flush: on launch/refresh only the templates in `src/data` are available and the deck is empty. IndexedDB caches uploaded image blobs only for the editing session; saved files embed those images as inline `data:image/...` base64 URLs instead of `idb:` references, so the JSON works on another machine without that database. IndexedDB never restores a template or deck.

| Content                        | Downloaded file             |
| ------------------------------ | --------------------------- |
| Template pack (styles, layers) | `<pack-name>-template.json` |
| Deck (cards and their values)  | `<pack-name>-deck.json`     |

Template file:

```json
{
  "format": "modern-geckos-template",
  "version": 1,
  "pack": { "name": "Fantasy RPG Pack", "styles": [], "activeStyleKey": "base" },
  "activeStyleKey": "base",
  "mode": "card"
}
```

Deck file:

```json
{
  "format": "modern-geckos-deck",
  "version": 1,
  "name": "Mon deck",
  "template": { "name": "Fantasy RPG Pack", "styleKeys": ["base"] },
  "cards": [{ "id": "1", "styleKey": "base", "values": { "title": "Boule de Feu" } }],
  "activeCardId": "1"
}
```

Uploaded images appear in the file as `"art": "data:image/webp;base64,UklGR..."` (template field `defaultValue` or deck card `values`). They are written at save time and read back inline on import, so no conversion step is needed when moving files between browsers. Load the **template first**: a deck only stores `styleKey` references, so the app rejects cards whose style is not present in the currently loaded template. When you load a different template, incompatible cards in the current deck are remapped to the new template's active style and a warning explains what happened — the deck is never silently discarded. Legacy unwrapped packs, single-style templates, and bare `{ "cards": [...] }` decks are still accepted on import; old combined project files are not.

---

## Dynamic JavaScript Render Scripts (`script`)

Any field can include a `script` string to dynamically compute visual overrides when a card is rendered.

### Available Variables

- **`card`**: Record of all field values on the active card (e.g., `card.title`, `card.rarity`, `card.cost`).
- **`style`**: The resolved active `CardStyle` object (`width`, `height`, `backgroundColor`, `borderColor`).
- **`field`**: The base `TemplateField` configuration object.

### Return Object

Return an object containing any properties you want to override at render time:

```js
// Example: Hide field if cost is 0, turn text red when cost >= 5,
// and mirror the layer when the card is legendary.
const cost = Number(card.cost || 0);
return {
  text: cost > 0 ? `Cost: ${cost}` : '',
  color: cost >= 5 ? '#ef4444' : '#38bdf8',
  visible: cost > 0,
  rotation: card.rarity === 'legendary' ? 12 : 0,
  flipX: card.rarity === 'legendary',
};
```

Supported override keys: `text`, `visible`, `color`, `fill`, `x`, `y`, `width`, `height`, `fontSize`, `opacity`, `rotation`, `flipX`, `flipY`, `src`.

Scripts run in a restricted interpreter: plain data, arithmetic/logic operators, object/array literals, template literals, `const`/`let`, assignment, `if`/`else` with blocks, `return`, and a small allowlist of helpers (`Number`, `String`, `Boolean`, `parseInt`, `parseFloat`, `Math`, string/array methods) are available. There is no access to the DOM, network, or host objects. Syntax and runtime errors report a 1-based line number, and each evaluation has a step budget so loops or deep expressions cannot freeze the UI. Numeric overrides must be finite and are clamped to safe ranges, result strings are bounded, and `src` may only be a `data:image/…`, `blob:`, relative, or same-origin URL (cross-origin sources are ignored so card data cannot be exfiltrated).

> **Design Mode Tip**: When a script sets `visible: false`, the layer is hidden in **Card Mode** and PNG/PDF exports, but remains visible at `35%` opacity in **Template Mode** so you can still select and move it.

---

## Project Structure

```text
src/
├── components/
│   ├── DraggableFieldNode.tsx # Canvas renderer for all field types (drag/resize/select)
│   ├── DeckIOControls.tsx     # Deck save/load buttons
│   ├── editorPanels.tsx       # Error banner, zoom, script help, PDF dialog
│   ├── ErrorBoundary.tsx      # React Error Boundary with recovery UI
│   ├── ImageCropper.tsx       # Interactive image cropper
│   ├── ColorPicker.tsx        # Spectrum & palette color picker
│   ├── RichTextEditor.tsx     # ContentEditable toolbar + HTML-to-segments parser
│   ├── RichTextNode.tsx       # Konva node that draws rich text as styled runs
│   ├── TemplateIOControls.tsx # Template save/load buttons
│   ├── uiStyles.ts            # Shared inline styles for controls and dialogs
│   └── index.tsx              # Component barrel exports
├── io/
│   ├── db.ts                  # Shared IndexedDB connection (images)
│   ├── deckIO.ts              # Deck file format
│   ├── fileIO.ts              # File reading / download helpers
│   ├── formats.ts             # Format identifiers and filename helpers
│   ├── imageEmbedding.ts      # Replaces `idb:` refs with inline Data URLs on save
│   ├── imageStore.ts          # IndexedDB artwork blobs + `idb:` refs
│   └── templateIO.ts          # Template file format
├── data/
│   ├── index.ts               # Discovers every `pack` exported from `src/data/*.ts`
│   └── examplePack.ts         # Built-in template pack (no default card content)
├── hooks/
│   ├── useImage.ts            # Resolves `idb:` refs into loaded images
│   └── useUndoableDocument.ts # Pack + deck undo/redo history
├── i18n/
│   └── strings.ts             # Centralized UI copy
├── test/
│   └── setup.ts               # jsdom / canvas test setup
├── types/
│   └── template.ts            # Template pack, style, field & card data types
├── utils/
│   ├── cardRenderer.ts        # Detached Konva renderer for PNG/PDF exports
│   ├── FontLoader.ts          # Dynamic Google Fonts loader
│   ├── imageLinks.ts          # Shared-source resolution for linked image fields
│   ├── imageLoader.ts         # Shared image load / convert / compress helpers
│   ├── duplicateField.ts      # Component duplication with resolved attributes
│   ├── pdfExporter.ts         # Multi-card print layout & crop marks (jsPDF)
│   ├── paperFormats.ts        # Paper sizes available in the PDF options dialog
│   ├── printSize.ts           # Template pixels → printed millimetres (150 DPI)
│   ├── richTextLayout.ts      # Word-wrap & alignment for styled rich-text runs
│   ├── sanitize.ts            # DOMPurify HTML sanitization
│   ├── scriptEvaluator.ts     # Restricted field script evaluation & override sanitizing
│   ├── scriptInterpreter.ts   # Dependency-free restricted JS interpreter
│   ├── snapGuides.ts          # Magnetic alignment & visual guide calculations
│   ├── styleResolver.ts       # Recursive `basedOn` template style inheritance
│   ├── numbers.ts             # Safe numeric-input clamping
│   └── templateValidation.ts  # Runtime validation for imported packs/decks
├── App.tsx                    # Main workspace, Konva stage, & inspector panels
└── main.tsx                   # Application entry point
```
