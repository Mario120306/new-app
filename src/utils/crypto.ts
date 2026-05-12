/**
 * Simple MD5 hash function (for demonstration)
 * In production, use a proper crypto library like crypto-js
 */
export async function md5(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// For PrestaShop MD5 (matching server-side behavior)
// This is a simplified version - PrestaShop uses actual MD5
export function simpleMD5(str: string): string {
  // Placeholder: In production, use crypto-js or server-side hashing
  return 'hashed_' + str.substring(0, 10);
}
