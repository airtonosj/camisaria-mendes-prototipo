export type ArtworkTransform = { x: number; y: number; scale: number; rotation: number };
export type ArtworkAsset = { url: string; transform: ArtworkTransform };
export type VariantArtwork = { front: ArtworkAsset | null; back: ArtworkAsset | null };
