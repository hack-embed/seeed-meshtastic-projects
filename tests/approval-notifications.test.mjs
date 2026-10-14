import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { approvalContactAvailable, encryptApprovalContact } from '../docs/notification-contact.js';
import { ACTIVITIES, CATEGORIES, PRODUCTS } from '../docs/config.js';
import { issueDraft } from '../docs/form-utils.js';
import { parseSubmission } from '../scripts/catalog.mjs';
import { savePrivateContact } from '../scripts/read-private-contact.mjs';
import { approvalMessage, createResendSender, decryptApprovalContact, notifyApprovedProject, privateContactFromIssue, SAFE_RETRY_MS } from '../scripts/approval-notifications.mjs';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const config = { enabled: true, keyId: 'test-approval', publicKeyPem: publicKey };
const identity = { title: 'A working mesh build', author: 'Test maker' };
const recipient = 'private-maker@example.com';
const issueBase = {
  number: 42, labels: [{ name: 'ae-approved' }],
  body: `### Project Title\n\n${identity.title}\n\n### Author / Maker\n\n${identity.author}\n\n### Project Description\n\nA working project with setup instructions.\n\n### Project Cover Image\n\nhttps://example.com/photo.png\n\n### Hardware\n\nWio Tracker L1 Pro\n\n### Category\n\nHardware\n\n### Resources & Links\n\nhttps://example.com/build\n\n### Related Activity\n\nNo related activity\n\n### Attribution\n\n- [x] I have credited the original maker and have permission to share this content and its images.\n`,
};

async function setup(options = {}) {
  const token = await encryptApprovalContact(recipient, identity, config);
  const issue = structuredClone(issueBase);
  if (options.contact !== false) issue.body += `\n### Private Approval Contact\n\n${token}\n`;
  const project = parseSubmission(issue, '2026-10-14');
  const writes = [], sent = [];
  let state;
  let date = new Date('2026-10-14T10:00:00Z');
  const args = {
    project, issue, repository: 'example/mesh-lab', privateKey, keyId: config.keyId, siteUrl: 'https://example.github.io/mesh-lab/',
    readState: async () => state,
    writeState: async (_number, value) => { state = structuredClone(value); writes.push(structuredClone(value)); },
    send: async payload => { sent.push(payload); return 'test-delivery-id'; },
    now: () => date,
  };
  return { args, token, project, issue, writes, sent, getState: () => state, setDate: value => { date = value; } };
}

test('browser hybrid encryption decrypts in Actions and keeps contact out of public project data', async () => {
  const fixture = await setup();
  assert(!fixture.issue.body.includes(recipient));
  assert(!JSON.stringify(fixture.project).includes(recipient));
  assert.equal(privateContactFromIssue(fixture.issue), fixture.token);
  assert.equal(decryptApprovalContact(fixture.token, fixture.project, { privateKey, keyId: config.keyId }), recipient);
  assert(approvalContactAvailable(config));
  assert(!approvalContactAvailable({ ...config, enabled: false }));
  await assert.rejects(encryptApprovalContact(recipient, identity, { ...config, enabled: false }), /not configured/);
});

test('tampered ciphertext, mismatched project, duplicate fields, and incorrect key IDs fail closed', async () => {
  const { token, project, issue } = await setup();
  const envelope = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  envelope.data = Buffer.from('tampered content, no valid authentication tag').toString('base64url');
  const tampered = `mesh-contact-v1.${Buffer.from(JSON.stringify(envelope)).toString('base64url')}`;
  const decrypt = (value, candidate = project, keyId = config.keyId) => decryptApprovalContact(value, candidate, { privateKey, keyId });
  assert.throws(() => decrypt(tampered), /INVALID_PRIVATE_CONTACT/);
  assert.throws(() => decrypt(token, { ...project, title: 'Someone else’s project' }), /PROJECT_MISMATCH/);
  assert.throws(() => decrypt(token, project, 'wrong-key'), /KEY_MISMATCH/);
  assert.throws(() => privateContactFromIssue({ ...issue, body: issue.body + '\n### Private Approval Contact\n\nagain' }), /INVALID_PRIVATE_CONTACT/);
});

