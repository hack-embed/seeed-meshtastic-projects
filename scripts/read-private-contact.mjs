import { readFile, realpath, open } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { APPROVAL_EMAIL_CONFIG } from '../docs/notification-config.js';
import { REPO } from '../docs/config.js';
import { validateProject } from './catalog.mjs';
import { decryptApprovalContact, NotificationError, privateContactFromIssue } from './approval-notifications.mjs';

const checkout = fileURLToPath(new URL('..', import.meta.url));
const inside = (root, path) => { const rel = relative(root, path); return rel === '' || rel !== '..' && !rel.startsWith(`..${sep}`) && !rel.startsWith(sep); };

// Local reviewer utility: writes recipient data to a new private file, never stdout or an Actions log.
export async function savePrivateContact({ issue, project, privateKey, keyId, outputPath, repository = REPO, repositoryRoot = checkout }) {
  try { validateProject(project); } catch { throw new NotificationError('INVALID_PROJECT'); }
  if (!Number.isSafeInteger(project.issueNumber) || !Number.isSafeInteger(issue.number) || issue.pull_request) throw new NotificationError('INVALID_SUBMISSION_REFERENCE');
  if (issue.number !== project.issueNumber) {
    const fields = (issue.body || '').replace(/\r\n/g, '\n').split(/^### /m).slice(1).filter(chunk => chunk.split('\n', 1)[0].trim() === 'Approved Project Submission');
    if (fields.length !== 1 || fields[0].slice(fields[0].indexOf('\n') + 1).trim() !== `https://github.com/${repository}/issues/${project.issueNumber}`) throw new NotificationError('INVALID_SUBMISSION_REFERENCE');
  }
  const token = privateContactFromIssue(issue);
  if (!token) throw new NotificationError('NO_PRIVATE_CONTACT');
  const email = decryptApprovalContact(token, project, { privateKey, keyId });
  let parent, root;
  try { [parent, root] = await Promise.all([realpath(dirname(resolve(outputPath))), realpath(repositoryRoot)]); }
  catch { throw new NotificationError('INVALID_PRIVATE_OUTPUT_PATH'); }
  if (inside(root, parent)) throw new NotificationError('PRIVATE_OUTPUT_MUST_BE_OUTSIDE_REPOSITORY');
  let file;
  try {
    file = await open(outputPath, 'wx', 0o600);
    await file.writeFile(JSON.stringify({ projectId: project.id, projectTitle: project.title, submissionIssue: issue.number, email }, null, 2) + '\n');
  } catch { throw new NotificationError('PRIVATE_OUTPUT_WRITE_FAILED'); }
  finally { await file?.close(); }
}

async function main() {
  const args = process.argv.slice(2), options = {};
  if (args.length !== 8) throw new NotificationError('USAGE: --issue issue.json --project community-N --private-key private.pem --out contact.json');
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    if (!['--issue', '--project', '--private-key', '--out'].includes(key) || options[key]) throw new NotificationError('INVALID_ARGUMENTS');
    options[key] = args[index + 1];
  }
  const projects = JSON.parse(await readFile(new URL('../docs/data/projects.json', import.meta.url), 'utf8'));
  const project = projects.find(project => project.id === options['--project']);
  if (!project) throw new NotificationError('PROJECT_NOT_IN_APPROVED_CATALOG');
  await savePrivateContact({ issue: JSON.parse(await readFile(options['--issue'], 'utf8')), project, privateKey: await readFile(options['--private-key'], 'utf8'), keyId: APPROVAL_EMAIL_CONFIG.keyId, outputPath: options['--out'] });
  console.log('Contact saved to the requested private file. Remove that local file after the reward follow-up.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error instanceof NotificationError ? error.code : 'PRIVATE_CONTACT_READ_FAILED'); process.exitCode = 1; });
}
