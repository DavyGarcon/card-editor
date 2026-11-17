# Card-editor — Visual Card & Template Editor

**Card-editor** is a client-side web application for designing custom game cards and reusable templates for tabletop RPGs, board games, and card games. Inspired by [Gulix/geckos](https://github.com/gulix/geckos), it is built with **React 19, TypeScript, Vite, and Konva** and runs entirely in the browser with zero backend required.

---

## Features

* **Dual-Mode Workspace**:
  * **Template Designer Mode**: Drag, resize, and snap text boxes, frames, dropdown-driven layers, and image slots directly on the HTML5 canvas.
  * **Card Editor Mode**: Automatically generates tailored input forms (text fields, multi-line textareas, dropdown menus, and image uploaders) from the active template style.
* **Magnetic Snapping & Alignment Guides**: Snaps layers automatically to canvas edges, centerlines, and neighboring elements with visual alignment guides while dragging.
* **Style Inheritance (`basedOn`)**: Bundle multiple card layouts (e.g., *Base Card*, *Spell*, *Weapon*, *Legendary*) inside a single Template Pack JSON. Child styles inherit dimensions, colors, and layers from parent styles and override only what changes.
* **Dynamic JavaScript Render Scripts**: Attach custom JS logic to any layer (`script`) to dynamically alter text, colors, positions, or conditional visibility (`visible`) based on the card's current field values.
* **Custom Artwork Support**: Upload local images (stored as Data URLs) or link external image URLs with adjustable opacity and bounding frames.
* **Print-Ready Exports**:
  * **Single Card PNG**: High-DPI (`2x`) transparent/crisp PNG export of the active card.
  * **Multi-Card A4 PDF Print Sheet**: Automatically arranges your entire deck onto A4 pages (`300 DPI`) with proportional real-world millimeter sizing and corner crop marks.
  * **Portable JSON Templates**: Save, share, and reload template packs anytime.
* **Resilient Error Handling**: Granular React Error Boundaries isolate the canvas, inspector, and root UI, while `try/catch` guards protect JSON imports, script execution, and file exports.

---

## Getting Started

### Prerequisites
* **Node.js** (v18 or newer)
* **npm** (v9 or newer)

### Installation & Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev

# 3. Build for production
npm run build
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

| Property | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | `string` | Yes | Display name of the template pack (used for exported filenames). |
| `styles` | `CardStyle[]` | Yes | Array of card style definitions available in this pack. |

---

### 2. Style Object (`CardStyle`)

Each style defines a card layout. Styles can inherit from another style in the same pack using `basedOn`.

| Property | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `key` | `string` | Yes | Unique identifier for the style (referenced by `basedOn`). |
| `name` | `string` | Yes | Human-readable style name shown in the style selector. |
| `basedOn` | `string` | No | `key` of a parent style to inherit dimensions, colors, and fields from. |
| `width` | `number` | Yes* | Canvas width in pixels (*optional if inherited via `basedOn`). |
| `height` | `number` | Yes* | Canvas height in pixels (*optional if inherited via `basedOn`). |
| `backgroundColor` | `string` | Yes* | Card fill color in Hex/CSS format (*optional if inherited). |
| `borderColor` | `string` | Yes* | Outer card border color (*optional if inherited). |
| `fields` | `TemplateField[]` | Yes | Ordered list of layers (rendered bottom-to-top). |

#### How Style Inheritance (`basedOn`) Works
* **Dimensions & Colors**: Child properties override parent properties if defined; otherwise, parent values are kept.
* **Fields Merging**:
  * If a child field shares the same `id` as a parent field, its properties are merged on top of the parent field.
  * If a child field has a new `id`, it is appended to the top of the layer stack.
  * Multi-level inheritance (e.g., `legendary` → `spell` → `base`) is resolved recursively.

---

### 3. Layer / Field Definition (`TemplateField`)

Every item in `fields` defines both a **canvas layer** and a **card editor input** (for interactive types).

#### Common Properties (All Field Types)

| Property | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | `string` | Yes | Unique field key used to store values in `card.values[id]`. |
| `label` | `string` | Yes | Label displayed in the Inspector and Card Editor form. |
| `type` | `"text" \| "box" \| "select" \| "image"` | Yes | Determines rendering behavior and input widget type. |
| `x` | `number` | Yes | Horizontal position in pixels from the left edge. |
| `y` | `number` | Yes | Vertical position in pixels from the top edge. |
| `width` | `number` | Yes | Bounding box width in pixels. |
| `height` | `number` | Yes | Bounding box height in pixels. |
| `script` | `string` | No | Optional JavaScript snippet executed before rendering. |

#### Type-Specific Properties

* **`type: "text"`** (Renders text on canvas + `<input>` or `<textarea>` in Card Mode)
  * `fontSize` (`number`, default `16`): Font size in pixels.
  * `color` (`string`, default `"#ffffff"`): Text color.
  * `align` (`"left" | "center" | "right"`, default `"left"`): Horizontal text alignment.
  * *Note*: Fields with `height > 60` automatically render a multi-line `<textarea>` in Card Mode.

* **`type: "box"`** (Renders a decorative rectangle or frame; no form input)
  * `fill` (`string`, default `"#0f172a"`): Interior fill color.
  * `color` (`string`, default `"#334155"`): Border stroke color.

* **`type: "select"`** (Renders selected option label on canvas + `<select>` dropdown in Card Mode)
  * `options` (`Array<{ value: string; label: string }>`): List of selectable choices.
  * `defaultValue` (`string`, optional): Initial option `value` for new cards.
  * `fontSize`, `color`, `align`: Same typography options as `"text"`.

* **`type: "image"`** (Renders artwork on canvas + File Upload / URL input in Card Mode)
  * `src` (`string`, optional): Default fallback image URL or Data URL.
  * `opacity` (`number`, default `1`): Layer transparency from `0` to `1`.

---

## Dynamic JavaScript Render Scripts (`script`)

Any field can include a `script` string to dynamically compute visual overrides when a card is rendered.

### Available Variables
* **`card`**: Record of all field values on the active card (e.g., `card.title`, `card.rarity`, `card.cost`).
* **`template`**: The resolved active `CardStyle` object (`width`, `height`, `backgroundColor`, `borderColor`).
* **`field`**: The base `TemplateField` configuration object.

### Return Object
Return an object containing any properties you want to override at render time:

```js
// Example: Hide field if cost is 0, and turn text red when cost >= 5
const cost = Number(card.cost || 0);
return {
  text: cost > 0 ? `Cost: ${cost}` : '',
  color: cost >= 5 ? '#ef4444' : '#38bdf8',
  visible: cost > 0
};
```

Supported override keys: `text`, `visible`, `color`, `fill`, `x`, `y`, `width`, `height`, `fontSize`.

> **Design Mode Tip**: When a script sets `visible: false`, the layer is hidden in **Card Mode** and PNG/PDF exports, but remains visible at `35%` opacity in **Template Mode** so you can still select and move it.

---

## Project Structure

```text
src/
├── components/
│   └── ErrorBoundary.tsx      # React Error Boundary with recovery UI
├── utils/
│   ├── pdfExporter.ts         # A4 multi-card print layout & crop marks (jsPDF)
│   ├── scriptEvaluator.ts     # Safe sandboxed evaluation for field JS scripts
│   ├── snapGuides.ts          # Magnetic alignment & visual guide calculations
│   └── styleResolver.ts       # Recursive `basedOn` template style inheritance
├── App.tsx                    # Main workspace, Konva stage, & inspector panels
└── main.tsx                   # Application entry point
```

