import Konva from 'konva';

export interface SnapLine {
  lineGuide: number;
  diff: number;
  orientation: 'V' | 'H';
  snap: 'start' | 'center' | 'end';
}

export interface GuideLineRender {
  orientation: 'V' | 'H';
  position: number;
}

const GUIDELINE_OFFSET = 6; // Distance en pixels pour déclencher l'aimantation

/**
 * Récupère toutes les positions X (verticales) et Y (horizontales) sur lesquelles un objet peut s'aimanter.
 */
export function getLineGuideStops(
  skipShape: Konva.Node,
  stage: Konva.Stage,
  canvasWidth: number,
  canvasHeight: number
) {
  // 1. Repères du canevas (bords extérieurs + centre)
  const vertical: number[] = [0, canvasWidth / 2, canvasWidth];
  const horizontal: number[] = [0, canvasHeight / 2, canvasHeight];

  // 2. Repères de tous les autres calques présents sur la carte
  stage.find('.template-field').forEach((guideItem) => {
    if (guideItem === skipShape) {
      return;
    }
    const box = guideItem.getClientRect({ relativeTo: stage });
    vertical.push(box.x, box.x + box.width / 2, box.x + box.width);
    horizontal.push(box.y, box.y + box.height / 2, box.y + box.height);
  });

  return { vertical, horizontal };
}

/**
 * Récupère les 3 points d'ancrage (début, centre, fin) de l'élément en cours de déplacement.
 */
export function getObjectSnappingEdges(node: Konva.Node, stage: Konva.Stage) {
  const box = node.getClientRect({ relativeTo: stage });
  const absPos = node.absolutePosition();

  return {
    vertical: [
      { guide: Math.round(box.x), offset: Math.round(absPos.x - box.x), snap: 'start' as const },
      { guide: Math.round(box.x + box.width / 2), offset: Math.round(absPos.x - box.x - box.width / 2), snap: 'center' as const },
      { guide: Math.round(box.x + box.width), offset: Math.round(absPos.x - box.x - box.width), snap: 'end' as const },
    ],
    horizontal: [
      { guide: Math.round(box.y), offset: Math.round(absPos.y - box.y), snap: 'start' as const },
      { guide: Math.round(box.y + box.height / 2), offset: Math.round(absPos.y - box.y - box.height / 2), snap: 'center' as const },
      { guide: Math.round(box.y + box.height), offset: Math.round(absPos.y - box.y - box.height), snap: 'end' as const },
    ],
  };
}

/**
 * Trouve les alignements les plus proches en dessous du seuil GUIDELINE_OFFSET.
 */
export function getGuides(
  lineGuideStops: { vertical: number[]; horizontal: number[] },
  itemBounds: ReturnType<typeof getObjectSnappingEdges>
): SnapLine[] {
  const resultV: SnapLine[] = [];
  const resultH: SnapLine[] = [];

  lineGuideStops.vertical.forEach((lineGuide) => {
    itemBounds.vertical.forEach((itemBound) => {
      const diff = Math.abs(lineGuide - itemBound.guide);
      if (diff < GUIDELINE_OFFSET) {
        resultV.push({
          lineGuide,
          diff,
          orientation: 'V',
          snap: itemBound.snap,
        });
      }
    });
  });

  lineGuideStops.horizontal.forEach((lineGuide) => {
    itemBounds.horizontal.forEach((itemBound) => {
      const diff = Math.abs(lineGuide - itemBound.guide);
      if (diff < GUIDELINE_OFFSET) {
        resultH.push({
          lineGuide,
          diff,
          orientation: 'H',
          snap: itemBound.snap,
        });
      }
    });
  });

  const guides: SnapLine[] = [];
  const minV: SnapLine = resultV.sort((a, b) => a.diff - b.diff)[0];
  const minH: SnapLine = resultH.sort((a, b) => a.diff - b.diff)[0];

  if (minV) guides.push(minV);
  if (minH) guides.push(minH);

  return guides;
}

