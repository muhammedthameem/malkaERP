import CryptoJS from 'crypto-js';

const SECRET_KEY = 'MalkaERP_secure_link_key_2026';

/**
 * Encrypts an ID (like SALE-1234) into a URL-safe string.
 */
export const encryptId = (id) => {
  if (!id) return id;
  try {
    const encrypted = CryptoJS.AES.encrypt(String(id), SECRET_KEY).toString();
    // Make base64 URL safe
    return encrypted.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (error) {
    console.error("Encryption failed:", error);
    return id; // fallback
  }
};

/**
 * Decrypts a URL-safe string back to the original ID.
 * Falls back to returning the original string if decryption fails (for backward compatibility).
 */
export const decryptId = (encryptedId) => {
  if (!encryptedId) return encryptedId;
  try {
    // Revert URL safe base64
    let base64 = encryptedId.replace(/-/g, '+').replace(/_/g, '/');
    const padding = base64.length % 4;
    if (padding) {
      base64 += '='.repeat(4 - padding);
    }
    
    const bytes = CryptoJS.AES.decrypt(base64, SECRET_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    
    // If decryption succeeds and yields a value, return it.
    if (decrypted) {
      return decrypted;
    }
    
    // If it yields an empty string, it means the key was wrong or it wasn't encrypted
    return encryptedId;
  } catch (error) {
    // If it's not base64 or not AES encrypted, we assume it's an old plaintext ID.
    return encryptedId;
  }
};
