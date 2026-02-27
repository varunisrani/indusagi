/**
 * MIME type detection utilities for the read tool.
 * This is a simplified version that handles basic MIME detection.
 */

import { open } from "node:fs/promises";

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const mimeCache = new Map<string, string | null>();

const FILE_TYPE_SNIFF_BYTES = 4100;

/**
 * Detect if a file is a supported image type by reading magic bytes.
 * This is a simplified version that checks common image signatures.
 */
export async function detectSupportedImageMimeTypeFromFile(filePath: string): Promise<string | null> {
	const cached = mimeCache.get(filePath);
	if (cached !== undefined) return cached;
	const fileHandle = await open(filePath, "r");
	try {
		const buffer = Buffer.alloc(FILE_TYPE_SNIFF_BYTES);
		const { bytesRead } = await fileHandle.read(buffer, 0, FILE_TYPE_SNIFF_BYTES, 0);
		if (bytesRead === 0) {
			return null;
		}

		// Check for common image signatures
		if (bytesRead >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
			mimeCache.set(filePath, "image/jpeg");
			return "image/jpeg";
		}
		if (bytesRead >= 8 && 
			buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && 
			buffer[3] === 0x47 && buffer[4] === 0x0d && buffer[5] === 0x0a && 
			buffer[6] === 0x1a && buffer[7] === 0x0a) {
			mimeCache.set(filePath, "image/png");
			return "image/png";
		}
		if (bytesRead >= 6 && 
			buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && 
			buffer[3] === 0x38 && 
			(buffer[4] === 0x37 || buffer[4] === 0x39) && buffer[5] === 0x61) {
			return "image/gif";
		}
		if (bytesRead >= 12 && 
			buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && 
			buffer[3] === 0x46 && buffer[8] === 0x57 && buffer[9] === 0x45 && 
			buffer[10] === 0x42 && buffer[11] === 0x50) {
			return "image/webp";
		}

		return null;
	} finally {
		await fileHandle.close();
	}
}
