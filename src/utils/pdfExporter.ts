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
  const cellHeightMm = options.cardHeightMm ?? Math.max(...imageHeightsMm);
  // Every column is sized for the widest card, then narrower cards are centred
  // inside it. The grid stays regular while each card keeps its real size.
  const columnWidthMm = Math.max(...widthsMm);

  // Dimensions de la feuille en millimètres.
  const paper = getPaperDimensions(paperSize, orientation);
  const pageWidth = paper.widthMm;
  const pageHeight = paper.heightMm;

  // Calcul automatique du nombre de colonnes et lignes par page
  const cols = Math.max(
    1,
    Math.floor((pageWidth - marginMm * 2 + gapMm) / (columnWidthMm + gapMm)),
  );
  const rows = Math.max(
    1,
    Math.floor((pageHeight - marginMm * 2 + gapMm) / (cellHeightMm + gapMm)),
  );
  const cardsPerPage = cols * rows;

  // Centrage parfait de la grille sur la feuille
  const gridWidth = cols * columnWidthMm + (cols - 1) * gapMm;
  const gridHeight = rows * cellHeightMm + (rows - 1) * gapMm;
  const startX = (pageWidth - gridWidth) / 2;
  const startY = (pageHeight - gridHeight) / 2;

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: paperSize,
  });

  cardDataUrls.forEach((dataUrl, index) => {
    // Ajouter une nouvelle feuille quand la grille est pleine
    if (index > 0 && index % cardsPerPage === 0) {
      doc.addPage();
    }

    const indexOnPage = index % cardsPerPage;
    const col = indexOnPage % cols;
    const row = Math.floor(indexOnPage / cols);

    const cellX = startX + col * (columnWidthMm + gapMm);
    const cellY = startY + row * (cellHeightMm + gapMm);
    const cardWidth = widthsMm[index];
    const imageHeight = imageHeightsMm[index];
    // Mixed styles can differ in both width and ratio: centre the real card in
    // its cell instead of stretching it to the cell or to the active style.
    const x = cellX + (columnWidthMm - cardWidth) / 2;
    const y = cellY + (cellHeightMm - imageHeight) / 2;

    // 1. Dessiner l'image haute résolution de la carte à sa taille réelle.
    doc.addImage(dataUrl, 'PNG', x, y, cardWidth, imageHeight, undefined, 'FAST');

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
