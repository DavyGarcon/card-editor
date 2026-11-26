/**
 * Shared checkbox geometry, used by both the live Konva canvas and the
 * detached PNG/PDF renderer so previews and exports look identical.
 */
export interface CheckboxGeometry {
  boxSize: number;
  gap: number;
  labelWidth: number;
  checkPoints: number[];
}

export function getCheckboxGeometry(width: number, height: number): CheckboxGeometry {
  const gap = 8;
  const boxSize = Math.max(12, Math.min(height, width - gap, 28));
  return {
    boxSize,
    gap,
    labelWidth: Math.max(0, width - boxSize - gap),
    checkPoints: [
      boxSize * 0.22,
      boxSize * 0.5,
      boxSize * 0.43,
      boxSize * 0.72,
      boxSize * 0.8,
      boxSize * 0.25,
    ],
  };
}
