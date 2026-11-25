# Card Editor — Visual Card & Template Editor

**Card Editor** is a client-side web application for designing custom game cards and reusable templates for tabletop RPGs, board games, and card games. Inspired by [Gulix/geckos](https://github.com/gulix/geckos), it is built with **React 19, TypeScript, Vite, and Konva** and runs entirely in the browser with zero backend required.

---

## Features

- **Two Focused Modes**:
  - **Template Designer Mode**: Edit card width and height plus pack/style colors, and add, drag, resize, rotate, mirror, and snap text boxes, rectangles, dropdown layers, image slots, and rich-text layers directly on the canvas. The template preview uses field defaults instead of a particular card's values.
  - **Card Editor Mode**: Start with an empty deck, add or duplicate cards, and fill in forms generated automatically from the active style (single-row or multi-row textareas, dropdowns, image upload/URL fields, and a rich-text editor). Add or load a card before editing its content fields.
- **Component Transforms**: Every field type supports rotation and horizontal/vertical mirroring. The inspector clamps rotation to `-360`–`360` degrees; values produced by dragging the Konva transformer handle are saved as-is until the template is validated on import. The values persist in the template JSON and are applied in PNG/PDF exports.
- **Color & Transparency**: Every color picker offers a palette, a native color wheel, hex entry, a **Transparent** swatch, the `transparent` keyword, and 8-digit `#RRGGBBAA` hex for partial alpha. Rectangle details stack **Remplissage** (fill) above **Contour** (border), and the border width is editable via **Épaisseur contour**.
- **Rich Text Layers**: A `richtext` field type with an inline toolbar (bold, italic, underline, bullet lists, and game-symbol tokens). Content is stored as HTML and rendered on the Konva canvas with matching styling, word wrapping, and alignment.
- **Magnetic Snapping & Alignment Guides**: Snaps layers automatically to canvas edges, centerlines, and neighboring elements with visual alignment guides while dragging.
- **Style Inheritance (`basedOn`)**: Bundle multiple card layouts (e.g., _Base Card_, _Spell_, _Weapon_, _Legendary_) inside a single Template Pack JSON. Child styles inherit dimensions, colors, and layers from parent styles and override only what changes. Saving a pack rewrites each child style as a minimal diff: unchanged fields and properties are dropped and resolved from the parent on load. Reordering an inherited layer creates a `zOnly` override that preserves every other inherited property.
- **Dynamic JavaScript Render Scripts**: Attach custom JS logic to any layer (`script`) to dynamically alter text, colors, geometry, rotation, mirroring, or conditional visibility (`visible`) based on the card's current field values. Supports `const`/`let`, assignment, `if`/`else`, blocks and `return`; syntax/runtime errors report a 1-based line number, and each evaluation has a step budget. An inline script help panel lists the main variables and override keys. There is no separate JavaScript field type: select a layer in Template mode and paste the script into **Script JS de rendu**.
- **Custom Artwork & Linked Images**: Upload local images or link external image URLs with adjustable opacity and bounding frames. In Template Mode, an image layer can be linked to another image layer; all members of a link group then share one source. Card Mode shows a **single** source editor/upload per group (labelled **Source partagée**), and the shared source is used by the live preview and PNG/PDF exports. Local uploads open an interactive cropper in Card Mode for every image source; in Template Mode the upload/cropper is offered only for image layers marked non-editable, while other image layers are set by URL/default value. The cropper has a configurable export resolution; the loaded image can be zoomed from `25%` to `300%` with the mouse wheel, the editable zoom field (`Zoom (%)`: type `150` or `150%`) or the +/- buttons (below `100%` the image shrinks inside the frame), and panned by dragging or with the arrow keys at any zoom level. Zooming stays anchored on the pointed position (or the last hovered point for the buttons/field), so the image can be repositioned while zooming in or out. Artwork is compressed and stored as Blobs in IndexedDB while editing; when a template or deck is saved, available local `idb:` refs are replaced by inline `data:image/...` base64 URLs, making the JSON portable. Missing blobs remain as `idb:` references. Already inline Data URLs are kept as-is. Unused blobs/object URLs are revoked by pruning after a card is deleted; clearing or replacing an image field does not immediately delete its blob. Layers can use dynamically loaded Google Fonts.
- **History**: Undo/redo (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, `Ctrl/Cmd+Y`) covers 50 **full-session** snapshots. Snapshots include the active style, card, layer selection, and mode, but pure selection or mode switches are not separate undo steps. `Réinitialiser` performs a full reset to the first built-in template with an empty deck and clears history so old sessions cannot be undone.
- **Separate Portable Files**: There is no project file and no document autosave. The only save/load notions are the template pack (`*-template.json`) and the card deck (`*-deck.json`). All imports are validated and rich-text HTML is sanitized before rendering. `Ctrl/Cmd+S` saves the deck in Card mode and the template in Template mode. Old combined project JSON is rejected.
- **Print-Ready Exports**:
  - **Single Card PNG**: High-DPI (`2x`, about 550 DPI at the template scale) transparent/crisp PNG export of the active card.
  - **Multi-Card PDF Print Sheet**: Automatically arranges your deck onto standard paper sheets — A0–A10, Letter, Legal or Tabloid — with real-world millimeter sizing and corner crop marks. Card images are rasterized at `3x` template resolution. Clicking the **Planche PDF** button opens a dialog to choose paper size, portrait or landscape orientation, the template **DPI du modèle** (`50`–`1200`, default about `276.4`, i.e. 370 px = 34 mm), spacing (**Espacement**, `0`–`20` mm, default `2`), sheet margins (`0`–`100` mm, default `10`) and crop marks before generating the file. The printed card width is read-only and derived from each card's own template style and the chosen DPI (at the default, 375 px → 34.5 mm). Mixed-style decks show the distinct widths and print every card at its real size, packed side by side so the requested spacing is the actual gap between card edges; each card's height follows its own aspect ratio, so a 370 px-tall card prints at 34 mm. Changing the DPI immediately updates the displayed width(s). An empty deck produces no PDF (the button is not disabled and no warning is shown).
  - **Portable JSON Files**: Save, share, and reload template packs and decks independently. Uploaded images are embedded directly in the JSON as base64 Data URLs, so no IndexedDB lookup is needed on the receiving machine.
  - Exports render from a detached Konva stage, so the live editor is never mutated, preview zoom never affects output, and jsPDF is loaded on demand.
- **Mode-Focused Workspace**: Both modes keep the built-in template and active-style selectors; only the surrounding editing panels are mode-specific. Card Mode shows deck management, card content fields, and card PNG/PDF + deck file controls, grouped above **Ajouter une Carte**. Template Mode shows style/layer editing, pack/style colors, and template file controls; the template Save/Load group sits below the built-in template and active-style selectors. Icon-only Save/Load, add, duplicate, and export buttons live in action groups labeled **Deck (n)**, **Card**, **Rendu des cartes**, and **Template**.
- **Responsive Layout**: Deck/style controls sit on the left, the card/template preview is in the middle, and all card/template details are on the right of the preview. Below 600px the columns stack with the preview first. The preview is centered when there is room and remains scrollable for oversized cards; the zoom toolbar is pinned above the scroll area so it is always visible.
- **Resilient Error Handling**: Granular React Error Boundaries isolate the canvas, inspector, and root UI; the recovery action performs a full reset to the built-in template with an empty deck and remounts the failed subtree. `try/catch` guards protect JSON imports, script execution, and file exports; invalid files show a dismissible banner.
- **Preview Zoom & Accessible Layers**: Zoom from `25%` to `200%` with the toolbar buttons, by typing any percentage directly, or with `Ctrl/Cmd` + wheel. Scaling is performed by Konva so the whole card shrinks or grows without clipping. The layer tree is a keyboard-accessible listbox: `Enter`/`Space` selects, `Alt+↑/↓` reorders, and arrow keys nudge the selected layer in Template mode (hold `Shift` for 10px steps). Each layer also has a duplicate icon that copies all of its current, resolved settings into a new layer directly above it (one undo step).
- **Safe Imports**: Packs/decks are checked for duplicate card/field IDs, inheritance cycles, and bounded sizes (dimensions, counts, strings, script length). Scripts cannot set an image `src` to a cross-origin URL. Incompatible deck styles are remapped to the active style with a warning rather than silently dropping the deck.
- **Built-in Templates**: At launch or refresh, the GUI offers every `*.json` template file in `src/data` except `*.test.json` (bare pack or full saved template session). They are listed alphabetically by pack name; the first one is loaded by default. The repository currently ships `examplePack.json` and `jdr-pack-template.json`. Only its `pack` section is used at startup — any wrapper `format`/`mode` is ignored and the editor always starts in Card mode. Shipped packs define layout only — no pre-filled field values — and the deck always starts empty: cards only appear after you load a deck file explicitly or add one yourself.

---

## Keyboard & Pointer Controls

| Action                                    | Control                                                                                                                |
| :---------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| Undo / redo                               | `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z` or `Ctrl/Cmd+Y`                                                                      |
| Save the active file                      | `Ctrl/Cmd+S` (deck in Card mode, template in Template mode)                                                            |
| Select a layer in the tree                | `Enter` or `Space` while the layer is focused                                                                          |
| Reorder a layer                           | Drag it in the tree, or `Alt+↑` / `Alt+↓`                                                                              |
| Duplicate a layer in Template mode        | Duplicate icon on its row in the layer tree                                                                            |
| Nudge the selected layer in Template mode | Arrow keys (`1px`, or `10px` with `Shift`)                                                                             |
| Rotate / mirror a layer                   | Transformer handle in the canvas, or inspector inputs/buttons                                                          |
| Zoom the preview                          | Toolbar buttons, editable percentage, or `Ctrl/Cmd` + wheel                                                            |
| Move / zoom the image in the cropper      | Drag the preview or arrows to pan; wheel, editable zoom field or +/- buttons to zoom around the pointer (`25%`–`300%`) |
| Scroll an oversized preview               | Scrollbars in the preview area; the zoom toolbar stays pinned                                                          |

Shortcuts are ignored while typing in text fields, textareas, selects, or the rich-text editor so browser text editing keeps working normally. Card content fields require an active card: add or load one before editing them.

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

A style can set `basedOn` to the `key` of another style in the same pack. Rather than copying that layout, the child stores **only the differences** and the editor builds a **resolved style** on demand: it starts from the parent, then applies the child's overrides. The resolved style is what the canvas, forms, and PNG/PDF exports render — a child definition is never drawn directly.

##### 1. Resolving the chain

Resolution walks from the root parent down to the active style:

1. Start with the root style (the one without `basedOn`), filling in any missing values with defaults (`width: 375`, `height: 525`, `backgroundColor: #1e293b`, `borderColor: #f59e0b`).
2. For each child, copy the parent's fields, then apply the child's fields on top.
3. Repeat until the active style is reached.

Chains can be any depth, for example `legendary` → `spell` → `base`. Inheritance cycles are rejected on import, so resolution always terminates.

##### 2. Style-level properties

`width`, `height`, `backgroundColor`, and `borderColor` follow one rule: **the child's value wins if present, otherwise the parent's is kept**. A child therefore only declares what it wants to change:

```json
{
  "key": "rare_spell",
  "name": "Rare Spell",
  "basedOn": "base",
  "borderColor": "#a855f7",
  "fields": []
}
```

This card keeps the base width, height and background; only the border color changes.

##### 3. Field merging

Fields are matched by their `id`:

- **Same `id` as a parent field** → a **partial override**: only the properties it declares replace the parent's values, everything else is inherited. In the file, such an override needs just `id` and `type` plus the changed keys, e.g. `{ "id": "title", "type": "text", "fontSize": 24 }`.
- **New `id`** → a **new layer**, stored in full (all properties) and appended above the inherited layers (fields are drawn bottom-to-top).
- **`zOnly: true`** → a special override that changes **only the stacking order** (`z`) and preserves every other inherited property. Later edits to the parent still flow through to that layer.

Other properties, including an image's `linkedTo`, take part in the same merge.

##### 4. What gets written when you save

`Ctrl/Cmd+S` in Template mode compacts every child style into a minimal diff against its **resolved parent** before writing the file:

- Unchanged fields are removed from the child's `fields` entirely.
- Changed fields keep only `id`, `type` (retained as a schema/sanitization discriminator) and the properties that actually differ from the parent.
- New field ids are kept in full.
- A reorder is serialized as `{ "id": "...", "type": "...", "z": 4, "zOnly": true }`.
- Style-level `width`, `height`, `backgroundColor`, `borderColor` equal to the parent are dropped.

For example, a `rare_spell` child that only enlarges `title` and adds a `glow` box is saved as:

```json
{
  "key": "rare_spell",
  "name": "Rare Spell",
  "basedOn": "base",
  "fields": [
    { "id": "title", "type": "text", "fontSize": 24 },
    {
      "id": "glow",
      "label": "Glow",
      "type": "box",
      "x": 20,
      "y": 20,
      "width": 335,
      "height": 485,
      "color": "#a855f7",
      "strokeWidth": 3
    }
  ]
}
```

On reload, `resolveCardStyle` rebuilds the exact same layout, so saving and reloading never changes what you see. Older files that store full child definitions still load unchanged; they are compacted the next time you save.

##### 5. Editing inherited styles in the UI

- Both **+ Variante (basedOn)** and **+ Nouveau Style** start with an empty layer list: a new child contains no layers of its own until you edit or add one.
- Choosing a parent in **Hérite du style (basedOn)** drops any local definition of a field that already exists in the parent, so switching a style to inherit does not silently override the parent's fields.
- Duplicating a layer gives the copy a free stacking slot (a `z` between its neighbours) instead of renumbering the whole stack, so duplication does not create `zOnly` overrides for the inherited layers.
- Reordering a layer in the tree does create a `zOnly` override for that one layer, leaving the rest inherited.

The result is that a child style contains only the layers you actually edited or added — everything else keeps coming from the parent.

##### 6. Import validation

Partial overrides are accepted only on child styles that declare `basedOn`; a root style must contain complete field definitions. After merging, the resolved field is validated as a whole — it must have `id`, `type`, `label`, `x`, `y`, `width`, `height` — so an incomplete override that cannot produce a valid field is rejected on import. Rich-text HTML in overrides is sanitized exactly as in root styles.

---

### 3. Layer / Field Definition (`TemplateField`)

Every item in `fields` defines both a **canvas layer** and a **card editor input** (for interactive types).

#### Common Properties (All Field Types)

| Property         | Type                                                   | Required | Description                                                                                                                                                                              |
| :--------------- | :----------------------------------------------------- | :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`             | `string`                                               | Yes      | Unique field key used to store values in `card.values[id]`.                                                                                                                              |
| `label`          | `string`                                               | Yes      | Label displayed in the Inspector and Card Editor form.                                                                                                                                   |
| `type`           | `"text" \| "box" \| "select" \| "image" \| "richtext"` | Yes      | Determines rendering behavior and input widget type.                                                                                                                                     |
| `x`              | `number`                                               | Yes      | Horizontal position in pixels from the left edge.                                                                                                                                        |
| `y`              | `number`                                               | Yes      | Vertical position in pixels from the top edge.                                                                                                                                           |
| `width`          | `number`                                               | Yes      | Bounding box width in pixels.                                                                                                                                                            |
| `height`         | `number`                                               | Yes      | Bounding box height in pixels.                                                                                                                                                           |
| `z`              | `number`                                               | No       | Stacking order within the style (higher is drawn on top).                                                                                                                                |
| `zOnly`          | `boolean`                                              | No       | Marks an inherited-field override that changes only `z`.                                                                                                                                 |
| `fontFamily`     | `string`                                               | No       | Font family for text/select/richtext fields (a Google Font can be loaded).                                                                                                               |
| `verticalAlign`  | `"top" \| "middle" \| "bottom"`                        | No       | Vertical alignment of text inside the bounding box (default `"top"`).                                                                                                                    |
| `lineHeight`     | `number`                                               | No       | Line-height multiplier, `0.5`–`5` (default `1.25` for rich text and in the inspector; plain text uses Konva's `1`).                                                                      |
| `letterSpacing`  | `number`                                               | No       | Extra spacing between characters, in pixels, `-100`–`100` (default `0`).                                                                                                                 |
| `stroke`         | `string`                                               | No       | Text outline color.                                                                                                                                                                      |
| `strokeWidth`    | `number`                                               | No       | Text outline width, or rectangle border width, in pixels, `0`–`100` (default `0` for text, `2` for boxes).                                                                               |
| `opacity`        | `number`                                               | No       | Layer transparency from `0` to `1` (default `1`).                                                                                                                                        |
| `rotation`       | `number`                                               | No       | Rotation in degrees around the layer's origin; inspector input is clamped to `-360`–`360` (default `0`).                                                                                 |
| `flipX`          | `boolean`                                              | No       | Mirror the layer horizontally (default `false`).                                                                                                                                         |
| `flipY`          | `boolean`                                              | No       | Mirror the layer vertically (default `false`).                                                                                                                                           |
| `editableInCard` | `boolean`                                              | No       | Show the field's input in Card Mode (default `true`); set `false` for decoration.                                                                                                        |
| `hidden`         | `boolean`                                              | No       | Draw the layer in Template Mode only (default `false`). Hidden layers are not drawn in the Card Mode preview or PNG/PDF exports, but their values remain editable in the Card Mode form. |
| `script`         | `string`                                               | No       | Optional JavaScript snippet executed before rendering.                                                                                                                                   |

Every color property (`backgroundColor`, `borderColor`, `color`, `fill`, `stroke`, image/script-provided colors) accepts a 3- or 6-digit hex color, the `transparent` keyword, or an 8-digit `#RRGGBBAA` value for partial transparency. The editor's color pickers expose all of these forms.

**Hidden layers**: tick **Masqué (Template uniquement)** in the Template Mode inspector to make any component design-only. It stays fully visible and editable on the Template canvas and in the layer tree (marked `masqué`), but it is not drawn in the Card Mode preview and is skipped by PNG/PDF exports. Its layout attributes stay Template-only, while its **value remains editable in the Card Mode form** so the card data can still be filled in. Unlike a script's `visible: false`, `hidden` cannot be undone by a script — it is a property of the layer, inherited through `basedOn` like any other.

#### Type-Specific Properties

- **`type: "text"`** (Renders text on canvas + `<textarea>` in Card Mode)
  - `fontSize` (`number`, default `16`): Font size in pixels.
  - `color` (`string`, default `"#ffffff"`): Text color.
  - `align` (`"left" | "center" | "right"`, default `"left"`): Horizontal text alignment.
  - _Note_: Card Mode always uses a `<textarea>`: one row for short fields, four rows when `height > 60`.

- **`type: "box"`** (Renders a decorative rectangle or frame; no form input)
  - `fill` (`string`, default `"#0f172a"`): Interior fill color.
  - `color` (`string`, default `"#334155"`): Border stroke color.
  - `strokeWidth` (`number`, default `2`): Border thickness in pixels, `0`–`100`.

- **`type: "select"`** (Renders selected option label on canvas + `<select>` dropdown in Card Mode)
  - `options` (`Array<{ value: string; label: string }>`): List of selectable choices.
  - `defaultValue` (`string`, optional): Initial option `value` for new cards. In Template Mode, edit it with **Valeur par défaut (Template)**; choose `-- Aucune --` to clear it.
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

Templates and decks are intentionally the only two explicit save/load notions — different files and different control groups. Template pack save/load buttons sit below the built-in template and active-style selectors; deck save/load buttons stay with the deck. In addition, every change to the pack (styles and layers) or the deck (cards and values), including selection/mode changes, is autosaved to `localStorage` under `modern-geckos-workspace-v1` and restored on launch/refresh. A corrupt or incompatible autosave is ignored and falls back to the built-in template with an empty deck. IndexedDB stores uploaded image blobs as `idb:` refs used by both the session and the autosave; exported files embed those images as inline `data:image/...` base64 URLs instead, so the JSON works on another machine without that database.

| Content                        | Downloaded file                       |
| ------------------------------ | ------------------------------------- |
| Template pack (styles, layers) | `<slugified-pack-name>-template.json` |
| Deck (cards and their values)  | `<slugified-pack-name>-deck.json`     |

Pack names are slugified for filenames (accent-stripped, lowercase, non-alphanumerics replaced by `-`, falling back to `modern-geckos`).

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

Uploaded images appear as inline Data URLs such as `"defaultValue": "data:image/png;base64,..."` in a template or `"values": { "artwork": "data:image/webp;base64,..." }` in a deck (PNG or WebP depending on whether compression was needed). They are written at save time and read back inline on import. A deck stores only `styleKey` references; loading one with no matching template remaps every unknown style to the current active style with a warning rather than rejecting the deck. Loading the matching template first preserves the intended layout. Legacy unwrapped packs, single-style templates, bare `{ "cards": [...] }` decks and bare card arrays are still accepted on import; old combined project files are not.

---

## Dynamic JavaScript Render Scripts (`script`)

Any field can include a `script` string to dynamically compute visual overrides when a card is rendered. There is no separate JavaScript field type: in Template Mode, select a layer and enter the script in the **Script JS de rendu** textarea.

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

Scripts run in a restricted interpreter: plain data, arithmetic/logic operators, object/array literals, template literals, `const`/`let`, assignment, `if`/`else` with blocks, ternary and nullish expressions, computed member access, `//` and `/* */` comments, `return`, and a small allowlist of helpers (`Number`, `String`, `Boolean`, `isNaN`, `parseInt`, `parseFloat`, `Math`, string/array methods) are available. There are no loop statements, no DOM, network, or host objects. Syntax and runtime errors report a 1-based line number, and each evaluation has a step budget so deep or expensive expressions cannot freeze the UI. Numeric overrides must be finite and are clamped to safe ranges, result strings are bounded, and script-provided `src` values are restricted to `data:image/…`, `blob:`, relative and same-origin URLs — explicit cross-origin `http(s)` sources are ignored.

> **Design Mode Tip**: When a script sets `visible: false`, the layer is hidden in **Card Mode** and PNG/PDF exports, but remains visible at `30%` opacity in **Template Mode** so you can still select and move it.

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
│   ├── templateIO.ts          # Template file format
│   └── workspaceStorage.ts    # Autosave/restore of the whole editor session
├── data/
│   ├── index.ts               # Discovers non-test `*.json` templates in `src/data`
│   └── examplePack.json       # Built-in template session (pack used at startup)
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
│   ├── printSize.ts           # Template pixels → printed millimetres (370 px = 34 mm)
│   ├── richTextLayout.ts      # Word-wrap & alignment for styled rich-text runs
│   ├── sanitize.ts            # DOMPurify HTML sanitization
│   ├── scriptEvaluator.ts     # Restricted field script evaluation & override sanitizing
│   ├── scriptInterpreter.ts   # Dependency-free restricted JS interpreter
│   ├── snapGuides.ts          # Magnetic alignment & visual guide calculations
│   ├── styleResolver.ts       # Recursive `basedOn` template style inheritance
│   ├── numbers.ts             # Safe numeric-input clamping
│   └── templateValidation.ts  # Runtime validation for imported packs/decks
├── App.tsx                    # Main workspace, Konva stage, & inspector panels
├── index.css                  # Global styles and responsive layout
├── main.tsx                   # Application entry point
└── vite-env.d.ts              # Vite client type declarations
```
