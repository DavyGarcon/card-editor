import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
import Konva from 'konva';
import {
  RichTextEditor,
  loadGoogleFont,
  loadTemplateFonts,
  DEFAULT_GAMING_FONTS,
  ImageCropper,
  ColorPicker,
  DeckIOControls,
  TemplateIOControls,
  ErrorBanner,
  ZoomToolbar,
  ScriptHelpPanel,
  PdfOptionsDialog,
  type PdfPrintOptions,
} from './components';
import {
  Download,
  Upload,
  Plus,
  Trash2,
  Layers,
  LayoutTemplate,
  PenTool,
  Type,
  Square,
  List,
  Image as ImageIcon,
  GitBranch,
  Copy,
  Settings2,
} from 'lucide-react';
import {
  CardStyleDefinition,
  CardTemplatePack,
  FieldType,
  SelectOption,
  TemplateField,
} from './types/template';
import { resolveCardStyle } from './utils/styleResolver';
import { evaluateFieldScript } from './utils/scriptEvaluator';
import { DraggableFieldNode } from './components/DraggableFieldNode';
import { ErrorBoundary } from './components/ErrorBoundary';
import { inputStyle, labelStyle, smallBtnStyle, toolBtnStyle } from './components/uiStyles';
import { Line } from 'react-konva';
import {
  getLineGuideStops,
  getObjectSnappingEdges,
  getGuides,
  GuideLineRender,
} from './utils/snapGuides';
import { Printer, RotateCcw } from 'lucide-react';
import { exportDeckToPdf } from './utils/pdfExporter';
import { renderCardToDataUrl } from './utils/cardRenderer';
import { loadTemplateFile, saveTemplateFile, type TemplateSession } from './io/templateIO';
import { loadDeckFile, saveDeckFile, type DeckSession } from './io/deckIO';
import { isImageRef, pruneImages, storeImageDataUrl } from './io/imageStore';
import { slugify } from './io/formats';
import { useUndoableDocument } from './hooks/useUndoableDocument';
import { BUILT_IN_TEMPLATES, EMPTY_PACK } from './data';
import { STRINGS } from './i18n/strings';
import { clampNumber } from './utils/numbers';

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;

/** Applies a field edit to the active style, creating a local override if needed. */
function applyFieldUpdates(
  pack: CardTemplatePack,
  styleKey: string,
  resolvedFields: TemplateField[],
  fieldId: string,
  updates: Partial<TemplateField>,
): CardTemplatePack {
  const hasNonZUpdate = Object.keys(updates).some((key) => key !== 'z' && key !== 'zOnly');
  const effectiveUpdates =
    hasNonZUpdate && updates.zOnly !== false ? { ...updates, zOnly: false } : updates;
  return {
    ...pack,
    styles: pack.styles.map((style) => {
      if (style.key !== styleKey) return style;
      const existsLocally = style.fields.some((field) => field.id === fieldId);
      if (existsLocally) {
        return {
          ...style,
          fields: style.fields.map((field) =>
            field.id === fieldId ? { ...field, ...effectiveUpdates } : field,
          ),
        };
      }
      const baseField = resolvedFields.find((field) => field.id === fieldId);
      if (!baseField) return style;
      return { ...style, fields: [...style.fields, { ...baseField, ...effectiveUpdates }] };
    }),
  };
}

