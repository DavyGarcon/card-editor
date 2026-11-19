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
  AlertCircle,
} from 'lucide-react';
import { CardStyleDefinition, FieldType, SelectOption, TemplateField } from './types/template';
import { resolveCardStyle } from './utils/styleResolver';
import { evaluateFieldScript } from './utils/scriptEvaluator';
import { DraggableFieldNode } from './components/DraggableFieldNode';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Line } from 'react-konva';
import {
  getLineGuideStops,
  getObjectSnappingEdges,
  getGuides,
  GuideLineRender,
} from './utils/snapGuides';
import { Printer, Undo2, Redo2, RotateCcw } from 'lucide-react';
import { exportDeckToPdf } from './utils/pdfExporter';
import { renderCardToDataUrl } from './utils/cardRenderer';
import {
  clearTemplateSession,
  loadTemplateFile,
  loadTemplateSession,
  saveTemplateFile,
  type TemplateSession,
} from './io/templateIO';
import {
  clearDeckSession,
  loadDeckFile,
  loadDeckSession,
  saveDeckFile,
  type DeckSession,
} from './io/deckIO';
import { clearRecovery, downloadRecovery, type SessionKind } from './io/recovery';
import { useUndoableDocument } from './hooks/useUndoableDocument';
import { useAutosave } from './hooks/useAutosave';
import { INITIAL_CARDS, INITIAL_PACK } from './data/starterPack';

