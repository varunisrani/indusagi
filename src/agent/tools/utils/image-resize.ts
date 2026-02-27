/**
 * Image resize utilities for the read tool.
 * This is a simplified version that handles basic image operations.
 */

import type { ImageContent } from "../../../ai/index.js";

export interface ImageResizeOptions {
	maxWidth?: number; // Default: 2000
	maxHeight?: number; // Default: 2000
	maxBytes?: number; // Default: 4.5MB (below Anthropic's 5MB limit)
	jpegQuality?: number; // Default: 80
	algorithm?: "nearest" | "bilinear" | "lanczos";
}

export interface ResizedImage {
	data: string; // base64
	mimeType: string;
	originalWidth: number;
	originalHeight: number;
	width: number;
	height: number;
	wasResized: boolean;
}

// 4.5MB - provides headroom below Anthropic's 5MB limit
const DEFAULT_MAX_BYTES = 4.5 * 1024 * 1024;

const DEFAULT_OPTIONS: Required<ImageResizeOptions> = {
	maxWidth: 2000,
	maxHeight: 2000,
	maxBytes: DEFAULT_MAX_BYTES,
	jpegQuality: 80,
	algorithm: "lanczos",
};

/**
 * Resize an image to fit within specified max dimensions and file size.
 * This is a simplified version that returns the original image unchanged.
 * Full image processing requires @silvia-odwyer/photon-node.
 */
export async function resizeImage(img: ImageContent, options?: ImageResizeOptions): Promise<ResizedImage> {
	const resolved = { ...DEFAULT_OPTIONS, ...(options ?? {}) };
	if (resolved.jpegQuality < 1 || resolved.jpegQuality > 100) {
		throw new Error("jpegQuality must be between 1 and 100");
	}
	// Note: Full image resize functionality requires photon-node
	// For now, return the image unchanged
	return {
		data: img.data,
		mimeType: img.mimeType,
		originalWidth: 0,
		originalHeight: 0,
		width: 0,
		height: 0,
		wasResized: false,
	};
}

/**
 * Format a dimension note for resized images.
 * This helps the model understand coordinate mapping.
 */
export function formatDimensionNote(result: ResizedImage): string | undefined {
	if (!result.wasResized) {
		return undefined;
	}

	const scale = result.originalWidth / result.width;
	return `[Image: original ${result.originalWidth}x${result.originalHeight}, displayed at ${result.width}x${result.height}. Multiply coordinates by ${scale.toFixed(2)} to map to original image.]`;
}
