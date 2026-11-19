import type { jsPDF as JsPdfType } from 'jspdf';

export interface PdfExportOptions {
  /** Largeur réelle d'impression d'une carte en millimètres (ex: 63.5 pour format Poker/Magic) */
  cardWidthMm?: number;
  /** Hauteur réelle d'impression d'une carte en millimètres (ex: 88.9 pour format Poker/Magic) */
  cardHeightMm?: number;
  /** Espacement entre les cartes en mm (0 pour découpe bord-à-bord) */
  gapMm?: number;
  /** Afficher les traits de coupe autour des cartes */
  drawCropMarks?: boolean;
  /** Nom du fichier PDF généré */
  filename?: string;
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
  if (ratios.length !== cardDataUrls.length) {
    throw new Error('Chaque carte doit avoir ses propres dimensions.');
  }

  const {
    cardWidthMm = 63.5,
    gapMm = 2,
    drawCropMarks = true,
    filename = 'deck-impression-a4.pdf',
  } = options;

  const imageHeightsMm = ratios.map(
    (ratio) => Math.round((cardWidthMm * ratio.height) / ratio.width / 10) / 10,
  );
  const cellHeightMm = options.cardHeightMm ?? Math.max(...imageHeightsMm);

  // Format A4 Portrait en millimètres (210 x 297 mm)
  const pageWidth = 210;
  const pageHeight = 297;
  const minMargin = 10;

  // Calcul automatique du nombre de colonnes et lignes par page A4
  const cols = Math.max(1, Math.floor((pageWidth - minMargin * 2 + gapMm) / (cardWidthMm + gapMm)));
  const rows = Math.max(
    1,
    Math.floor((pageHeight - minMargin * 2 + gapMm) / (cellHeightMm + gapMm)),
  );
  const cardsPerPage = cols * rows;

  // Centrage parfait de la grille sur la feuille A4
  const gridWidth = cols * cardWidthMm + (cols - 1) * gapMm;
  const gridHeight = rows * cellHeightMm + (rows - 1) * gapMm;
  const startX = (pageWidth - gridWidth) / 2;
  const startY = (pageHeight - gridHeight) / 2;

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  cardDataUrls.forEach((dataUrl, index) => {
    // Ajouter une nouvelle page A4 quand la grille est pleine
    if (index > 0 && index % cardsPerPage === 0) {
      doc.addPage();
    }

    const indexOnPage = index % cardsPerPage;
    const col = indexOnPage % cols;
    const row = Math.floor(indexOnPage / cols);

    const x = startX + col * (cardWidthMm + gapMm);
    const y = startY + row * (cellHeightMm + gapMm);
    const imageHeight = imageHeightsMm[index];

    // 1. Dessiner l'image haute résolution de la carte, centrée dans sa cellule
    // (les styles mixtes ont des ratios différents : surtout pas d'étirement).
    doc.addImage(
      dataUrl,
      'PNG',
      x,
      y + (cellHeightMm - imageHeight) / 2,
      cardWidthMm,
      imageHeight,
      undefined,
      'FAST',
    );

    // 2. Dessiner les traits de coupe aux 4 coins de la cellule
    if (drawCropMarks) {
      drawCardCropMarks(doc, x, y, cardWidthMm, cellHeightMm);
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
