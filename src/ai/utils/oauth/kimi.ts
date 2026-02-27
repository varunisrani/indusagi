/**
 * Kimi (Moonshot AI) — API key authentication only.
 *
 * Kimi does NOT support OAuth. Use KIMI_API_KEY or MOONSHOT_API_KEY
 * environment variables, or pass the key directly via --api-key.
 *
 * Get your API key at:
 *   Standard Kimi:  https://www.moonshot.cn/
 *   Kimi Code:      https://www.kimi.com/code/en
 */

import type { OAuthCredentials } from "./types.js";

/**
 * Not a real OAuth login — Kimi uses API keys only.
 * Exported for completeness; callers should use getEnvApiKey("kimi") instead.
 * @throws Always — Kimi does not support OAuth.
 */
export async function loginKimi(): Promise<OAuthCredentials> {
	throw new Error(
		"Kimi does not support OAuth. Set KIMI_API_KEY or MOONSHOT_API_KEY in your environment, " +
			"or use `indusagi login --provider kimi` to enter your API key.",
	);
}

/**
 * Not applicable — Kimi uses API keys only, tokens do not expire.
 * @throws Always
 */
export async function refreshKimiToken(_refreshToken: string): Promise<OAuthCredentials> {
	throw new Error("Kimi does not support OAuth token refresh.");
}

export function isKimiApiKeyStyleCredential(credentials: OAuthCredentials): boolean {
	return !!credentials.access && credentials.access.length >= 12;
}