export default function App() {
  // Startup and refresh always use the packs shipped in src/data. Decks are
  // never restored: they only exist after the user loads one explicitly.
  const initialTemplate = BUILT_IN_TEMPLATES[0]?.pack ?? EMPTY_PACK;
  const {
    pack,
    setPack,
    cards,
    setCards,
    activeStyleKey,
    activeCardId,
    selectedFieldId,
    mode,
    snapshot,
    setUi,
    setDocument,
    resetDocument,
    undo,
    redo,
  } = useUndoableDocument({
    pack: structuredClone(initialTemplate),
    cards: [],
    activeStyleKey: initialTemplate.activeStyleKey || initialTemplate.styles[0]?.key || '',
    activeCardId: '',
    selectedFieldId: 'title',
    mode: 'card',
  });
  const [activeTemplateId, setActiveTemplateId] = useState(BUILT_IN_TEMPLATES[0]?.id ?? '');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [dismissedStyleError, setDismissedStyleError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showScriptHelp, setShowScriptHelp] = useState(false);
  const [fieldIdDraftState, setFieldIdDraftState] = useState<{ id: string; value: string }>({
    id: '',
    value: '',
  });
  const [draggedComponentId, setDraggedComponentId] = useState<string | null>(null);
  const [scriptErrors, setScriptErrors] = useState<Record<string, string>>({});
  const [boundaryKey, setBoundaryKey] = useState(0);
  const [guides, setGuides] = useState<GuideLineRender[]>([]);
  const [cropRequest, setCropRequest] = useState<{
    src: string;
    aspectRatio: number;
    target: { kind: 'card' | 'field'; id: string; fieldId?: string };
  } | null>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      setZoom((previous) => {
        const factor = event.deltaY < 0 ? 1.1 : 0.9;
        const next = previous * factor;
        return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(next * 100) / 100));
      });
    };
    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, []);

  const activeCard = cards.find((c) => c.id === activeCardId) || cards[0];
  // One style selection for both modes: choosing a card selects its style, and
  // editing a style in Template mode keeps it selected when switching back.
  const currentStyleKey = activeStyleKey;

  const styleResolution = useMemo(() => {
    if (pack.styles.length === 0) {
      return {
        style: {
          key: 'default',
          name: 'Défaut',
          width: 375,
          height: 525,
          backgroundColor: '#1e293b',
          borderColor: '#f59e0b',
          fields: [],
        },
        error: 'Le template ne contient aucun style.',
      };
    }
    try {
      return {
        style: resolveCardStyle(currentStyleKey, pack.styles),
        error: null as string | null,
      };
    } catch (err) {
      return {
        style: resolveCardStyle(pack.styles[0].key, pack.styles),
        error: err instanceof Error ? err.message : 'Erreur de résolution du style',
      };
    }
  }, [currentStyleKey, pack.styles]);
  const resolvedStyle = styleResolution.style;

  // Template mode previews the template's defaults, not the active card's data.
  const previewCardValues = useMemo(
    () =>
      mode === 'template'
        ? Object.fromEntries(
            resolvedStyle.fields.map((field) => [field.id, field.defaultValue ?? '']),
          )
        : (activeCard?.values ?? {}),
    [mode, resolvedStyle.fields, activeCard],
  );
  const bannerMessage =
    errorBanner ?? (dismissedStyleError === styleResolution.error ? null : styleResolution.error);

  const templateSession = useMemo<TemplateSession>(
    () => ({ pack, activeStyleKey: currentStyleKey, mode }),
    [pack, currentStyleKey, mode],
  );
  const deckSession = useMemo<DeckSession>(
    () => ({
      cards,
      activeCardId,
      name: pack.name,
      templateName: pack.name,
      styleKeys: pack.styles.map((style) => style.key),
    }),
    [cards, activeCardId, pack],
  );
  const showError = useCallback((message: string | null) => {
    setErrorBanner(message);
  }, []);

  /** Switch between the built-in packs in src/data; cards stay in the session. */
  const selectBuiltInTemplate = useCallback(
    (templateId: string) => {
      const template = BUILT_IN_TEMPLATES.find((item) => item.id === templateId);
      if (!template) return;
      const nextPack = structuredClone(template.pack);
      const availableKeys = new Set(nextPack.styles.map((style) => style.key));
      const fallbackKey =
        nextPack.activeStyleKey && availableKeys.has(nextPack.activeStyleKey)
          ? nextPack.activeStyleKey
          : (nextPack.styles[0]?.key ?? '');
      const incompatibleCount = cards.filter((card) => !availableKeys.has(card.styleKey)).length;
      setDocument({
        pack: nextPack,
        cards: cards.map((card) =>
          availableKeys.has(card.styleKey) ? card : { ...card, styleKey: fallbackKey },
        ),
        activeStyleKey: fallbackKey,
        activeCardId,
        selectedFieldId,
        mode,
      });
      setActiveTemplateId(templateId);
      showError(
        incompatibleCount > 0
          ? `${incompatibleCount} carte(s) ont été réassignée(s) au style « ${fallbackKey} » (style absent du nouveau template).`
          : null,
      );
    },
    [cards, activeCardId, selectedFieldId, mode, setDocument, showError],
  );

  const templateFontNames = useMemo(
    () =>
      Array.from(
        new Set(
          pack.styles
            .flatMap((style) => style.fields.map((field) => field.fontFamily))
            .filter((family): family is string => Boolean(family)),
        ),
      ),
    [pack.styles],
  );

  useEffect(() => {
    if (templateFontNames.length === 0) return;
    let cancelled = false;
    loadTemplateFonts(templateFontNames).then(() => {
      if (!cancelled) stageRef.current?.batchDraw();
    });
    return () => {
      cancelled = true;
    };
  }, [templateFontNames]);

  const rawActiveStyle = pack.styles.find((s) => s.key === currentStyleKey) || pack.styles[0];
  const selectedField = resolvedStyle.fields.find((f) => f.id === selectedFieldId) || null;
  const selectedFieldIdKey = selectedField?.id ?? '';
  // Draft is scoped to the selected field, so switching layers never leaks text.
  const fieldIdDraft =
    fieldIdDraftState.id === selectedFieldIdKey ? fieldIdDraftState.value : selectedFieldIdKey;
  const setFieldIdDraft = (value: string) =>
    setFieldIdDraftState({ id: selectedFieldIdKey, value });

  const isFieldInheritedOnly = Boolean(
    selectedField &&
    rawActiveStyle?.basedOn &&
    !rawActiveStyle.fields.some((f) => f.id === selectedField.id),
  );

  // A style cannot inherit from one of its own descendants (that would create
  // an inheritance cycle the resolver cannot untangle).
  const descendantStyleKeys = useMemo(() => {
    const keys = new Set<string>();
    const collect = (parentKey: string) => {
      for (const style of pack.styles) {
        if (style.basedOn === parentKey && !keys.has(style.key)) {
          keys.add(style.key);
          collect(style.key);
        }
      }
    };
    collect(currentStyleKey);
    return keys;
  }, [pack.styles, currentStyleKey]);

  const handleScriptError = useCallback((fieldId: string, error: string | null) => {
    setScriptErrors((prev) => {
      if (error) {
        if (prev[fieldId] === error) return prev;
        return { ...prev, [fieldId]: error };
      }
      if (!(fieldId in prev)) return prev;
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }, []);

  const selectedFieldScriptError = useMemo(() => {
    if (!selectedField?.script) return null;
    const res = evaluateFieldScript(selectedField.script, {
      card: activeCard?.values || {},
      style: resolvedStyle as unknown as Record<string, unknown>,
      field: selectedField as unknown as Record<string, unknown>,
    });
    return res.error || null;
  }, [selectedField, activeCard, resolvedStyle]);
  const visibleScriptError = selectedField
    ? (scriptErrors[selectedField.id] ?? selectedFieldScriptError)
    : null;

  // --- Style & Inheritance Management ---
  const createStyleVariant = (inheritFromCurrent: boolean) => {
    const newKey = `style_${Date.now()}`;
    const newStyle: CardStyleDefinition = inheritFromCurrent
      ? {
          key: newKey,
          name: `${resolvedStyle.name} (Variante)`,
          basedOn: resolvedStyle.key,
          fields: [],
        }
      : {
          key: newKey,
          name: 'Nouveau Style Vierge',
          width: 375,
          height: 525,
          backgroundColor: '#1e293b',
          borderColor: '#38bdf8',
          fields: [
            {
              id: 'title',
              label: 'Titre',
              type: 'text',
              x: 30,
              y: 30,
              width: 315,
              height: 36,
              fontSize: 22,
              color: '#ffffff',
              align: 'center',
            },
          ],
        };

    // One history step: adding a style, selecting it and re-keying the card
    // belong together — undo should never leave a dangling selection.
    setDocument({
      ...snapshot(),
      pack: { ...pack, styles: [...pack.styles, newStyle] },
      activeStyleKey: newKey,
      cards: activeCard
        ? cards.map((c) => (c.id === activeCard.id ? { ...c, styleKey: newKey } : c))
        : cards,
    });
  };

  const updateActiveStyleMeta = (updates: Partial<CardStyleDefinition>) => {
    setPack(
      (prev) => ({
        ...prev,
        styles: prev.styles.map((s) => (s.key === currentStyleKey ? { ...s, ...updates } : s)),
      }),
      `style-meta-${currentStyleKey}`,
    );
  };

  const updateFieldProps = (fieldId: string, updates: Partial<TemplateField>) => {
    // A z-only override must stop being z-only as soon as any other property is
    // edited, otherwise the resolver would keep ignoring the new value.
    const hasNonZUpdate = Object.keys(updates).some((key) => key !== 'z' && key !== 'zOnly');
    const effectiveUpdates =
      hasNonZUpdate && updates.zOnly !== false ? { ...updates, zOnly: false } : updates;
    setPack(
      (prev) => ({
        ...prev,
        styles: prev.styles.map((s) => {
          if (s.key !== currentStyleKey) return s;
          const existsLocally = s.fields.some((f) => f.id === fieldId);
          if (existsLocally) {
            return {
              ...s,
              fields: s.fields.map((f) => (f.id === fieldId ? { ...f, ...effectiveUpdates } : f)),
            };
          }
          // Override inherited field locally in child style
          const baseField = resolvedStyle.fields.find((f) => f.id === fieldId);
          if (!baseField) return s;
          return {
            ...s,
            fields: [...s.fields, { ...baseField, ...effectiveUpdates }],
          };
        }),
      }),
      `field-${fieldId}`,
    );
  };

  const addTemplateField = (type: FieldType) => {
    const newId = `field_${Date.now()}`;
    const baseLabels: Record<FieldType, string> = {
      text: 'Nouveau Texte',
      box: 'Nouveau Cadre',
      select: 'Liste Déroulante',
      image: 'Illustration',
      richtext: 'Texte Riche',
    };
    const newField: TemplateField = {
      id: newId,
      label: baseLabels[type],
      type,
      x: 45,
      y: 160,
      width: 260,
      height: type === 'richtext' ? 120 : type === 'image' ? 140 : type === 'box' ? 90 : 38,
      fontSize: 16,
      color: type === 'box' ? '#475569' : '#ffffff',
      fill: '#0f172a',
      align: 'left',
      opacity: 1,
      ...(type === 'select'
        ? {
            defaultValue: 'opt1',
            options: [
              { value: 'opt1', label: 'Option 1' },
              { value: 'opt2', label: 'Option 2' },
            ],
          }
        : {}),
    };

    setDocument({
      ...snapshot(),
      pack: {
        ...pack,
        styles: pack.styles.map((s) =>
          s.key === currentStyleKey ? { ...s, fields: [...s.fields, newField] } : s,
        ),
      },
      selectedFieldId: newId,
    });
  };

  const deleteOrRevertField = (fieldId: string) => {
    setDocument({
      ...snapshot(),
      pack: {
        ...pack,
        styles: pack.styles.map((s) =>
          s.key === currentStyleKey
            ? { ...s, fields: s.fields.filter((f) => f.id !== fieldId) }
            : s,
        ),
      },
      selectedFieldId: selectedFieldId === fieldId ? null : selectedFieldId,
    });
  };

  const getFieldDisplayOrder = () =>
    [...resolvedStyle.fields]
      .map((field, index) => ({ field, index }))
      .sort((a, b) => (b.field.z ?? b.index) - (a.field.z ?? a.index) || b.index - a.index)
      .map(({ field }) => field.id);

  /** Writes z overrides only for fields whose effective order changed. */
  const commitFieldOrder = (oldOrderIds: string[], nextOrderIds: string[]) => {
    const zById = new Map(
      nextOrderIds.map((id, displayIdx) => [id, nextOrderIds.length - 1 - displayIdx]),
    );
    const previousZById = new Map(
      oldOrderIds.map((id, displayIdx) => [id, oldOrderIds.length - 1 - displayIdx]),
    );

    setPack((prev) => ({
      ...prev,
      styles: prev.styles.map((style) => {
        if (style.key !== currentStyleKey) return style;
        let fields = [...style.fields];
        for (const [id, z] of zById.entries()) {
          if (previousZById.get(id) === z) continue;
          const existsLocally = fields.some((field) => field.id === id);
          if (existsLocally) {
            fields = fields.map((field) => (field.id === id ? { ...field, z } : field));
          } else {
            const baseField = resolvedStyle.fields.find((field) => field.id === id);
            if (baseField) {
              // Inherited field: keep the parent definition and override only z.
              fields = [...fields, { ...baseField, z, zOnly: true }];
            }
          }
        }
        return { ...style, fields };
      }),
    }));
  };

  const reorderComponentsByDrop = (targetFieldId: string) => {
    if (mode !== 'template' || !draggedComponentId || draggedComponentId === targetFieldId) return;
    const order = getFieldDisplayOrder();
    const fromIndex = order.indexOf(draggedComponentId);
    const toIndex = order.indexOf(targetFieldId);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...order];
    next.splice(fromIndex, 1);
    next.splice(toIndex, 0, draggedComponentId);
    commitFieldOrder(order, next);
    setDraggedComponentId(null);
  };

  /** Alt+Arrow reorders the focused layer without a mouse. */
  const reorderFieldByStep = (fieldId: string, direction: -1 | 1) => {
    if (mode !== 'template') return;
    const order = getFieldDisplayOrder();
    const from = order.indexOf(fieldId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= order.length) return;
    const next = [...order];
    next.splice(from, 1);
    next.splice(to, 0, fieldId);
    commitFieldOrder(order, next);
  };

  // --- Select Options Editor Helpers ---
  const updateSelectOption = (
    field: TemplateField,
    idx: number,
    key: keyof SelectOption,
    val: string,
  ) => {
    const nextOptions = [...(field.options || [])];
    nextOptions[idx] = { ...nextOptions[idx], [key]: val };
    updateFieldProps(field.id, { options: nextOptions });
  };

  const addSelectOption = (field: TemplateField) => {
    const nextOptions = [
      ...(field.options || []),
      { value: `opt_${Date.now()}`, label: 'Nouvelle option' },
    ];
    updateFieldProps(field.id, { options: nextOptions });
  };

  const removeSelectOption = (field: TemplateField, idx: number) => {
    const removedValue = (field.options || [])[idx]?.value;
    const nextOptions = (field.options || []).filter((_, i) => i !== idx);
    const fieldUpdates: Partial<TemplateField> = { options: nextOptions };
    if (removedValue !== undefined && field.defaultValue === removedValue) {
      fieldUpdates.defaultValue = '';
    }
    // A removed option must not leave stale values in any card: remap them in
    // the same history step as the option removal.
    const nextCards =
      removedValue === undefined
        ? cards
        : cards.map((card) => {
            if (card.values[field.id] !== removedValue) return card;
            const values = { ...card.values };
            delete values[field.id];
            return { ...card, values };
          });
    setDocument({
      ...snapshot(),
      pack: applyFieldUpdates(pack, currentStyleKey, resolvedStyle.fields, field.id, fieldUpdates),
      cards: nextCards,
    });
  };

  // --- Card Values & Image Upload ---
  const updateCardValue = (fieldId: string, value: string) => {
    setCards(
      (prev) =>
        prev.map((c) =>
          c.id === activeCard.id ? { ...c, values: { ...c.values, [fieldId]: value } } : c,
        ),
      `card-value-${activeCard.id}-${fieldId}`,
    );
  };

  const requestImageCrop = (
    file: File,
    aspectRatio: number,
    target: { kind: 'card' | 'field'; id: string; fieldId?: string },
  ) => {
    if (!file.type.startsWith('image/')) {
      showError('Veuillez choisir un fichier image (PNG, JPEG, WebP…).');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      showError(`Image trop volumineuse (${MAX_IMAGE_BYTES / 1024 / 1024} Mo maximum).`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCropRequest({ src: reader.result, aspectRatio, target });
      }
    };
    reader.onerror = () => showError('Impossible de lire le fichier image.');
    reader.readAsDataURL(file);
  };

  /** Stores cropped artwork in IndexedDB and keeps only a short ref in the document. */
  const commitCroppedImage = (dataUrl: string) => {
    const target = cropRequest?.target;
    if (!target) return;
    void storeImageDataUrl(dataUrl)
      .then((ref) => {
        if (target.kind === 'card' && target.fieldId) {
          updateCardValue(target.fieldId, ref);
        } else {
          updateFieldProps(target.id, { defaultValue: ref });
        }
      })
      .catch(() => showError("Impossible d'enregistrer l'image."))
      .finally(() => setCropRequest(null));
  };

  const handleCardImageUpload = (field: TemplateField, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeCard) return;
    requestImageCrop(file, field.width / Math.max(1, field.height), {
      kind: 'card',
      id: activeCard.id,
      fieldId: field.id,
    });
    e.target.value = '';
  };

  const addNewCard = () => {
    const newId = `card_${Date.now()}`;
    setDocument({
      ...snapshot(),
      cards: [
        ...cards,
        { id: newId, styleKey: currentStyleKey, values: { title: 'Nouvelle Carte' } },
      ],
      activeCardId: newId,
    });
  };

  const duplicateCard = () => {
    if (!activeCard) return;
    const newId = `card_${Date.now()}`;
    const copy = { ...activeCard, id: newId, values: { ...activeCard.values } };
    const insertAt = cards.findIndex((card) => card.id === activeCard.id) + 1;
    const nextCards = [...cards];
    nextCards.splice(insertAt, 0, copy);
    setDocument({ ...snapshot(), cards: nextCards, activeCardId: newId });
  };

  const deleteCard = (cardId: string) => {
    const remaining = cards.filter((card) => card.id !== cardId);
    // Deleting the selected card must leave a valid selection.
    setDocument({
      ...snapshot(),
      cards: remaining,
      activeCardId: activeCardId === cardId ? (remaining[0]?.id ?? '') : activeCardId,
      activeStyleKey:
        activeCardId === cardId ? (remaining[0]?.styleKey ?? activeStyleKey) : activeStyleKey,
    });
    // Drop artwork blobs that are no longer used by any card or field.
    const activeRefs = new Set<string>();
    for (const style of pack.styles) {
      for (const field of style.fields) {
        if (isImageRef(field.defaultValue)) activeRefs.add(field.defaultValue!);
      }
    }
    for (const card of remaining) {
      for (const value of Object.values(card.values)) {
        if (isImageRef(value)) activeRefs.add(value);
      }
    }
    void pruneImages(activeRefs);
  };

  const duplicateStyle = () => {
    if (!rawActiveStyle) return;
    const newKey = `style_${Date.now()}`;
    const copy: CardStyleDefinition = {
      ...rawActiveStyle,
      key: newKey,
      name: `${rawActiveStyle.name} (Copie)`,
      fields: rawActiveStyle.fields.map((field) => ({ ...field })),
    };
    setDocument({
      ...snapshot(),
      pack: { ...pack, styles: [...pack.styles, copy] },
      activeStyleKey: newKey,
      cards: activeCard
        ? cards.map((card) => (card.id === activeCard.id ? { ...card, styleKey: newKey } : card))
        : cards,
    });
  };

  /** Renaming a field id updates every card value and selection in one step. */
  const renameFieldId = (oldId: string, rawNewId: string) => {
    const newId = rawNewId.trim().replace(/[^A-Za-z0-9_-]+/g, '_');
    if (!newId || newId === oldId) return;
    if (pack.styles.some((style) => style.fields.some((field) => field.id === newId))) {
      showError(`L'identifiant « ${newId} » est déjà utilisé.`);
      return;
    }
    setDocument({
      ...snapshot(),
      pack: {
        ...pack,
        styles: pack.styles.map((style) => ({
          ...style,
          fields: style.fields.map((field) =>
            field.id === oldId ? { ...field, id: newId } : field,
          ),
        })),
      },
      cards: cards.map((card) => {
        if (!(oldId in card.values)) return card;
        const values = { ...card.values };
        values[newId] = values[oldId];
        delete values[oldId];
        return { ...card, values };
      }),
      selectedFieldId: selectedFieldId === oldId ? newId : selectedFieldId,
    });
  };

  // --- Export / Import ---
  const exportPNG = async () => {
    if (!activeCard) return;
    try {
      const uri = await renderCardToDataUrl(activeCard, resolvedStyle, 2);
      const link = document.createElement('a');
      link.download = `${slugify(activeCard.values.title || 'carte')}.png`;
      link.href = uri;
      link.click();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Erreur lors de l'export PNG.");
    }
  };

  // Template pack and deck are saved to / loaded from independent files.
  const saveTemplate = useCallback(() => {
    try {
      saveTemplateFile(templateSession);
      showError(null);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Erreur lors de l'export du template.");
    }
  }, [templateSession, showError]);

  const loadTemplate = useCallback(
    async (file: File) => {
      try {
        const session = await loadTemplateFile(file);
        const availableKeys = new Set(session.pack.styles.map((s) => s.key));
        const fallbackKey =
          session.activeStyleKey && availableKeys.has(session.activeStyleKey)
            ? session.activeStyleKey
            : (session.pack.styles[0]?.key ?? '');
        const incompatibleCount = cards.filter((c) => !availableKeys.has(c.styleKey)).length;
        const remappedCards = cards.map((c) =>
          availableKeys.has(c.styleKey) ? c : { ...c, styleKey: fallbackKey },
        );
        const allFieldIds = new Set(session.pack.styles.flatMap((s) => s.fields.map((f) => f.id)));
        setDocument({
          pack: session.pack,
          cards: remappedCards,
          activeStyleKey: fallbackKey,
          activeCardId: remappedCards.some((c) => c.id === activeCardId)
            ? activeCardId
            : (remappedCards[0]?.id ?? ''),
          selectedFieldId:
            selectedFieldId && allFieldIds.has(selectedFieldId) ? selectedFieldId : null,
          mode: session.mode,
        });
        showError(
          incompatibleCount > 0
            ? `${incompatibleCount} carte(s) ont été réassignée(s) au style « ${fallbackKey} » (style absent du nouveau template).`
            : null,
        );
      } catch (err) {
        showError(err instanceof Error ? err.message : 'Fichier template invalide.');
      }
    },
    [cards, activeCardId, selectedFieldId, setDocument, showError],
  );

  const saveDeck = useCallback(() => {
    try {
      saveDeckFile(deckSession);
      showError(null);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Erreur lors de l'export du deck.");
    }
  }, [deckSession, showError]);

  const loadDeck = useCallback(
    async (file: File) => {
      try {
        const session = await loadDeckFile(file, pack.styles, { remapIncompatible: true });
        const availableKeys = new Set(pack.styles.map((s) => s.key));
        const fallbackKey = currentStyleKey;
        const incompatibleCount = session.remappedCount ?? 0;
        const remappedCards = session.cards.map((c) =>
          availableKeys.has(c.styleKey) ? c : { ...c, styleKey: fallbackKey },
        );
        const nextCardId =
          session.activeCardId && remappedCards.some((c) => c.id === session.activeCardId)
            ? session.activeCardId!
            : (remappedCards[0]?.id ?? '');
        setDocument({
          ...snapshot(),
          cards: remappedCards,
          activeCardId: nextCardId,
          activeStyleKey: remappedCards.find((c) => c.id === nextCardId)?.styleKey ?? fallbackKey,
        });
        showError(
          incompatibleCount > 0
            ? `${incompatibleCount} carte(s) utilisaient un style inconnu et ont été réassignée(s) à « ${fallbackKey} ».`
            : null,
        );
      } catch (err) {
        showError(err instanceof Error ? err.message : 'Fichier deck invalide.');
      }
    },
    [pack.styles, currentStyleKey, snapshot, setDocument, showError],
  );

  const resetWorkspace = () => {
    // Hard reset empties the undo timeline and returns to the same state as a
    // fresh launch: built-in template, no deck.
    const template = BUILT_IN_TEMPLATES[0]?.pack ?? EMPTY_PACK;
    resetDocument({
      pack: structuredClone(template),
      cards: [],
      activeStyleKey: template.activeStyleKey || template.styles[0]?.key || '',
      activeCardId: '',
      selectedFieldId: 'title',
      mode: 'card',
    });
    setActiveTemplateId(BUILT_IN_TEMPLATES[0]?.id ?? '');
    setDismissedStyleError(null);
    setScriptErrors({});
    setGuides([]);
    setCropRequest(null);
    setDraggedComponentId(null);
    setBoundaryKey((key) => key + 1);
    showError(null);
  };

  const handleLayerDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (mode !== 'template') return;
    const stage = e.target.getStage();
    if (!stage) return;

    const lineGuideStops = getLineGuideStops(
      e.target,
      stage,
      resolvedStyle.width,
      resolvedStyle.height,
    );
    const itemBounds = getObjectSnappingEdges(e.target, stage);
    const activeGuides = getGuides(lineGuideStops, itemBounds);

    if (activeGuides.length === 0) {
      setGuides([]);
      return;
    }

    const absPos = e.target.absolutePosition();

    // Applique la correction magnétique sur X et Y
    activeGuides.forEach((lg) => {
      if (lg.orientation === 'V') {
        const edge = itemBounds.vertical.find((b) => b.snap === lg.snap);
        if (edge) absPos.x = lg.lineGuide + edge.offset;
      } else if (lg.orientation === 'H') {
        const edge = itemBounds.horizontal.find((b) => b.snap === lg.snap);
        if (edge) absPos.y = lg.lineGuide + edge.offset;
      }
    });

    e.target.absolutePosition(absPos);

    setGuides(
      activeGuides.map((g) => ({
        orientation: g.orientation,
        position: g.lineGuide,
      })),
    );
  };

  const handleLayerDragEnd = () => {
    setGuides([]); // Efface les lignes dès que l'utilisateur relâche le clic
  };

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [showPdfOptions, setShowPdfOptions] = useState(false);
  const [pdfOptions, setPdfOptions] = useState<PdfPrintOptions>({
    paperSize: 'a4',
    cardWidthMm: 63.5,
    gapMm: 2,
    drawCropMarks: true,
  });

  const handleExportDeckPdf = async () => {
    if (cards.length === 0) return;
    try {
      setIsExportingPdf(true);
      const capturedImages: string[] = [];
      // Mixed-style decks can have different ratios: keep each card's own
      // dimensions so the PDF never stretches artwork.
      const ratios: Array<{ width: number; height: number }> = [];

      for (const cardItem of cards) {
        const cardStyle = resolveCardStyle(cardItem.styleKey, pack.styles);
        ratios.push({ width: cardStyle.width, height: cardStyle.height });
        capturedImages.push(await renderCardToDataUrl(cardItem, cardStyle, 3));
      }

      await exportDeckToPdf(capturedImages, ratios, {
        ...pdfOptions,
        filename: `${slugify(pack.name)}-planche-${pdfOptions.paperSize}.pdf`,
      });
    } catch (err) {
      showError(err instanceof Error ? err.message : "Erreur lors de l'export PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Let the browser handle its own editing shortcuts while typing.
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return;
      }

      // Template mode: nudge the selected layer with the arrow keys.
      if (
        mode === 'template' &&
        selectedFieldId &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        const deltas: Record<string, [number, number]> = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
        };
        const delta = deltas[event.key];
        const field = delta ? resolvedStyle.fields.find((f) => f.id === selectedFieldId) : null;
        if (delta && field) {
          event.preventDefault();
          const step = event.shiftKey ? 10 : 1;
          updateFieldProps(selectedFieldId, {
            x: field.x + delta[0] * step,
            y: field.y + delta[1] * step,
          });
          return;
        }
      }

      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (key === 'y') {
        event.preventDefault();
        redo();
      } else if (key === 's') {
        // Ctrl+S follows the active workspace: deck in Card mode, template in Template mode.
        event.preventDefault();
        if (mode === 'template') saveTemplate();
        else saveDeck();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // updateFieldProps is intentionally read from the render closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo, saveTemplate, saveDeck, mode, selectedFieldId, resolvedStyle.fields]);

  const exportPdfLabel = isExportingPdf
    ? 'Génération PDF en cours'
    : `Planche PDF (${cards.length} cartes)`;

  return (
    <div className="app-shell">
      {/* LEFT: Deck & Style Selector */}
      <div className="sidebar-left">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 'bold',
            fontSize: '18px',
          }}
        >
          <Layers size={20} color="#f59e0b" /> Card Editor
        </div>

        {/* Mode Toggle */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: '#1e293b',
            padding: '4px',
            borderRadius: '8px',
          }}
        >
          <button
            onClick={() => setUi({ mode: 'card' })}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              background: mode === 'card' ? '#f59e0b' : 'transparent',
              color: mode === 'card' ? '#000' : '#94a3b8',
            }}
          >
            <PenTool size={14} /> Cartes
          </button>
          <button
            onClick={() => setUi({ mode: 'template' })}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              background: mode === 'template' ? '#f59e0b' : 'transparent',
              color: mode === 'template' ? '#000' : '#94a3b8',
            }}
          >
            <LayoutTemplate size={14} /> Template
          </button>
        </div>

        {/* Built-in templates discovered from src/data. No deck is loaded here. */}
        <label style={{ ...labelStyle, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          Templates intégrés
          <select
            aria-label="Template intégré"
            value={activeTemplateId}
            onChange={(event) => selectBuiltInTemplate(event.target.value)}
            style={inputStyle}
          >
            {BUILT_IN_TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>
                {template.pack.name}
              </option>
            ))}
            {!BUILT_IN_TEMPLATES.some((template) => template.id === activeTemplateId) && (
              <option value={activeTemplateId}>Template chargé depuis un fichier</option>
            )}
          </select>
        </label>

        {/* Style & Inheritance Switcher */}
        <div
          style={{
            background: '#1e293b',
            padding: '10px',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <label
            style={{
              fontSize: '12px',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <GitBranch size={13} color="#f59e0b" /> Style actif ({pack.styles.length})
          </label>
          <select
            value={currentStyleKey}
            onChange={(e) => {
              const nextKey = e.target.value;
              setDocument({
                ...snapshot(),
                activeStyleKey: nextKey,
                // Switching the active style in Card mode also re-keys the
                // current card, in the same undo step.
                cards:
                  mode === 'card' && activeCard
                    ? cards.map((c) => (c.id === activeCard.id ? { ...c, styleKey: nextKey } : c))
                    : cards,
              });
            }}
            style={inputStyle}
          >
            {pack.styles.map((st) => (
              <option key={st.key} value={st.key}>
                {st.name} {st.basedOn ? `↳ (${st.basedOn})` : ''}
              </option>
            ))}
          </select>

          {mode === 'template' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button
                onClick={() => createStyleVariant(true)}
                style={smallBtnStyle}
                title="Créer un style enfant héritant du style actuel"
              >
                + Variante (basedOn)
              </button>
              <button onClick={() => createStyleVariant(false)} style={smallBtnStyle}>
                + Nouveau Style
              </button>
              <button
                onClick={duplicateStyle}
                style={{ ...smallBtnStyle, gridColumn: '1 / -1' }}
                title={STRINGS.duplicateStyle}
              >
                <Copy size={12} /> {STRINGS.duplicateStyle}
              </button>
            </div>
          )}
        </div>

        {/* The only two save/load notions: template pack (template mode), card deck (card mode). */}
        {mode === 'template' && <TemplateIOControls onSave={saveTemplate} onLoad={loadTemplate} />}

        {/* Card mode: deck management is hidden while editing the template. */}
        {mode === 'card' && (
          <>
            <div className="io-group" role="group" aria-label="Rendu des cartes">
              <span className="io-group-label">Rendu</span>
              <div className="io-group-actions">
                <button
                  onClick={handleExportDeckPdf}
                  disabled={isExportingPdf}
                  style={{
                    ...toolBtnStyle,
                    background: isExportingPdf ? '#475569' : '#6366f1',
                    fontWeight: 'bold',
                  }}
                  aria-label={exportPdfLabel}
                  title={exportPdfLabel}
                >
                  <Printer size={16} />
                </button>
                <button
                  onClick={() => setShowPdfOptions(true)}
                  style={toolBtnStyle}
                  title={STRINGS.pdfOptions}
                  aria-label={STRINGS.pdfOptions}
                >
                  <Settings2 size={16} />
                </button>
                <button
                  onClick={exportPNG}
                  style={{ ...toolBtnStyle, background: '#10b981', fontWeight: 'bold' }}
                  aria-label="Exporter la carte en PNG"
                  title="Exporter la carte en PNG"
                >
                  <Download size={16} />
                </button>
              </div>
            </div>

            <DeckIOControls cardCount={cards.length} onSave={saveDeck} onLoad={loadDeck} />

            <div className="io-group" role="group" aria-label="Card">
              <span className="io-group-label">Card</span>
              <div className="io-group-actions">
                <button
                  onClick={addNewCard}
                  aria-label="Ajouter une Carte"
                  title="Ajouter une Carte"
                  style={toolBtnStyle}
                >
                  <Plus size={16} />
                </button>
                <button
                  onClick={duplicateCard}
                  disabled={!activeCard}
                  aria-label={STRINGS.duplicateCard}
                  title={STRINGS.duplicateCard}
                  style={toolBtnStyle}
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              {cards.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setUi({ activeCardId: c.id, activeStyleKey: c.styleKey })}
                  style={{
                    padding: '10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: c.id === activeCard.id ? '#334155' : '#1e293b',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '14px' }}>{c.values.title || 'Sans titre'}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                      {pack.styles.find((s) => s.key === c.styleKey)?.name || c.styleKey}
                    </div>
                  </div>
                  {cards.length > 1 && (
                    <Trash2
                      size={16}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCard(c.id);
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* RIGHT: Interactive Konva Stage (card / template preview) */}
      <div className="stage-area" ref={viewportRef}>
        {bannerMessage && (
          <ErrorBanner
            message={bannerMessage}
            onDismiss={() => {
              showError(null);
              if (styleResolution.error) setDismissedStyleError(styleResolution.error);
            }}
          />
        )}

        <div className="stage-toolbar">
          <ZoomToolbar
            zoom={zoom}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            onZoomOut={() => setZoom((z) => Math.max(MIN_ZOOM, Math.round(z * 0.9 * 100) / 100))}
            onZoomIn={() => setZoom((z) => Math.min(MAX_ZOOM, Math.round(z * 1.1 * 100) / 100))}
            onZoomChange={setZoom}
          />
        </div>

        <div className="stage-scroll">
          <ErrorBoundary
            fallbackTitle="Erreur de rendu du canevas"
            resetKey={boundaryKey}
            onReset={resetWorkspace}
          >
            <div
              style={{
                width: resolvedStyle.width * zoom,
                height: resolvedStyle.height * zoom,
                flex: '0 0 auto',
                borderRadius: '14px',
                overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.7)',
              }}
            >
              <Stage
                ref={stageRef}
                width={resolvedStyle.width * zoom}
                height={resolvedStyle.height * zoom}
                scaleX={zoom}
                scaleY={zoom}
                onMouseDown={(e) => {
                  if (e.target === e.target.getStage() || e.target.name() === 'card-bg') {
                    setUi({ selectedFieldId: null });
                  }
                }}
                onDragMove={handleLayerDragMove}
                onDragEnd={handleLayerDragEnd}
              >
                <Layer>
                  <Rect
                    name="card-bg"
                    x={0}
                    y={0}
                    width={resolvedStyle.width}
                    height={resolvedStyle.height}
                    fill={resolvedStyle.backgroundColor}
                    stroke={resolvedStyle.borderColor}
                    strokeWidth={12}
                  />

                  {[...resolvedStyle.fields]
                    .map((field, index) => ({ field, index }))
                    .sort(
                      (a, b) =>
                        (a.field.z ?? a.index) - (b.field.z ?? b.index) || a.index - b.index,
                    )
                    .map(({ field }) => {
                      const isTemplateMode = mode === 'template';
                      const isCardEditable = field.editableInCard !== false;
                      const cardRawValue = isCardEditable
                        ? (activeCard?.values[field.id] ?? field.defaultValue ?? '')
                        : (field.defaultValue ?? '');
                      return (
                        <DraggableFieldNode
                          key={field.id}
                          field={field}
                          rawValue={
                            isTemplateMode
                              ? (previewCardValues[field.id] ?? field.defaultValue ?? '')
                              : cardRawValue
                          }
                          allCardValues={
                            isTemplateMode
                              ? previewCardValues
                              : isCardEditable
                                ? (activeCard?.values ?? {})
                                : {
                                    ...(activeCard?.values ?? {}),
                                    [field.id]: field.defaultValue ?? '',
                                  }
                          }
                          resolvedStyle={resolvedStyle}
                          isDesignMode={isTemplateMode}
                          isSelected={selectedFieldId === field.id}
                          onSelect={() => setUi({ selectedFieldId: field.id })}
                          onChange={(updates) => updateFieldProps(field.id, updates)}
                          onScriptError={handleScriptError}
                        />
                      );
                    })}

                  {guides.map((guide, i) =>
                    guide.orientation === 'H' ? (
                      <Line
                        key={`h-${i}`}
                        points={[0, guide.position, resolvedStyle.width, guide.position]}
                        stroke="#38bdf8"
                        strokeWidth={1}
                        dash={[4, 4]}
                        listening={false}
                      />
                    ) : (
                      <Line
                        key={`v-${i}`}
                        points={[guide.position, 0, guide.position, resolvedStyle.height]}
                        stroke="#38bdf8"
                        strokeWidth={1}
                        dash={[4, 4]}
                        listening={false}
                      />
                    ),
                  )}
                </Layer>
              </Stage>
            </div>
          </ErrorBoundary>
        </div>

        {/* Bottom toolbar: only the reset action remains; deck I/O and exports are above "Ajouter une Carte". */}
        <div className="io-toolbar">
          <button
            onClick={resetWorkspace}
            className="io-button"
            style={{ background: '#7f1d1d', borderColor: '#991b1b' }}
            title="Revenir au template intégré et vider le deck"
          >
            <RotateCcw size={16} /> Réinitialiser
          </button>
        </div>
      </div>

      {/* RIGHT: Context-Aware Inspector (card content / template fields), beside the preview */}
      <div className="sidebar-right">
        <ErrorBoundary
          fallbackTitle="Erreur dans l'inspecteur"
          resetKey={boundaryKey}
          onReset={resetWorkspace}
        >
          {mode === 'card' ? (
            <>
              <h3 style={{ marginTop: 0 }}>Contenu de la Carte</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {resolvedStyle.fields
                  .filter((f) => f.type !== 'box' && f.editableInCard !== false)
                  .map((field) => {
                    const currentVal = activeCard?.values[field.id] ?? field.defaultValue ?? '';
                    const fieldInputId = `card-field-${field.id}`;
                    return (
                      <div
                        key={field.id}
                        style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
                      >
                        <label
                          htmlFor={fieldInputId}
                          style={{ fontSize: '13px', color: '#94a3b8' }}
                        >
                          {field.label}
                        </label>

                        {field.type === 'text' && (
                          <textarea
                            id={fieldInputId}
                            rows={field.height > 60 ? 4 : 1}
                            value={currentVal}
                            onChange={(e) => updateCardValue(field.id, e.target.value)}
                            style={inputStyle}
                          />
                        )}

                        {field.type === 'richtext' && (
                          <RichTextEditor
                            value={currentVal}
                            onChange={(html) => updateCardValue(field.id, html)}
                          />
                        )}

                        {field.type === 'select' && (
                          <select
                            id={fieldInputId}
                            value={currentVal}
                            onChange={(e) => updateCardValue(field.id, e.target.value)}
                            style={inputStyle}
                          >
                            {(field.options || []).map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        )}

                        {field.type === 'image' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label
                              style={{
                                ...toolBtnStyle,
                                justifyContent: 'center',
                                background: '#334155',
                              }}
                            >
                              <Upload size={14} /> Choisir une image locale
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleCardImageUpload(field, e)}
                                style={{ display: 'none' }}
                              />
                            </label>
                            <input
                              id={fieldInputId}
                              type="text"
                              placeholder="Ou coller une URL d'image (https://...)"
                              value={currentVal.startsWith('data:') ? '' : currentVal}
                              onChange={(e) => updateCardValue(field.id, e.target.value)}
                              style={inputStyle}
                            />
                            {currentVal && (
                              <button
                                onClick={() => updateCardValue(field.id, '')}
                                style={{
                                  ...smallBtnStyle,
                                  background: '#7f1d1d',
                                  color: '#fecaca',
                                }}
                              >
                                Retirer l'image
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </>
          ) : (
            <>
              <h3 style={{ marginTop: 0 }}>Éditeur de Template & Styles</h3>

              {/* Style & Inheritance Settings */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  paddingBottom: '16px',
                  borderBottom: '1px solid #1e293b',
                }}
              >
                <div>
                  <label style={labelStyle}>Nom du Pack</label>
                  <input
                    type="text"
                    value={pack.name}
                    onChange={(e) =>
                      setPack((prev) => ({ ...prev, name: e.target.value }), 'pack-name')
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Nom de ce Style</label>
                  <input
                    type="text"
                    value={rawActiveStyle?.name || ''}
                    onChange={(e) => updateActiveStyleMeta({ name: e.target.value })}
                    style={inputStyle}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="card-style-width" style={labelStyle}>
                      Largeur carte (px)
                    </label>
                    <input
                      id="card-style-width"
                      type="number"
                      min={1}
                      max={8192}
                      value={resolvedStyle.width}
                      onChange={(e) =>
                        updateActiveStyleMeta({
                          width: clampNumber(e.target.value, resolvedStyle.width, 1, 8192),
                        })
                      }
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="card-style-height" style={labelStyle}>
                      Hauteur carte (px)
                    </label>
                    <input
                      id="card-style-height"
                      type="number"
                      min={1}
                      max={8192}
                      value={resolvedStyle.height}
                      onChange={(e) =>
                        updateActiveStyleMeta({
                          height: clampNumber(e.target.value, resolvedStyle.height, 1, 8192),
                        })
                      }
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Hérite du style (basedOn)</label>
                  <select
                    value={rawActiveStyle?.basedOn || ''}
                    onChange={(e) =>
                      updateActiveStyleMeta({ basedOn: e.target.value || undefined })
                    }
                    style={inputStyle}
                  >
                    <option value="">-- Aucun (Style racine) --</option>
                    {pack.styles
                      .filter((s) => s.key !== currentStyleKey && !descendantStyleKeys.has(s.key))
                      .map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.name} ({s.key})
                        </option>
                      ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <ColorPicker
                    label="Fond"
                    value={resolvedStyle.backgroundColor}
                    onChange={(backgroundColor) => updateActiveStyleMeta({ backgroundColor })}
                  />
                  <ColorPicker
                    label="Bordure"
                    value={resolvedStyle.borderColor}
                    onChange={(borderColor) => updateActiveStyleMeta({ borderColor })}
                  />
                </div>
              </div>

              {/* Component Browser */}
              <div
                style={{
                  marginTop: '16px',
                  paddingBottom: '16px',
                  borderBottom: '1px solid #1e293b',
                }}
              >
                <label style={labelStyle}>
                  Arborescence des composants ({resolvedStyle.fields.length})
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                  <button
                    onClick={() => addTemplateField('text')}
                    style={{ ...toolBtnStyle, padding: '6px 8px', fontSize: '12px' }}
                  >
                    <Type size={14} /> + Texte
                  </button>
                  <button
                    onClick={() => addTemplateField('select')}
                    style={{ ...toolBtnStyle, padding: '6px 8px', fontSize: '12px' }}
                  >
                    <List size={14} /> + Liste
                  </button>
                  <button
                    onClick={() => addTemplateField('image')}
                    style={{ ...toolBtnStyle, padding: '6px 8px', fontSize: '12px' }}
                  >
                    <ImageIcon size={14} /> + Image
                  </button>
                  <button
                    onClick={() => addTemplateField('box')}
                    style={{ ...toolBtnStyle, padding: '6px 8px', fontSize: '12px' }}
                  >
                    <Square size={14} /> + Cadre
                  </button>
                  <button
                    onClick={() => addTemplateField('richtext')}
                    style={{ ...toolBtnStyle, padding: '6px 8px', fontSize: '12px' }}
                  >
                    <PenTool size={14} /> + Richtext
                  </button>
                </div>
                <div
                  role="listbox"
                  aria-label="Arborescence des composants"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    marginTop: '8px',
                  }}
                >
                  {[...resolvedStyle.fields]
                    .map((field, index) => ({ field, index }))
                    .sort(
                      (a, b) =>
                        (b.field.z ?? b.index) - (a.field.z ?? a.index) || b.index - a.index,
                    )
                    .map(({ field, index }) => {
                      const inherited = Boolean(
                        rawActiveStyle?.basedOn &&
                        !rawActiveStyle.fields.some((f) => f.id === field.id),
                      );
                      const Icon =
                        field.type === 'image'
                          ? ImageIcon
                          : field.type === 'select'
                            ? List
                            : field.type === 'box'
                              ? Square
                              : field.type === 'richtext'
                                ? PenTool
                                : Type;
                      const isSelected = selectedFieldId === field.id;

                      return (
                        <div
                          key={field.id}
                          draggable
                          role="option"
                          aria-selected={isSelected}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setUi({ selectedFieldId: field.id });
                            } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                              e.preventDefault();
                              reorderFieldByStep(field.id, e.key === 'ArrowUp' ? -1 : 1);
                            }
                          }}
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', field.id);
                            setDraggedComponentId(field.id);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            reorderComponentsByDrop(field.id);
                          }}
                          onDragEnd={() => setDraggedComponentId(null)}
                          onClick={() => setUi({ selectedFieldId: field.id })}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            cursor: 'grab',
                            background: isSelected ? '#334155' : '#0f172a',
                            border: isSelected ? '1px solid #f59e0b' : '1px solid #1e293b',
                            fontSize: '13px',
                            opacity: draggedComponentId === field.id ? 0.5 : 1,
                          }}
                          title={`${field.label || field.id} (${field.id}) — glisser ou Alt+↑/↓ pour réordonner`}
                        >
                          <span style={{ color: '#475569', fontSize: '12px' }}>└</span>
                          <Icon size={14} color={isSelected ? '#f59e0b' : '#94a3b8'} />
                          <span
                            style={{
                              flex: 1,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {field.label || field.id}
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            z:{field.z ?? index}
                          </span>
                          {inherited && (
                            <span style={{ fontSize: '10px', color: '#38bdf8' }}>hérité</span>
                          )}
                        </div>
                      );
                    })}
                  {resolvedStyle.fields.length === 0 && (
                    <div style={{ color: '#64748b', fontSize: '13px', padding: '4px 0' }}>
                      Aucun composant
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Layer Properties */}
              {selectedField ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    marginTop: '16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <strong>Calque : {selectedField.type.toUpperCase()}</strong>
                      {isFieldInheritedOnly && (
                        <div style={{ fontSize: '11px', color: '#38bdf8' }}>
                          Hérité de {rawActiveStyle?.basedOn} (modifier pour surcharger)
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => deleteOrRevertField(selectedField.id)}
                      style={{
                        background: '#ef4444',
                        color: '#fff',
                        border: 'none',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                      }}
                    >
                      <Trash2 size={13} /> {isFieldInheritedOnly ? 'Hérédité' : 'Supprimer'}
                    </button>
                  </div>

                  <div>
                    <label style={labelStyle}>Libellé (Label)</label>
                    <input
                      type="text"
                      value={selectedField.label}
                      onChange={(e) =>
                        updateFieldProps(selectedField.id, { label: e.target.value })
                      }
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>{STRINGS.fieldId}</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        value={fieldIdDraft}
                        onChange={(e) => setFieldIdDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                        }}
                        onBlur={() => renameFieldId(selectedField.id, fieldIdDraft)}
                        style={inputStyle}
                      />
                      <button
                        onClick={() => renameFieldId(selectedField.id, fieldIdDraft)}
                        style={smallBtnStyle}
                        title={STRINGS.renameField}
                      >
                        {STRINGS.renameField}
                      </button>
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                      Renommer met à jour les valeurs des cartes et la sélection.
                    </div>
                  </div>

                  <div
                    style={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '8px 10px',
                    }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '13px',
                        color: '#e2e8f0',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedField.editableInCard !== false}
                        onChange={(e) =>
                          updateFieldProps(selectedField.id, { editableInCard: e.target.checked })
                        }
                      />
                      Éditable en mode Carte
                    </label>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                      {selectedField.editableInCard !== false
                        ? 'Affiché et modifiable dans le panneau Cartes.'
                        : 'Défini en mode Template uniquement (visible en modes Template et Carte).'}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={labelStyle}>X</label>
                      <input
                        type="number"
                        value={selectedField.x}
                        onChange={(e) =>
                          updateFieldProps(selectedField.id, {
                            x: clampNumber(e.target.value, selectedField.x, -100000, 100000),
                          })
                        }
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Y</label>
                      <input
                        type="number"
                        value={selectedField.y}
                        onChange={(e) =>
                          updateFieldProps(selectedField.id, {
                            y: clampNumber(e.target.value, selectedField.y, -100000, 100000),
                          })
                        }
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Largeur</label>
                      <input
                        type="number"
                        value={selectedField.width}
                        onChange={(e) =>
                          updateFieldProps(selectedField.id, {
                            width: clampNumber(e.target.value, selectedField.width, 1, 8192),
                          })
                        }
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Hauteur</label>
                      <input
                        type="number"
                        value={selectedField.height}
                        onChange={(e) =>
                          updateFieldProps(selectedField.id, {
                            height: clampNumber(e.target.value, selectedField.height, 1, 8192),
                          })
                        }
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Z (ordre)</label>
                      <input
                        type="number"
                        value={
                          selectedField.z ??
                          resolvedStyle.fields.findIndex((f) => f.id === selectedField.id)
                        }
                        onChange={(e) => {
                          const fallbackZ =
                            selectedField.z ??
                            resolvedStyle.fields.findIndex((f) => f.id === selectedField.id);
                          updateFieldProps(selectedField.id, {
                            z: clampNumber(e.target.value, fallbackZ, -100000, 100000),
                          });
                        }}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  {/* Text content for template-only fields */}
                  {selectedField.type === 'text' && selectedField.editableInCard === false && (
                    <div>
                      <label style={labelStyle}>Contenu (Template)</label>
                      <textarea
                        rows={selectedField.height > 60 ? 4 : 2}
                        value={selectedField.defaultValue || ''}
                        onChange={(e) =>
                          updateFieldProps(selectedField.id, { defaultValue: e.target.value })
                        }
                        style={inputStyle}
                      />
                    </div>
                  )}

                  {selectedField.type === 'richtext' && selectedField.editableInCard === false && (
                    <div>
                      <label style={labelStyle}>Contenu riche (Template)</label>
                      <RichTextEditor
                        value={selectedField.defaultValue || ''}
                        onChange={(html) =>
                          updateFieldProps(selectedField.id, { defaultValue: html })
                        }
                      />
                    </div>
                  )}

                  {/* Select Options Configuration */}
                  {selectedField.type === 'select' && (
                    <div
                      style={{
                        background: '#1e293b',
                        padding: '10px',
                        borderRadius: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      {selectedField.editableInCard === false && (
                        <div>
                          <label style={labelStyle}>Valeur sélectionnée (Template)</label>
                          <select
                            value={selectedField.defaultValue || ''}
                            onChange={(e) =>
                              updateFieldProps(selectedField.id, { defaultValue: e.target.value })
                            }
                            style={inputStyle}
                          >
                            <option value="">-- Aucune --</option>
                            {(selectedField.options || []).map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <label style={{ ...labelStyle, marginBottom: 0 }}>
                          Options de la liste
                        </label>
                        <button
                          onClick={() => addSelectOption(selectedField)}
                          style={smallBtnStyle}
                        >
                          + Option
                        </button>
                      </div>
                      {(selectedField.options || []).map((opt, idx) => (
                        <div
                          key={idx}
                          style={{ display: 'flex', gap: '4px', alignItems: 'center' }}
                        >
                          <input
                            type="text"
                            placeholder="Clé"
                            value={opt.value}
                            onChange={(e) =>
                              updateSelectOption(selectedField, idx, 'value', e.target.value)
                            }
                            style={{
                              ...inputStyle,
                              width: '38%',
                              padding: '5px',
                              fontSize: '12px',
                            }}
                          />
                          <input
                            type="text"
                            placeholder="Texte affiché"
                            value={opt.label}
                            onChange={(e) =>
                              updateSelectOption(selectedField, idx, 'label', e.target.value)
                            }
                            style={{ ...inputStyle, flex: 1, padding: '5px', fontSize: '12px' }}
                          />
                          <button
                            onClick={() => removeSelectOption(selectedField, idx)}
                            style={{
                              background: '#7f1d1d',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 6px',
                              cursor: 'pointer',
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Image Opacity & Default URL */}
                  {selectedField.type === 'image' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {selectedField.editableInCard === false && (
                        <label
                          style={{
                            ...toolBtnStyle,
                            justifyContent: 'center',
                            background: '#334155',
                          }}
                        >
                          <Upload size={14} /> Choisir une image (Template)
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              requestImageCrop(
                                file,
                                selectedField.width / Math.max(1, selectedField.height),
                                { kind: 'field', id: selectedField.id },
                              );
                              e.target.value = '';
                            }}
                            style={{ display: 'none' }}
                          />
                        </label>
                      )}
                      <div>
                        <label style={labelStyle}>
                          Opacité ({Math.round((selectedField.opacity ?? 1) * 100)}%)
                        </label>
                        <input
                          type="range"
                          min={0.1}
                          max={1}
                          step={0.05}
                          value={selectedField.opacity ?? 1}
                          onChange={(e) =>
                            updateFieldProps(selectedField.id, { opacity: Number(e.target.value) })
                          }
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>
                          {selectedField.editableInCard === false
                            ? 'Image (URL / Template)'
                            : 'Image par défaut (URL)'}
                        </label>
                        <input
                          type="text"
                          placeholder="https://..."
                          value={
                            selectedField.defaultValue?.startsWith('data:')
                              ? ''
                              : selectedField.defaultValue || ''
                          }
                          onChange={(e) =>
                            updateFieldProps(selectedField.id, { defaultValue: e.target.value })
                          }
                          style={inputStyle}
                        />
                        {selectedField.editableInCard === false && selectedField.defaultValue && (
                          <button
                            onClick={() => updateFieldProps(selectedField.id, { defaultValue: '' })}
                            style={{
                              ...smallBtnStyle,
                              background: '#7f1d1d',
                              color: '#fecaca',
                              marginTop: '6px',
                            }}
                          >
                            Retirer l'image (Template)
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Text & Select Typography */}
                  {(selectedField.type === 'text' ||
                    selectedField.type === 'select' ||
                    selectedField.type === 'richtext') && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={labelStyle}>Taille Police</label>
                          <input
                            type="number"
                            value={selectedField.fontSize || 16}
                            onChange={(e) =>
                              updateFieldProps(selectedField.id, {
                                fontSize: clampNumber(e.target.value, 16, 1, 512),
                              })
                            }
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Alignement</label>
                          <select
                            value={selectedField.align || 'left'}
                            onChange={(e) =>
                              updateFieldProps(selectedField.id, { align: e.target.value as any })
                            }
                            style={inputStyle}
                          >
                            <option value="left">Gauche</option>
                            <option value="center">Centre</option>
                            <option value="right">Droite</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>Police</label>
                        <select
                          value={selectedField.fontFamily || 'Arial'}
                          onChange={(e) => {
                            const family = e.target.value;
                            updateFieldProps(selectedField.id, { fontFamily: family });
                            loadGoogleFont(family).then(() => stageRef.current?.batchDraw());
                          }}
                          style={inputStyle}
                        >
                          <option value="Arial">Arial (système)</option>
                          {DEFAULT_GAMING_FONTS.map((font) => (
                            <option key={font.family} value={font.family}>
                              {font.family}
                            </option>
                          ))}
                        </select>
                      </div>
                      <ColorPicker
                        label="Couleur du texte"
                        value={selectedField.color || '#ffffff'}
                        onChange={(color) => updateFieldProps(selectedField.id, { color })}
                      />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={labelStyle}>{STRINGS.verticalAlign}</label>
                          <select
                            value={selectedField.verticalAlign || 'top'}
                            onChange={(e) =>
                              updateFieldProps(selectedField.id, {
                                verticalAlign: e.target.value as NonNullable<
                                  TemplateField['verticalAlign']
                                >,
                              })
                            }
                            style={inputStyle}
                          >
                            <option value="top">Haut</option>
                            <option value="middle">Milieu</option>
                            <option value="bottom">Bas</option>
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>{STRINGS.lineHeight}</label>
                          <input
                            type="number"
                            min={0.5}
                            max={5}
                            step={0.05}
                            value={selectedField.lineHeight ?? 1.25}
                            onChange={(e) =>
                              updateFieldProps(selectedField.id, {
                                lineHeight: clampNumber(e.target.value, 1.25, 0.5, 5),
                              })
                            }
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>{STRINGS.letterSpacing}</label>
                          <input
                            type="number"
                            min={-100}
                            max={100}
                            step={0.5}
                            value={selectedField.letterSpacing ?? 0}
                            onChange={(e) =>
                              updateFieldProps(selectedField.id, {
                                letterSpacing: clampNumber(e.target.value, 0, -100, 100),
                              })
                            }
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>{STRINGS.strokeWidth}</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            value={selectedField.strokeWidth ?? 0}
                            onChange={(e) =>
                              updateFieldProps(selectedField.id, {
                                strokeWidth: clampNumber(e.target.value, 0, 0, 100),
                              })
                            }
                            style={inputStyle}
                          />
                        </div>
                      </div>
                      <ColorPicker
                        label={STRINGS.textStroke}
                        value={selectedField.stroke || '#020617'}
                        onChange={(stroke) => updateFieldProps(selectedField.id, { stroke })}
                      />
                    </>
                  )}

                  {selectedField.type === 'box' && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <ColorPicker
                          label="Remplissage"
                          value={selectedField.fill || '#0f172a'}
                          onChange={(fill) => updateFieldProps(selectedField.id, { fill })}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <ColorPicker
                          label="Contour"
                          value={selectedField.color || '#334155'}
                          onChange={(color) => updateFieldProps(selectedField.id, { color })}
                        />
                      </div>
                    </div>
                  )}

                  {/* Custom JS Render Hook */}
                  <div>
                    <ScriptHelpPanel
                      open={showScriptHelp}
                      onToggle={() => setShowScriptHelp((value) => !value)}
                    />
                    <textarea
                      rows={4}
                      placeholder={`// Variables: card, style, field
if (card.puissance > 3) {
  return { color: '#f59e0b' };
}
return { color: '#ffffff', visible: true };`}
                      value={selectedField.script || ''}
                      onChange={(e) =>
                        updateFieldProps(selectedField.id, { script: e.target.value })
                      }
                      style={{
                        ...inputStyle,
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        background: '#020617',
                      }}
                    />
                    {visibleScriptError && (
                      <div style={{ color: '#f87171', fontSize: '11px', marginTop: '4px' }}>
                        Erreur JS : {visibleScriptError}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p style={{ color: '#64748b', fontSize: '14px', marginTop: '16px' }}>
                  Cliquez sur un élément de la carte pour le déplacer, le redimensionner ou modifier
                  ses options.
                </p>
              )}
            </>
          )}
        </ErrorBoundary>
      </div>

      {cropRequest && (
        <ImageCropper
          imageSrc={cropRequest.src}
          aspectRatio={cropRequest.aspectRatio}
          onCropComplete={commitCroppedImage}
          onCancel={() => setCropRequest(null)}
        />
      )}

      {showPdfOptions && (
        <PdfOptionsDialog
          options={pdfOptions}
          onChange={setPdfOptions}
          onCancel={() => setShowPdfOptions(false)}
          onGenerate={() => {
            setShowPdfOptions(false);
            void handleExportDeckPdf();
          }}
        />
      )}
    </div>
  );
}
