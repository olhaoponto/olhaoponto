export type WelcomeFrame = {
  width: number;
  height: number;
  left: number;
  top: number;
  scale: number;
};

export function calculateWelcomeFrame(
  viewportWidth: number,
  viewportHeight: number,
  assetWidth: number,
  assetHeight: number,
  referenceHeight = 844,
): WelcomeFrame {
  const safeViewportWidth = Math.max(0, viewportWidth);
  const safeViewportHeight = Math.max(0, viewportHeight);
  const assetRatio =
    assetWidth > 0 && assetHeight > 0 ? assetWidth / assetHeight : 1;
  const height = Math.min(safeViewportHeight, safeViewportWidth / assetRatio);
  const width = height * assetRatio;

  return {
    width,
    height,
    left: (safeViewportWidth - width) / 2,
    top: (safeViewportHeight - height) / 2,
    scale: referenceHeight > 0 ? height / referenceHeight : 1,
  };
}