/** Numeric inputs can transiently be empty or non-finite; keep documents valid. */
function clampNumber(raw: string, fallback: number, min: number, max: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export default function App() {
  const savedTemplate = useMemo(
    () =>
      loadTemplateSession({
        pack: INITIAL_PACK,
        activeStyleKey: INITIAL_PACK.activeStyleKey || 'spell_fire',
        mode: 'card',
      }),
    [],
  );
  const savedDeck = useMemo(
    () =>
      loadDeckSession(
        { cards: INITIAL_CARDS, activeCardId: INITIAL_CARDS[0]?.id },
        INITIAL_PACK.styles,
      ),
    [],
  );
  const initialError = savedTemplate.error ?? savedDeck.error ?? null;
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
    canUndo,
    canRedo,
  } = useUndoableDocument({
    pack: savedTemplate.session.pack,
    cards: savedDeck.session.cards,
    activeStyleKey: savedTemplate.session.activeStyleKey,
    activeCardId: savedDeck.session.activeCardId,
    selectedFieldId: 'title',
    mode: savedTemplate.session.mode,
  });
  const [errorBanner, setErrorBanner] = useState<string | null>(initialError);
  const [recoveryKind, setRecoveryKind] = useState<SessionKind | null>(
    savedTemplate.error ? 'template' : savedDeck.error ? 'deck' : null,
  );
  const [dismissedStyleError, setDismissedStyleError] = useState<string | null>(null);
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
  // Two independent slots; failures are reported instead of silently ignored.
  const { status: saveStatus, saveNow: flushSave } = useAutosave(templateSession, deckSession);

  const showError = useCallback((message: string | null, kind?: SessionKind) => {
    setErrorBanner(message);
    setRecoveryKind(kind ?? null);
  }, []);

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
  const isFieldInheritedOnly = Boolean(
    selectedField &&
    rawActiveStyle?.basedOn &&
    !rawActiveStyle.fields.some((f) => f.id === selectedField.id),
  );

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

  const reorderComponentsByDrop = (targetFieldId: string) => {
    if (mode !== 'template' || !draggedComponentId || draggedComponentId === targetFieldId) return;

    const displayOrderIds = [...resolvedStyle.fields]
      .map((field, index) => ({ field, index }))
      .sort((a, b) => (b.field.z ?? b.index) - (a.field.z ?? a.index) || b.index - a.index)
      .map(({ field }) => field.id);

    const fromIndex = displayOrderIds.indexOf(draggedComponentId);
    const toIndex = displayOrderIds.indexOf(targetFieldId);
    if (fromIndex < 0 || toIndex < 0) return;

    const nextOrderIds = [...displayOrderIds];
    nextOrderIds.splice(fromIndex, 1);
    nextOrderIds.splice(toIndex, 0, draggedComponentId);

    const zById = new Map<string, number>();
    nextOrderIds.forEach((id, displayIdx) => {
      zById.set(id, nextOrderIds.length - 1 - displayIdx);
    });

    setPack((prev) => ({
      ...prev,
      styles: prev.styles.map((s) => {
        if (s.key !== currentStyleKey) return s;

        let fields = [...s.fields];
        for (const [id, z] of zById.entries()) {
          const existsLocally = fields.some((f) => f.id === id);
          if (existsLocally) {
            fields = fields.map((f) => (f.id === id ? { ...f, z } : f));
          } else {
            const baseField = resolvedStyle.fields.find((f) => f.id === id);
            if (baseField) {
              // Inherited field: keep the rest of the parent definition and
              // override only the stacking order.
              fields = [...fields, { ...baseField, z, zOnly: true }];
            }
          }
        }

        return { ...s, fields };
      }),
    }));

    setDraggedComponentId(null);
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
    const nextOptions = (field.options || []).filter((_, i) => i !== idx);
    updateFieldProps(field.id, { options: nextOptions });
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
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCropRequest({ src: reader.result, aspectRatio, target });
      }
    };
    reader.onerror = () => showError('Impossible de lire le fichier image.');
    reader.readAsDataURL(file);
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

  // --- Export / Import ---
  const exportPNG = async () => {
    if (!activeCard) return;
    try {
      const uri = await renderCardToDataUrl(activeCard, resolvedStyle, 2);
      const link = document.createElement('a');
      link.download = `${activeCard.values.title || 'carte'}.png`;
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
        const session = await loadDeckFile(file, pack.styles);
        const availableKeys = new Set(pack.styles.map((s) => s.key));
        const fallbackKey = currentStyleKey;
        const incompatibleCount = session.cards.filter(
          (c) => !availableKeys.has(c.styleKey),
        ).length;
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

  const resetProject = () => {
    clearTemplateSession();
    clearDeckSession();
    clearRecovery('template');
    clearRecovery('deck');
    // Hard reset also empties the undo timeline: old sessions must not be
    // resurrected by Ctrl+Z after an explicit "Réinitialiser".
    resetDocument({
      pack: INITIAL_PACK,
      cards: INITIAL_CARDS,
      activeStyleKey: INITIAL_PACK.activeStyleKey || 'spell_fire',
      activeCardId: INITIAL_CARDS[0]?.id ?? '',
      selectedFieldId: 'title',
      mode: 'card',
    });
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
        cardWidthMm: 63.5,
        gapMm: 2,
        drawCropMarks: true,
        filename: `${pack.name.toLowerCase().replace(/\s+/g, '-')}-planche-a4.pdf`,
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
  }, [undo, redo, saveTemplate, saveDeck, mode]);

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
          <Layers size={20} color="#f59e0b" /> Modern Geckos
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Annuler (Ctrl+Z)"
            aria-label="Annuler"
            style={{ ...smallBtnStyle, flex: 1, opacity: canUndo ? 1 : 0.4 }}
          >
            <Undo2 size={14} /> Annuler
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="Rétablir (Ctrl+Maj+Z)"
            aria-label="Rétablir"
            style={{ ...smallBtnStyle, flex: 1, opacity: canRedo ? 1 : 0.4 }}
          >
            <Redo2 size={14} /> Rétablir
          </button>
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
            </div>
          )}
        </div>

        {/* Card mode: deck management is hidden while editing the template. */}
        {mode === 'card' && (
          <>
            <button
              onClick={addNewCard}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px',
                background: '#334155',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              <Plus size={16} /> Ajouter une Carte
            </button>

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
                        const remaining = cards.filter((item) => item.id !== c.id);
                        // Deleting the selected card must leave a valid selection.
                        setDocument({
                          ...snapshot(),
                          cards: remaining,
                          activeCardId:
                            activeCardId === c.id ? (remaining[0]?.id ?? '') : activeCardId,
                          activeStyleKey:
                            activeCardId === c.id
                              ? (remaining[0]?.styleKey ?? activeStyleKey)
                              : activeStyleKey,
                        });
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
      <div className="stage-area">
        {bannerMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#7f1d1d',
              color: '#fecaca',
              padding: '8px 14px',
              borderRadius: '6px',
              fontSize: '13px',
            }}
          >
            <AlertCircle size={16} />
            <span style={{ flex: 1 }}>{bannerMessage}</span>
            {recoveryKind && (
              <button
                onClick={() => {
                  downloadRecovery(recoveryKind);
                  clearRecovery(recoveryKind);
                  showError(null);
                }}
                style={{
                  background: '#334155',
                  border: '1px solid #fca5a5',
                  color: '#fff',
                  borderRadius: '4px',
                  padding: '3px 8px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  whiteSpace: 'nowrap',
                }}
              >
                Récupérer la copie
              </button>
            )}
            <button
              onClick={() => {
                if (recoveryKind) clearRecovery(recoveryKind);
                showError(null);
                if (styleResolution.error) setDismissedStyleError(styleResolution.error);
              }}
              aria-label="Fermer le message d'erreur"
              style={{
                background: 'none',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              ×
            </button>
          </div>
        )}

        <ErrorBoundary
          fallbackTitle="Erreur de rendu du canevas"
          resetKey={boundaryKey}
          onReset={resetProject}
        >
          <div
            style={{
              borderRadius: '14px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.7)',
            }}
          >
            <Stage
              ref={stageRef}
              width={resolvedStyle.width}
              height={resolvedStyle.height}
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
                    (a, b) => (a.field.z ?? a.index) - (b.field.z ?? b.index) || a.index - b.index,
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

        {/* Save status is always visible so a failed autosave cannot go unnoticed. */}
        <div
          role="status"
          aria-live="polite"
          style={{
            fontSize: '12px',
            color: saveStatus === 'error' ? '#fca5a5' : '#94a3b8',
            padding: '0 4px',
          }}
        >
          {saveStatus === 'saving'
            ? 'Sauvegarde en cours…'
            : saveStatus === 'error'
              ? 'Sauvegarde impossible (stockage plein ou indisponible)'
              : 'Modifications sauvegardées localement'}
          {saveStatus === 'error' && (
            <button
              onClick={flushSave}
              style={{
                marginLeft: '8px',
                background: '#334155',
                color: '#fff',
                border: '1px solid #475569',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Réessayer
            </button>
          )}
        </div>

        {/* Bottom toolbar: only the controls for the active mode. */}
        <div className="io-toolbar">
          {mode === 'card' ? (
            <>
              <div className="io-group" role="group" aria-label="Rendu des cartes">
                <span className="io-group-label">Rendu</span>
                <button
                  onClick={handleExportDeckPdf}
                  disabled={isExportingPdf}
                  style={{
                    ...toolBtnStyle,
                    background: isExportingPdf ? '#475569' : '#6366f1',
                    fontWeight: 'bold',
                  }}
                >
                  <Printer size={16} />
                  {isExportingPdf ? 'Génération PDF...' : `Planche PDF (${cards.length} cartes)`}
                </button>
                <button
                  onClick={exportPNG}
                  style={{ ...toolBtnStyle, background: '#10b981', fontWeight: 'bold' }}
                >
                  <Download size={16} /> Carte PNG
                </button>
              </div>
              <DeckIOControls cardCount={cards.length} onSave={saveDeck} onLoad={loadDeck} />
            </>
          ) : (
            <TemplateIOControls onSave={saveTemplate} onLoad={loadTemplate} />
          )}

          <button
            onClick={resetProject}
            className="io-button"
            style={{ background: '#7f1d1d', borderColor: '#991b1b' }}
            title="Réinitialiser et effacer les deux sauvegardes locales"
          >
            <RotateCcw size={16} /> Réinitialiser
          </button>
        </div>
      </div>

      {/* LEFT: Context-Aware Inspector (below deck & styles) */}
      <div className="sidebar-right">
        <ErrorBoundary
          fallbackTitle="Erreur dans l'inspecteur"
          resetKey={boundaryKey}
          onReset={resetProject}
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
                      .filter((s) => s.key !== currentStyleKey)
                      .map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.name} ({s.key})
                        </option>
                      ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <ColorPicker
                      label="Fond"
                      value={resolvedStyle.backgroundColor}
                      onChange={(backgroundColor) => updateActiveStyleMeta({ backgroundColor })}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <ColorPicker
                      label="Bordure"
                      value={resolvedStyle.borderColor}
                      onChange={(borderColor) => updateActiveStyleMeta({ borderColor })}
                    />
                  </div>
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
                          title={`${field.label || field.id} (${field.id}) — glisser pour réordonner`}
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
                    <label style={labelStyle}>Script JS de rendu (optionnel)</label>
                    <textarea
                      rows={4}
                      placeholder={`// Variables: card, style, field
return {
  color: '#f59e0b',
  visible: true
};`}
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
          onCropComplete={(dataUrl) => {
            if (cropRequest.target.kind === 'card' && cropRequest.target.fieldId) {
              updateCardValue(cropRequest.target.fieldId, dataUrl);
            } else {
              updateFieldProps(cropRequest.target.id, { defaultValue: dataUrl });
            }
            setCropRequest(null);
          }}
          onCancel={() => setCropRequest(null)}
        />
      )}
    </div>
  );
}

const toolBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 12px',
  background: '#334155',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '13px',
};

const smallBtnStyle: React.CSSProperties = {
  padding: '5px 8px',
  background: '#334155',
  color: '#f8fafc',
  border: 'none',
  borderRadius: '5px',
  cursor: 'pointer',
  fontSize: '11px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px',
  borderRadius: '6px',
  background: '#1e293b',
  color: '#fff',
  border: '1px solid #334155',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#94a3b8',
  display: 'block',
  marginBottom: '4px',
};
