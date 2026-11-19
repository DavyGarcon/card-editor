# Modern Geckos — Visual Card & Template Editor

**Modern Geckos** is a client-side web application for designing custom game cards and reusable templates for tabletop RPGs, board games, and card games. Inspired by [Gulix/geckos](https://github.com/gulix/geckos), it is built with **React 19, TypeScript, Vite, and Konva** and runs entirely in the browser with zero backend required.

---

## Features

- **Dual-Mode Workspace**:
  - **Template Designer Mode**: Drag, resize, and snap text boxes, frames, dropdown-driven layers, and image slots directly on the HTML5 canvas.
  - **Card Editor Mode**: Automatically generates tailored input forms (text fields, multi-line textareas, dropdown menus, image uploaders, and a rich-text editor) from the active template style.
- **Rich Text Layers**: A `richtext` field type with an inline toolbar (bold, italic, underline, bullet lists, and game-symbol tokens). Content is stored as HTML and rendered on the Konva canvas with matching styling, word wrapping, and alignment.
- **Magnetic Snapping & Alignment Guides**: Snaps layers automatically to canvas edges, centerlines, and neighboring elements with visual alignment guides while dragging.
- **Style Inheritance (`basedOn`)**: Bundle multiple card layouts (e.g., _Base Card_, _Spell_, _Weapon_, _Legendary_) inside a single Template Pack JSON. Child styles inherit dimensions, colors, and layers from parent styles and override only what changes.
- **Dynamic JavaScript Render Scripts**: Attach custom JS logic to any layer (`script`) to dynamically alter text, colors, positions, or conditional visibility (`visible`) based on the card's current field values.
- **Custom Artwork Support**: Upload local images (stored as Data URLs) or link external image URLs with adjustable opacity and bounding frames. Uploads open an interactive cropper; inspector colors use a palette picker, and layers can use dynamically loaded Google Fonts.
- **Autosave & History**: The template and deck autosave to **two independent `localStorage` keys**. Undo/redo (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`) covers 50 document snapshots.
- **Separate Portable Files**: The template pack saves to `*-template.json` and the deck saves to `*-deck.json`, each with its own load button group. All imports are validated and rich-text HTML is sanitized before rendering. `Ctrl/Cmd+S` saves the deck in Card mode and the template in Template mode.
- **Print-Ready Exports**:
  - **Single Card PNG**: High-DPI (`2x`) transparent/crisp PNG export of the active card.
  - **Multi-Card A4 PDF Print Sheet**: Automatically arranges your entire deck onto A4 pages (`300 DPI`) with proportional real-world millimeter sizing and corner crop marks.
  - **Portable JSON Files**: Save, share, and reload template packs and decks independently.
  - Exports render from a detached Konva stage, so the live editor is never mutated and jsPDF is loaded on demand.
- **Mode-Focused Workspace**: Card Mode shows only deck management, card content fields, and card PNG/PDF + deck file controls. Template Mode shows only style/layer editing and template file controls. The template preview uses field defaults instead of a specific card's values.
- **Responsive Layout**: Deck/style controls and the inspector sit in a left column with the card/template preview on the right; on phones the preview moves below the details.
- **Resilient Error Handling**: Granular React Error Boundaries isolate the canvas, inspector, and root UI, while `try/catch` guards protect JSON imports, script execution, and file exports.

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

| Property | Type                                                   | Required | Description                                                 |
| :------- | :----------------------------------------------------- | :------- | :---------------------------------------------------------- |
| `id`     | `string`                                               | Yes      | Unique field key used to store values in `card.values[id]`. |
| `label`  | `string`                                               | Yes      | Label displayed in the Inspector and Card Editor form.      |
| `type`   | `"text" \| "box" \| "select" \| "image" \| "richtext"` | Yes      | Determines rendering behavior and input widget type.        |
| `x`      | `number`                                               | Yes      | Horizontal position in pixels from the left edge.           |
| `y`      | `number`                                               | Yes      | Vertical position in pixels from the top edge.              |
| `width`  | `number`                                               | Yes      | Bounding box width in pixels.                               |
| `height` | `number`                                               | Yes      | Bounding box height in pixels.                              |
| `script` | `string`                                               | No       | Optional JavaScript snippet executed before rendering.      |

#### Type-Specific Properties

- **`type: "text"`** (Renders text on canvas + `<input>` or `<textarea>` in Card Mode)
  - `fontSize` (`number`, default `16`): Font size in pixels.
  - `color` (`string`, default `"#ffffff"`): Text color.
  - `align` (`"left" | "center" | "right"`, default `"left"`): Horizontal text alignment.
  - _Note_: Fields with `height > 60` automatically render a multi-line `<textarea>` in Card Mode.

- **`type: "box"`** (Renders a decorative rectangle or frame; no form input)
  - `fill` (`string`, default `"#0f172a"`): Interior fill color.
  - `color` (`string`, default `"#334155"`): Border stroke color.

- **`type: "select"`** (Renders selected option label on canvas + `<select>` dropdown in Card Mode)
  - `options` (`Array<{ value: string; label: string }>`): List of selectable choices.
  - `defaultValue` (`string`, optional): Initial option `value` for new cards.
  - `fontSize`, `color`, `align`: Same typography options as `"text"`.

- **`type: "richtext"`** (Renders formatted HTML text on canvas + `RichTextEditor` in Card Mode)
  - Uses the same `fontSize`, `color`, and `align` options as `"text"`.
  - Stores HTML in `card.values[id]` (e.g. `<b>Fire</b> damage`). Supports `<b>/<strong>`, `<i>/<em>`, `<u>`, `<br>`, and `<ul>/<li>`.
  - A `script` can override the rendered HTML by returning `{ text: "<b>...</b>" }`.
- **`type: "image"`** (Renders artwork on canvas + File Upload / URL input in Card Mode)
  - `defaultValue` (`string`, optional): Default fallback image URL or Data URL. A script can override it by returning `{ src: "..." }`.
  - `opacity` (`number`, default `1`): Layer transparency from `0` to `1`.

---

## Saving & Loading

Templates and decks are intentionally separate — different files, different autosave keys, different toolbar groups.

| Content                        | Downloaded file             | Autosave key                |
| ------------------------------ | --------------------------- | --------------------------- |
| Template pack (styles, layers) | `<pack-name>-template.json` | `modern-geckos-template-v1` |
| Deck (cards and their values)  | `<pack-name>-deck.json`     | `modern-geckos-deck-v1`     |

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

Load the **template first**: a deck only stores `styleKey` references, so the app rejects cards whose style is not present in the currently loaded template. Legacy unwrapped packs, single-style templates, bare `{ "cards": [...] }` decks, and old combined project files are still accepted on import.

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
// Example: Hide field if cost is 0, and turn text red when cost >= 5
const cost = Number(card.cost || 0);
return {
  text: cost > 0 ? `Cost: ${cost}` : '',
  color: cost >= 5 ? '#ef4444' : '#38bdf8',
  visible: cost > 0,
};
```

Supported override keys: `text`, `visible`, `color`, `fill`, `x`, `y`, `width`, `height`, `fontSize`, `opacity`, `src`.

Scripts run in a restricted interpreter: only plain data, arithmetic/logic operators, object/array literals, template literals, `const`/`let`, `return`, and a small allowlist of helpers (`Number`, `String`, `Boolean`, `parseInt`, `parseFloat`, `Math`, string/array methods) are available. There is no access to the DOM, network, or host objects.

> **Design Mode Tip**: When a script sets `visible: false`, the layer is hidden in **Card Mode** and PNG/PDF exports, but remains visible at `35%` opacity in **Template Mode** so you can still select and move it.

---

## Project Structure

```text
src/
├── components/
│   ├── DraggableFieldNode.tsx # Canvas renderer for all field types (drag/resize/select)
│   ├── DeckIOControls.tsx     # Deck save/load buttons
│   ├── ErrorBoundary.tsx      # React Error Boundary with recovery UI
│   ├── ImageCropper.tsx       # Interactive image cropper
│   ├── ColorPicker.tsx        # Spectrum & palette color picker
│   ├── RichTextEditor.tsx     # ContentEditable toolbar + HTML-to-segments parser
│   ├── RichTextNode.tsx       # Konva node that draws rich text as styled runs
│   ├── TemplateIOControls.tsx # Template save/load buttons
│   └── index.tsx              # Component barrel exports
├── io/
│   ├── deckIO.ts              # Deck file format + deck autosave
│   ├── fileIO.ts              # File reading / download helpers
│   ├── formats.ts             # Format identifiers and filename helpers
│   └── templateIO.ts          # Template file format + template autosave
├── data/
│   └── starterPack.ts         # Default template pack & example deck
├── hooks/
│   └── useUndoableDocument.ts # Pack + deck undo/redo history
├── test/
│   └── setup.ts               # jsdom / canvas test setup
├── types/
│   └── template.ts            # Template pack, style, field & card data types
├── utils/
│   ├── cardRenderer.ts        # Detached Konva renderer for PNG/PDF exports
│   ├── FontLoader.ts          # Dynamic Google Fonts loader
│   ├── pdfExporter.ts         # A4 multi-card print layout & crop marks (jsPDF)
│   ├── richTextLayout.ts      # Word-wrap & alignment for styled rich-text runs
│   ├── sanitize.ts            # DOMPurify HTML sanitization
│   ├── scriptEvaluator.ts     # Restricted field script evaluation & override sanitizing
│   ├── scriptInterpreter.ts   # Dependency-free restricted JS interpreter
│   ├── snapGuides.ts          # Magnetic alignment & visual guide calculations
│   ├── styleResolver.ts       # Recursive `basedOn` template style inheritance
│   └── templateValidation.ts  # Runtime validation for imported packs/decks
├── App.tsx                    # Main workspace, Konva stage, & inspector panels
└── main.tsx                   # Application entry point
```
