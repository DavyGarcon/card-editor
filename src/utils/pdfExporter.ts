import type { jsPDF as JsPdfType } from 'jspdf';
import { getPaperDimensions, type PaperOrientation, type PaperSize } from './paperFormats';

export interface PdfExportOptions {
  /**
   * Largeur réelle d'impression en millimètres. Un tableau permet d'imprimer
   * chaque carte à la largeur de son propre modèle (deck à styles mixtes).
   */
  cardWidthMm?: number | number[];
  /** Hauteur réelle d'impression d'une carte en millimètres (ex: 88.9 pour format Poker/Magic) */
  cardHeightMm?: number;
  /** Espacement entre les cartes en mm (0 pour découpe bord-à-bord) */
  gapMm?: number;
  /** Marge minimale autour de la grille sur la feuille, en mm */
  marginMm?: number;
  /** Afficher les traits de coupe autour des cartes */
  drawCropMarks?: boolean;
  /** Nom du fichier PDF généré */
  filename?: string;
  /** Format de feuille utilisé pour la planche */
  paperSize?: PaperSize;
  /** Sens d'impression de la feuille */
  orientation?: PaperOrientation;
}

export async function exportDeckToPdf(
  cardDataUrls: string[],
  canvasRatio: { width: number; height: number } | Array<{ width: number; height: number }>,
  options: PdfExportOptions = {},
) {
  if (cardDataUrls.length === 0) {
    throw new Error('Aucune carte à exporter.');
  }

  const ratios = Array.isArray(canvasRatio) ? canvasRatio : cardDataUrls.map(() => canvasRatio);
  if (ratios.length !== cardDataUrls.length || ratios.length === 0) {
    throw new Error('Chaque carte doit avoir ses propres dimensions.');
  }
  if (
    ratios.some(
      (ratio) =>
        !Number.isFinite(ratio.width) ||
        ratio.width <= 0 ||
        !Number.isFinite(ratio.height) ||
        ratio.height <= 0,
    )
  ) {
    throw new Error('Dimensions de carte invalides.');
  }

  const {
    cardWidthMm = 63.5,
    gapMm = 2,
    marginMm = 10,
    drawCropMarks = true,
    filename = 'deck-impression-a4.pdf',
    paperSize = 'a4',
    orientation = 'portrait',
  } = options;
  const widthsMm = Array.isArray(cardWidthMm) ? cardWidthMm : cardDataUrls.map(() => cardWidthMm);
  if (
    widthsMm.length !== cardDataUrls.length ||
    widthsMm.some((width) => !Number.isFinite(width) || width <= 0) ||
    !Number.isFinite(gapMm) ||
    gapMm < 0 ||
    !Number.isFinite(marginMm) ||
    marginMm < 0
  ) {
    throw new Error("Dimensions d'impression invalides.");
  }

  const imageHeightsMm = ratios.map(
    (ratio, index) => Math.round(((widthsMm[index] * ratio.height) / ratio.width) * 10) / 10,
  );
  const cardHeight = (index: number) => options.cardHeightMm ?? imageHeightsMm[index];

  // Dimensions de la feuille en millimètres.
  const paper = getPaperDimensions(paperSize, orientation);
  const pageWidth = paper.widthMm;
  const pageHeight = paper.heightMm;

  interface CardPlacement {
    index: number;
    page: number;
    x: number;
    y: number;
  }
  const placements: CardPlacement[] = [];
  const oneSize =
    widthsMm.every((width) => width === widthsMm[0]) &&
    imageHeightsMm.every((height) => height === imageHeightsMm[0]);

  if (oneSize) {
    // Uniform deck: keep the regular, centred grid used by single-style decks.
    const cardWidth = widthsMm[0];
    const cellHeightMm = options.cardHeightMm ?? imageHeightsMm[0];
    const cols = Math.max(1, Math.floor((pageWidth - marginMm * 2 + gapMm) / (cardWidth + gapMm)));
    const rows = Math.max(
      1,
      Math.floor((pageHeight - marginMm * 2 + gapMm) / (cellHeightMm + gapMm)),
    );
    const cardsPerPage = cols * rows;
    const gridWidth = cols * cardWidth + (cols - 1) * gapMm;
    const gridHeight = rows * cellHeightMm + (rows - 1) * gapMm;
    const startX = (pageWidth - gridWidth) / 2;
    const startY = (pageHeight - gridHeight) / 2;

    cardDataUrls.forEach((_, index) => {
      const indexOnPage = index % cardsPerPage;
      const col = indexOnPage % cols;
      const row = Math.floor(indexOnPage / cols);
      placements.push({
        index,
        page: Math.floor(index / cardsPerPage),
        x: startX + col * (cardWidth + gapMm),
        y: startY + row * (cellHeightMm + gapMm) + (cellHeightMm - imageHeightsMm[index]) / 2,
      });
    });
  } else {
    // Mixed styles: pack cards by their real sizes. A grid sized by the widest
    // style would leave oversized gaps (or even overlap) around small cards.
    const usableWidth = pageWidth - marginMm * 2;
    const usableHeight = pageHeight - marginMm * 2;
    interface PdfRow {
      indices: number[];
      widthMm: number;
      heightMm: number;
    }
    const pages: PdfRow[][] = [[]];
    let pageRows = pages[0];
    let currentRow: number[] = [];
    let currentRowWidthMm = 0;

    const finishRow = () => {
      if (currentRow.length === 0) return;
      const row: PdfRow = {
        indices: currentRow,
        widthMm: currentRowWidthMm,
        heightMm: Math.max(...currentRow.map(cardHeight)),
      };
      const usedHeightMm =
        pageRows.reduce((total, placed) => total + placed.heightMm, 0) +
        Math.max(0, pageRows.length - 1) * gapMm;
      if (pageRows.length > 0 && usedHeightMm + gapMm + row.heightMm > usableHeight) {
        pageRows = [];
        pages.push(pageRows);
      }
      pageRows.push(row);
      currentRow = [];
      currentRowWidthMm = 0;
    };

    cardDataUrls.forEach((_, index) => {
      const nextWidthMm = currentRowWidthMm + (currentRow.length > 0 ? gapMm : 0) + widthsMm[index];
      if (currentRow.length > 0 && nextWidthMm > usableWidth) finishRow();
      currentRow.push(index);
      currentRowWidthMm =
        currentRow.length === 1 ? widthsMm[index] : currentRowWidthMm + gapMm + widthsMm[index];
    });
    finishRow();

    pages.forEach((rows, pageIndex) => {
      const gridHeightMm =
        rows.reduce((total, row) => total + row.heightMm, 0) + Math.max(0, rows.length - 1) * gapMm;
      let rowY = (pageHeight - gridHeightMm) / 2;

      rows.forEach((row) => {
        let cardX = (pageWidth - row.widthMm) / 2;
        row.indices.forEach((index) => {
          placements.push({
            index,
            page: pageIndex,
            x: cardX,
            // A card shorter than its row is centred vertically, never stretched.
            y: rowY + (row.heightMm - imageHeightsMm[index]) / 2,
          });
          cardX += widthsMm[index] + gapMm;
        });
        rowY += row.heightMm + gapMm;
      });
    });
  }

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: paperSize,
  });

  let currentPage = 0;
  placements.forEach((placement) => {
    if (placement.page > currentPage) {
      doc.addPage();
      currentPage = placement.page;
    }
    const { index, x, y } = placement;
    const cardWidth = widthsMm[index];
    const imageHeight = imageHeightsMm[index];

    // 1. Dessiner l'image haute résolution de la carte à sa taille réelle.
    doc.addImage(cardDataUrls[index], 'PNG', x, y, cardWidth, imageHeight, undefined, 'FAST');

    // 2. Dessiner les traits de coupe aux 4 coins de la carte imprimée
    if (drawCropMarks) {
      drawCardCropMarks(doc, x, y, cardWidth, imageHeight);
    }
  });

  doc.save(filename);
}

/**
 * Trace de fins traits de coupe gris clair aux 4 coins d'une carte.
 */
function drawCardCropMarks(doc: JsPdfType, x: number, y: number, w: number, h: number) {
  const markLen = 3; // Longueur du trait en mm
  const offset = 0.5; // Décalage léger pour ne pas mordre sur l'illustration

  doc.setDrawColor(140, 140, 140);
  doc.setLineWidth(0.15);

  // Coin Haut-Gauche
  doc.line(x - offset - markLen, y, x - offset, y);
  doc.line(x, y - offset - markLen, x, y - offset);

  // Coin Haut-Droit
  doc.line(x + w + offset, y, x + w + offset + markLen, y);
  doc.line(x + w, y - offset - markLen, x + w, y - offset);

  // Coin Bas-Gauche
  doc.line(x - offset - markLen, y + h, x - offset, y + h);
  doc.line(x, y + h + offset, x, y + h + offset + markLen);

  // Coin Bas-Droit
  doc.line(x + w + offset, y + h, x + w + offset + markLen, y + h);
  doc.line(x + w, y + h + offset, x + w, y + h + offset + markLen);
}
