/**
 * vault.js — Chiffrement symétrique AES-256-GCM
 *
 * Clé : variable d'environnement VAULT_ENCRYPTION_KEY
 *   - 64 caractères hexadécimaux = 32 octets = 256 bits
 *   - Génération : node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Format stocké : "<iv_b64>:<authTag_b64>:<ciphertext_b64>"
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES   = 12;   // 96 bits — recommandé pour GCM
const TAG_BYTES  = 16;   // 128 bits

const DEV_KEY = Buffer.from('cabinetavocatdevkey2026cabinetav', 'utf8').subarray(0, 32);

function getKey() {
  const raw = process.env.VAULT_ENCRYPTION_KEY;
  if (!raw || raw.trim() === '') {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(
        '[vault] AVERTISSEMENT : VAULT_ENCRYPTION_KEY non définie. ' +
        'Utilisation de la clé de développement — INSECURE EN PRODUCTION.',
      );
    }
    return DEV_KEY;
  }

  const hex = raw.trim();
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('[vault] VAULT_ENCRYPTION_KEY doit contenir exactement 64 caractères hexadécimaux (32 octets).');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Chiffre une chaîne UTF-8 et retourne le token stocké en base.
 * @param {string} plaintext
 * @returns {string}
 */
export function encrypt(plaintext) {
  if (typeof plaintext !== 'string') {
    throw new TypeError('[vault] encrypt() attend une chaîne de caractères.');
  }
  const key  = getKey();
  const iv   = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag   = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * Déchiffre un token produit par encrypt().
 * @param {string} token
 * @returns {string}
 */
export function decrypt(token) {
  if (typeof token !== 'string') {
    throw new TypeError('[vault] decrypt() attend une chaîne de caractères.');
  }
  const parts = token.split(':');
  if (parts.length !== 3) {
    throw new Error('[vault] Format de token chiffré invalide — attendu "iv:tag:ciphertext".');
  }

  const [ivB64, tagB64, encB64] = parts;
  const key      = getKey();
  const iv       = Buffer.from(ivB64,  'base64');
  const authTag  = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(encB64, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
