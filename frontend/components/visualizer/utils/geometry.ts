import { Position } from '../types';

export const BASE_SLOT_DIRECTIONS: Array<{ x: number; y: number }> = [
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: 1, y: 1 }
];

export function getOffsetForIndex(index: number): Position {
  const dir = BASE_SLOT_DIRECTIONS[index % BASE_SLOT_DIRECTIONS.length];
  const radius = Math.floor(index / BASE_SLOT_DIRECTIONS.length) + 1;
  return { x: dir.x * radius, y: dir.y * radius };
}

export function sanitizeModulePath(raw: string): string {
  return raw
    .replace(/^from\s+/i, '')
    .replace(/\s+import.+$/i, '')
    .replace(/\.py$/i, '')
    .replace(/[\\/]+/g, '.')
    .replace(/\.+/g, '.')
    .replace(/\s+/g, '')
    .toLowerCase();
}

export function moduleKeyFromPath(filePath: string): string {
  return sanitizeModulePath(
    filePath
      .replace(/\.py$/i, '')
      .replace(/[\\/]+/g, '.')
  );
}

export function computeEdgeOffset(index: number, step = 18): number {
  if (index === 0) {
    return 0;
  }
  const magnitude = Math.ceil(index / 2) * step;
  return index % 2 === 1 ? magnitude : -magnitude;
}

export function createConnectionPath(from: Position, to: Position, offset: number = 0): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const absDx = Math.abs(dx);

  const angle = Math.atan2(dy, dx);
  const perpendicularAngle = angle + Math.PI / 2;
  const offsetX = Math.cos(perpendicularAngle) * offset;
  const offsetY = Math.sin(perpendicularAngle) * offset;

  const startX = from.x + offsetX;
  const startY = from.y + offsetY;
  const endX = to.x + offsetX;
  const endY = to.y + offsetY;

  if (absDx < 50) {
    return `M ${startX} ${startY} L ${endX} ${endY}`;
  }

  const controlDistance = Math.min(absDx * 0.5, 240);
  const controlX1 = startX + (dx > 0 ? controlDistance : -controlDistance);
  const controlX2 = endX - (dx > 0 ? controlDistance : -controlDistance);

  return `M ${startX} ${startY} C ${controlX1} ${startY}, ${controlX2} ${endY}, ${endX} ${endY}`;
}

export function getMidPoint(from: Position, to: Position): Position {
  return {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2
  };
}
