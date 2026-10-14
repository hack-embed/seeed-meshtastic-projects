import { APPROVAL_EMAIL_CONFIG } from './notification-config.js';

export const CONTACT_PREFIX = 'mesh-contact-v1.';
const encoder = new TextEncoder();
const base64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function approvalContactAvailable(config = APPROVAL_EMAIL_CONFIG) {
  return Boolean(config.enabled && /^[\w-]{1,64}$/.test(config.keyId) &&
    /^-----BEGIN PUBLIC KEY-----[\s\S]+-----END PUBLIC KEY-----\s*$/.test(config.publicKeyPem) &&
    globalThis.crypto?.subtle);
}

// Bind private contact to the submitted project without publishing the address.
export async function encryptApprovalContact(email, { title, author }, config = APPROVAL_EMAIL_CONFIG) {
  email = email.trim();
  if (!email) return '';
  if (!approvalContactAvailable(config)) throw new Error('Automatic approval email is not configured.');
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw new Error('Enter a valid email address.');
  if (typeof title !== 'string' || typeof author !== 'string' || !title.trim() || !author.trim()) throw new Error('Add a project title and author before saving your contact.');
  try {
    const pem = config.publicKeyPem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, '');
    const publicKey = await crypto.subtle.importKey('spki', Uint8Array.from(atob(pem), char => char.charCodeAt(0)), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
    if (publicKey.algorithm.modulusLength < 2048) throw new Error('Key is too short');
    const binding = base64url(await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify([title.trim(), author.trim()]))));
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(`mesh-lab-approval-contact:v1:${config.keyId}`) }, key, encoder.encode(JSON.stringify({ email, binding })));
    const wrappedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, await crypto.subtle.exportKey('raw', key));
    return CONTACT_PREFIX + base64url(encoder.encode(JSON.stringify({ keyId: config.keyId, iv: base64url(iv), key: base64url(wrappedKey), data: base64url(ciphertext) })));
  } catch {
    throw new Error('Your email could not be encrypted. Please try again or contact the team privately.');
  }
}
