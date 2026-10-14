import { createDecipheriv, createHash, constants, privateDecrypt } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { parseSubmission } from './catalog.mjs';

const PREFIX = 'mesh-contact-v1.';
// Resend retains idempotency keys for 24 hours. Stop before expiry if delivery is ambiguous.
export const SAFE_RETRY_MS = 23 * 60 * 60 * 1000;
export class NotificationError extends Error {
  constructor(code) { super(code); this.name = 'NotificationError'; this.code = code; }
}
const fail = code => { throw new NotificationError(code); };
const hash = value => createHash('sha256').update(value).digest('base64url');
const decode = (value, min = 1, max = 4096) => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) fail('INVALID_PRIVATE_CONTACT');
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.length < min || bytes.length > max || bytes.toString('base64url') !== value) fail('INVALID_PRIVATE_CONTACT');
  return bytes;
};

export function privateContactFromIssue(issue) {
  const body = issue.body || '';
  if (body.length > 25000) fail('INVALID_PRIVATE_CONTACT');
  const fields = body.replace(/\r\n/g, '\n').split(/^### /m).slice(1).filter(chunk => chunk.split('\n', 1)[0].trim() === 'Private Approval Contact');
  if (!fields.length) return '';
  if (fields.length !== 1) fail('INVALID_PRIVATE_CONTACT');
  const token = fields[0].slice(fields[0].indexOf('\n') + 1).trim();
  return token === '_No response_' ? '' : token;
}

export function decryptApprovalContact(token, project, { privateKey, keyId }) {
  try {
    if (typeof token !== 'string' || !token.startsWith(PREFIX)) fail('INVALID_PRIVATE_CONTACT');
    const envelope = JSON.parse(decode(token.slice(PREFIX.length)).toString('utf8'));
    if (envelope.keyId !== keyId) fail('PRIVATE_CONTACT_KEY_MISMATCH');
    const key = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, decode(envelope.key, 256, 1024));
    if (key.length !== 32) fail('INVALID_PRIVATE_CONTACT');
    const encrypted = decode(envelope.data, 17, 2048);
    const decipher = createDecipheriv('aes-256-gcm', key, decode(envelope.iv, 12, 12));
    decipher.setAAD(Buffer.from(`mesh-lab-approval-contact:v1:${keyId}`));
    decipher.setAuthTag(encrypted.subarray(-16));
    const payload = JSON.parse(Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]).toString('utf8'));
    if (payload.binding !== hash(JSON.stringify([project.title.trim(), project.author.trim()]))) fail('PRIVATE_CONTACT_PROJECT_MISMATCH');
    if (typeof payload.email !== 'string' || payload.email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(payload.email)) fail('INVALID_PRIVATE_CONTACT');
    return payload.email;
  } catch (error) {
    if (error instanceof NotificationError) throw error;
    fail('INVALID_PRIVATE_CONTACT');
  }
}

export function approvalMessage(project, siteUrl) {
  const site = new URL(siteUrl);
  if (site.protocol !== 'https:' || site.username || site.password || site.search || site.hash) fail('INVALID_SITE_URL');
  if (!site.pathname.endsWith('/')) site.pathname += '/';
  const projectUrl = new URL(`?project=${encodeURIComponent(project.id)}#projects`, site).href;
  const title = project.title.replace(/[\r\n\u0000-\u001f\u007f]/g, ' ').slice(0, 120);
  let text = `Your project “${title}” has been approved and is now featured in Mesh Lab.\n\nView your project: ${projectUrl}\n\nThank you for sharing your build with the community.`;
  if (project.activity === 'l2-pro') {
    text += `\n\nYour approved, working L2 project qualifies for the Build Reward: a Seeed discount coupon for $15 off eligible orders of $50 or more, excluding shipping and XIAO development kits. The team will follow up with reward details.\n\nSocial sharing is optional. Didn’t include your social post link when submitting your project? Add it here: ${new URL('l2.html#submit-social', site).href}\n\nOnce your post reaches an eligible platform’s milestone, submit the link for Share Reward review. Each project can receive one merchandise pack.`;
  }
  return { subject: 'Your Mesh Lab project has been approved', text };
}

export function createResendSender({ apiKey, from, fetchImpl = fetch }) {
  if (!apiKey || !from || /[\r\n]/.test(from)) fail('INVALID_EMAIL_CONFIGURATION');
  return async ({ to, subject, text, idempotencyKey }) => {
    let response;
    try {
      response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ from, to: [to], subject, text }),
        signal: AbortSignal.timeout(20000),
      });
    } catch { fail('MAIL_PROVIDER_UNAVAILABLE'); }
    // Never include a provider response body in logs; it may contain the recipient.
    if (!response.ok) fail(`MAIL_PROVIDER_HTTP_${response.status}`);
    let result;
    try { result = await response.json(); } catch { fail('MAIL_PROVIDER_INVALID_RESPONSE'); }
    if (typeof result.id !== 'string' || !/^[A-Za-z0-9-]{1,100}$/.test(result.id)) fail('MAIL_PROVIDER_INVALID_RESPONSE');
    return result.id;
  };
}

// Storage MUST persist each transition before resolving. Only public IDs and delivery state are stored.
export async function notifyApprovedProject({ project, issue, repository, privateKey, keyId, siteUrl, senderIdentity = '', readState, writeState, send, now = () => new Date() }) {
  if (!Number.isSafeInteger(project.issueNumber) || project.issueNumber !== issue.number || issue.pull_request || !issue.labels?.some(label => label.name === 'ae-approved')) return { status: 'ineligible' };
  let current;
  try { current = parseSubmission(issue, project.addedAt); } catch { fail('SUBMISSION_INVALID'); }
  // Issue edits must be re-reviewed and published before their notification can be sent.
  if (!isDeepStrictEqual(current, { ...project, imageAlt: project.imageAlt ?? '' })) fail('SUBMISSION_CHANGED_SINCE_APPROVAL');
  const state = await readState(issue.number);
  if (state?.status === 'sent') return { status: 'already-sent' };
  const token = privateContactFromIssue(issue);
  if (!token) return { status: 'no-contact' };
  const to = decryptApprovalContact(token, project, { privateKey, keyId });
  const digest = hash(token);
  const message = approvalMessage(project, siteUrl);
  // Bind the provider's idempotency key to a stable payload across deploys and retries.
  const payloadDigest = hash(JSON.stringify({ from: senderIdentity, ...message }));
  const idempotencyKey = `mesh-approval-${hash(`${repository}:${issue.number}:v1`)}`;
  let pending = state;
  if (pending) {
    if (pending.status !== 'pending' || pending.contactDigest !== digest || pending.payloadDigest !== payloadDigest || pending.idempotencyKey !== idempotencyKey) fail('NOTIFICATION_REQUIRES_RECONCILIATION');
    const age = now().getTime() - Date.parse(pending.startedAt);
    if (!Number.isFinite(age) || age < 0 || age >= SAFE_RETRY_MS) fail('NOTIFICATION_REQUIRES_RECONCILIATION');
  } else {
    pending = { status: 'pending', startedAt: now().toISOString(), contactDigest: digest, payloadDigest, idempotencyKey };
    await writeState(issue.number, pending);
  }
  const providerId = await send({ to, ...message, idempotencyKey });
  await writeState(issue.number, { status: 'sent', sentAt: now().toISOString(), providerId });
  return { status: 'sent' };
}
