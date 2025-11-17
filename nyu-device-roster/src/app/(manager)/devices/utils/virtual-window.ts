export type VirtualWindowConfig = {
  total: number;
  rowHeight: number;
  viewportHeight: number;
  scrollTop: number;
  overscan?: number;
};

export type VirtualWindowResult = {
  startIndex: number;
  endIndex: number;
  offsetTop: number;
  visibleCount: number;
};

export const calculateVirtualWindow = ({
  total,
  rowHeight,
  viewportHeight,
  scrollTop,
  overscan = 4,
}: VirtualWindowConfig): VirtualWindowResult => {
  if (total === 0 || viewportHeight <= 0) {
    return {
      startIndex: 0,
      endIndex: 0,
      offsetTop: 0,
      visibleCount: 0,
    };
  }

  const baseIndex = Math.floor(scrollTop / rowHeight);
  const visible = Math.ceil(viewportHeight / rowHeight);
  const startIndex = Math.max(0, baseIndex - overscan);
  const endIndex = Math.min(total, baseIndex + visible + overscan);

  return {
    startIndex,
    endIndex,
    offsetTop: startIndex * rowHeight,
    visibleCount: endIndex - startIndex,
  };
};

export const clampIndex = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) {
    return min;
  }
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
};