test('approval email persists a reservation before sending and skips successful reruns', async () => {
  const fixture = await setup();
  fixture.args.send = async payload => {
    assert.equal(fixture.getState().status, 'pending');
    fixture.sent.push(payload); return 'test-delivery-id';
  };
  assert.equal((await notifyApprovedProject(fixture.args)).status, 'sent');
  assert.equal((await notifyApprovedProject(fixture.args)).status, 'already-sent');
  assert.equal(fixture.sent.length, 1);
  assert.deepEqual(fixture.writes.map(state => state.status), ['pending', 'sent']);
  assert(!JSON.stringify(fixture.writes).includes(recipient));
  assert(fixture.sent[0].text.includes('?project=community-42#projects'));
});
test('approved records without the new optional image description remain eligible', async () => {
  const fixture = await setup();
  delete fixture.project.imageAlt;
  assert.equal((await notifyApprovedProject(fixture.args)).status, 'sent');
});

test('catalog validation, published identity, approval label, and private contact are required', async () => {
  for (const mutation of [
    fixture => { fixture.issue.labels = []; },
    fixture => { fixture.issue.pull_request = {}; },
    fixture => { fixture.issue.number = 99; },
  ]) {
    const fixture = await setup(); mutation(fixture);
    assert.equal((await notifyApprovedProject(fixture.args)).status, 'ineligible');
    assert.equal(fixture.sent.length, 0);
  }
  const edited = await setup(); edited.issue.body = edited.issue.body.replace(identity.title, 'Edited after review');
  await assert.rejects(notifyApprovedProject(edited.args), /CHANGED_SINCE_APPROVAL/);
  const invalid = await setup(); invalid.issue.body = invalid.issue.body.replace('https://example.com/photo.png', 'javascript:alert(1)');
  await assert.rejects(notifyApprovedProject(invalid.args), /SUBMISSION_INVALID/);
  const noContact = await setup({ contact: false });
  assert.equal((await notifyApprovedProject(noContact.args)).status, 'no-contact');
  for (const fixture of [edited, invalid, noContact]) assert.equal(fixture.sent.length, 0);
});

test('failed durable reservation prevents any email attempt', async () => {
  const fixture = await setup();
  fixture.args.writeState = async () => { throw new Error('simulated storage outage'); };
  await assert.rejects(notifyApprovedProject(fixture.args), /storage outage/);
  assert.equal(fixture.sent.length, 0);
});

test('ambiguous delivery retries use one idempotency key, then stop before provider expiry', async () => {
  const fixture = await setup();
  const keys = [];
  fixture.args.send = async payload => { keys.push(payload.idempotencyKey); throw new Error('simulated timeout'); };
  await assert.rejects(notifyApprovedProject(fixture.args), /timeout/);
  fixture.setDate(new Date('2026-10-14T11:00:00Z'));
  await assert.rejects(notifyApprovedProject(fixture.args), /timeout/);
  assert.equal(new Set(keys).size, 1);
  fixture.setDate(new Date(new Date('2026-10-14T10:00:00Z').getTime() + SAFE_RETRY_MS));
  await assert.rejects(notifyApprovedProject(fixture.args), /REQUIRES_RECONCILIATION/);
  assert.equal(keys.length, 2);
});

test('delivery acknowledged before ledger failure is safely retried with the same payload', async () => {
  const fixture = await setup();
  const persist = fixture.args.writeState;
  fixture.args.writeState = async (number, value) => { if (value.status === 'sent') throw new Error('simulated post-send storage failure'); await persist(number, value); };
  await assert.rejects(notifyApprovedProject(fixture.args), /post-send storage failure/);
  fixture.args.writeState = persist;
  assert.equal((await notifyApprovedProject(fixture.args)).status, 'sent');
  assert.deepEqual(fixture.sent[0], fixture.sent[1]);
});

test('pending payload or contact changes require reconciliation instead of sending twice', async () => {
  const fixture = await setup();
  fixture.args.send = async () => { throw new Error('timeout'); };
  await assert.rejects(notifyApprovedProject(fixture.args));
  fixture.args.siteUrl = 'https://example.github.io/new-path/';
  await assert.rejects(notifyApprovedProject(fixture.args), /REQUIRES_RECONCILIATION/);
  fixture.args.siteUrl = 'https://example.github.io/mesh-lab/';
  fixture.args.senderIdentity = 'new-sender@example.com';
  await assert.rejects(notifyApprovedProject(fixture.args), /REQUIRES_RECONCILIATION/);
  fixture.args.senderIdentity = '';
  const replacement = await encryptApprovalContact('another@example.com', identity, config);
  fixture.issue.body = fixture.issue.body.replace(fixture.token, replacement);
  await assert.rejects(notifyApprovedProject(fixture.args), /REQUIRES_RECONCILIATION/);
});

