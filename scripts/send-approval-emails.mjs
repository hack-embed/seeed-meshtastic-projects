import { readFile } from 'node:fs/promises';
import { createPrivateKey, createPublicKey } from 'node:crypto';
import { APPROVAL_EMAIL_CONFIG } from '../docs/notification-config.js';
import { validateCatalog } from './catalog.mjs';
import { NotificationError, createResendSender, notifyApprovedProject } from './approval-notifications.mjs';

const STATE_PATH = '.github/data/approval-notifications.json';
const env = process.env;
async function main() {
  if (!APPROVAL_EMAIL_CONFIG.enabled) {
    console.log('Automatic approval emails are disabled. Follow APPROVAL_EMAIL_SETUP.md to enable them.');
    return;
  }
  const repository = env.GITHUB_REPOSITORY;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '') || !env.GH_TOKEN) throw new NotificationError('INVALID_GITHUB_CONFIGURATION');
  for (const name of ['APPROVAL_EMAIL_PRIVATE_KEY', 'RESEND_API_KEY', 'APPROVAL_EMAIL_FROM', 'MESH_LAB_SITE_URL']) {
    if (!env[name]) throw new NotificationError(`MISSING_${name}`);
  }
  try {
    const publicPem = createPublicKey(createPrivateKey(env.APPROVAL_EMAIL_PRIVATE_KEY)).export({ type: 'spki', format: 'pem' }).trim();
    if (publicPem !== APPROVAL_EMAIL_CONFIG.publicKeyPem.trim()) throw new Error();
  } catch { throw new NotificationError('PRIVATE_KEY_DOES_NOT_MATCH_PUBLIC_CONFIGURATION'); }
  const branch = env.GITHUB_DEFAULT_BRANCH || 'main';
  if (!/^[\w./-]+$/.test(branch)) throw new NotificationError('INVALID_BRANCH');
  const api = async (path, options = {}) => {
    let response;
    try {
      response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
        ...options,
        headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(20000),
      });
    } catch { throw new NotificationError('GITHUB_UNAVAILABLE'); }
    if (response.status === 404 && options.allowMissing) return null;
    if (!response.ok) throw new NotificationError(`GITHUB_HTTP_${response.status}`);
    return response.json();
  };
  const projects = validateCatalog(JSON.parse(await readFile(new URL('../docs/data/projects.json', import.meta.url), 'utf8')));
  const stored = await api(`contents/${STATE_PATH}?ref=${encodeURIComponent(branch)}`, { allowMissing: true });
  let sha = stored?.sha;
  let ledger;
  try {
    ledger = stored ? JSON.parse(Buffer.from(stored.content, 'base64').toString('utf8')) : { version: 1, projects: {} };
    if (ledger.version !== 1 || !ledger.projects || Array.isArray(ledger.projects) || typeof ledger.projects !== 'object') throw new Error();
  } catch { throw new NotificationError('INVALID_NOTIFICATION_LEDGER'); }
  const writeState = async (number, state) => {
    const next = { ...ledger, projects: { ...ledger.projects, [number]: state } };
    const updated = await api(`contents/${STATE_PATH}`, {
      method: 'PUT',
      body: JSON.stringify({ message: `Record approval notification state for project #${number}`, content: Buffer.from(JSON.stringify(next, null, 2) + '\n').toString('base64'), branch, ...(sha ? { sha } : {}) }),
    });
    if (!updated.content?.sha) throw new NotificationError('INVALID_LEDGER_WRITE_RESPONSE');
    // Never change in-memory state until the write is durably acknowledged by GitHub.
    ledger = next; sha = updated.content.sha;
  };
  const send = createResendSender({ apiKey: env.RESEND_API_KEY, from: env.APPROVAL_EMAIL_FROM });
  let failed = 0;
  for (const project of projects.filter(project => project.issueNumber)) {
    try {
      const issue = await api(`issues/${project.issueNumber}`);
      const result = await notifyApprovedProject({
        project, issue, repository, privateKey: env.APPROVAL_EMAIL_PRIVATE_KEY, keyId: APPROVAL_EMAIL_CONFIG.keyId,
        siteUrl: env.MESH_LAB_SITE_URL, senderIdentity: env.APPROVAL_EMAIL_FROM, readState: async number => ledger.projects[number], writeState, send,
      });
      console.log(`Project #${project.issueNumber}: ${result.status}.`);
    } catch (error) {
      failed++;
      const code = error instanceof NotificationError ? error.code : 'NOTIFICATION_INTERNAL_ERROR';
      console.log(`::warning::Project #${project.issueNumber}: ${code}. See APPROVAL_EMAIL_SETUP.md.`);
    }
  }
  if (failed) throw new NotificationError(`NOTIFICATION_FAILURES_${failed}`);
}

main().catch(error => {
  console.error(error instanceof NotificationError ? error.code : 'NOTIFICATION_INTERNAL_ERROR');
  process.exitCode = 1;
});