test('full website field limits leave room for encrypted contact under the approval parser limit', async () => {
  const identity = { title: 'T'.repeat(120), author: 'A'.repeat(100) };
  const token = await encryptApprovalContact(recipient, identity, config);
  const longUrl = length => 'https://example.com/' + 'p'.repeat(length - 20);
  const fields = {
    'Project Title': identity.title, 'Author / Maker': identity.author, 'Project Description': 'D'.repeat(3000),
    'Project Cover Image': longUrl(1500), 'Cover Image Description': 'C'.repeat(200),
    'Hardware': PRODUCTS.join(', '), 'Category': CATEGORIES.join(', '), 'Setup Instructions': 'S'.repeat(6000),
    'Resources & Links': longUrl(3000), 'Social Links': longUrl(2000),
    'Related Activity': ACTIVITIES.find(activity => activity.id === 'l2-pro').title,
    'Attribution': '- [x] I have credited the original maker and have permission to share this content and its images.',
    'Private Approval Contact': token,
  };
  const draft = issueDraft('[Project] ' + identity.title, fields);
  assert(draft.needsCopy);
  assert(draft.body.length < 24000, 'Leave at least 1 KB headroom for longer production keys.');
  const project = parseSubmission({ number: 42, body: draft.body });
  assert.equal(decryptApprovalContact(privateContactFromIssue({ body: draft.body }), project, { privateKey, keyId: config.keyId }), recipient);
  assert(!draft.body.includes(recipient));
});

test('reviewers can save encrypted social contact privately without overwriting files or writing into Git', async () => {
  const fixture = await setup();
  const directory = await mkdtemp(join(tmpdir(), 'mesh-private-contact-'));
  try {
    const repositoryRoot = join(directory, 'repo'); await mkdir(repositoryRoot);
    const outputPath = join(directory, 'contact.json');
    const issue = { number: 84, body: `### Approved Project Submission\n\nhttps://github.com/example/mesh-lab/issues/42\n\n### Private Approval Contact\n\n${fixture.token}\n` };
    const options = { issue, project: fixture.project, privateKey, keyId: config.keyId, repository: 'example/mesh-lab', repositoryRoot, outputPath };
    await savePrivateContact(options);
    assert.equal(JSON.parse(await readFile(outputPath, 'utf8')).email, recipient);
    assert.equal((await stat(outputPath)).mode & 0o777, 0o600);
    await assert.rejects(savePrivateContact(options), /PRIVATE_OUTPUT_WRITE_FAILED/);
    await assert.rejects(savePrivateContact({ ...options, outputPath: join(repositoryRoot, 'contact.json') }), /OUTSIDE_REPOSITORY/);
    await assert.rejects(savePrivateContact({ ...options, issue: { ...issue, body: issue.body.replace('/issues/42', '/issues/99') }, outputPath: join(directory, 'invalid.json') }), /INVALID_SUBMISSION_REFERENCE/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('L2 approved email includes optional social submission and current coupon terms', () => {
  const base = { id: 'community-42', title: identity.title, activity: null };
  assert(!approvalMessage(base, 'https://example.com/').text.includes('#submit-social'));
  const message = approvalMessage({ ...base, activity: 'l2-pro' }, 'https://example.com/mesh-lab/');
  assert(message.text.includes('https://example.com/mesh-lab/l2.html#submit-social'));
  assert(message.text.includes('excluding shipping and XIAO development kits'));
  assert(message.text.includes('Social sharing is optional'));
  assert.throws(() => approvalMessage(base, 'javascript:alert(1)'), /INVALID_SITE_URL/);
});

test('mail provider receives private address and idempotency header, without leaking failure details', async () => {
  let request;
  const sender = createResendSender({ apiKey: 'test-only-key', from: 'Mesh Lab <hello@example.com>', fetchImpl: async (url, options) => { request = { url, ...options }; return new Response('{"id":"delivery-123"}', { status: 200 }); } });
  assert.equal(await sender({ to: recipient, subject: 'Approved', text: 'Project approved.', idempotencyKey: 'one-project' }), 'delivery-123');
  assert.equal(request.url, 'https://api.resend.com/emails');
  assert.equal(request.headers['Idempotency-Key'], 'one-project');
  assert.deepEqual(JSON.parse(request.body).to, [recipient]);
  const failing = createResendSender({ apiKey: 'test-only-key', from: 'hello@example.com', fetchImpl: async () => new Response(`Recipient ${recipient} rejected`, { status: 503 }) });
  await assert.rejects(failing({ to: recipient }), error => error.message === 'MAIL_PROVIDER_HTTP_503' && !error.message.includes(recipient));
});
