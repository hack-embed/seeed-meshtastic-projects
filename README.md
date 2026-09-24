# Mesh Lab

An English-language community project collection for Seeed Mesh hardware. Built with static HTML, CSS, and JavaScript. No frontend build or server is required.

**Website:** https://hack-embed.github.io/seeed-meshtastic-projects/

## Run locally

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory docs
```

Open http://127.0.0.1:8765/. The site has Home, Projects, Community Activities, Submit a Project, and Contact Us routes. Existing `#projects` links remain valid. Individual projects have shareable `?project=ID#projects` URLs.

## Checks

```sh
npm ci
npm run validate
npm test
npx playwright test
```

The browser suite covers combined filters, empty states, sorting, persistence, modal deep links, form validation, private email exclusion, unsafe text rendering, fetch retry, and desktop/mobile layouts. On macOS it uses installed Chrome. Elsewhere, install Playwright Chromium and omit `executablePath` in `playwright.config.js`.

## Submission and AE approval

1. A maker fills the website form and continues to GitHub, or signs into GitHub and fills the native Issue Form. GitHub sign-in is required to create the issue. The website itself does not authenticate users or collect GitHub credentials.
2. The form creates a **public issue**, not a published project. Long submissions use a copy-and-paste fallback when they exceed a safe URL length. Cover images can be supplied as HTTPS URLs or uploaded in GitHub's native form.
3. AE checks the content, author attribution, hardware, image permission, setup instructions, and links. Reviewers must have repository write/maintain/admin permission. Optionally set the repository Actions variable `AE_REVIEWERS` to a comma-separated list of authorized GitHub logins; when set, only those maintainers can approve.
4. AE adds the `ae-approved` label. `Review and update project catalog` parses and validates the issue, writes `docs/data/projects.json`, and commits the result to `main`.
5. `Deploy Mesh Lab` runs when the catalog workflow succeeds and publishes the current `main` version. A failed review/validation run does not deploy. Editing an approved issue does **not** republish it automatically; AE must remove and re-add `ae-approved` after reviewing the changes.
6. Approved L2 activity social links are collected in `docs/data/activity-social-links.json` for marketing. No messages are sent automatically.

Create the repository labels `ae-approved` and `project-discussion` before use. Branch rules must allow the GitHub Actions bot to commit catalog updates. Do not give ordinary submitters write access just to use the form.

### Email privacy

The optional email field is not sent to GitHub, included in the public catalog, or stored in browser storage. The form offers a `mailto:sensecap@seeed.cc` draft containing the contact email and project title, which the maker can send privately with the submission URL. No private email database or automatic reward-contact collection is provided.

## Likes, comments, and shares

- The card's Like button toggles a heart stored in the current browser (`meshlab-likes`). It is not an authenticated global vote. The UI explicitly explains the scope.
- Public hearts and comment counts come from a linked GitHub issue. The display combines public GitHub hearts with the current browser's heart; a user who also reacts on GitHub can contribute to both. Most Liked sorts by this displayed total.
- An approved community submission automatically uses its submission issue for comments and public GitHub heart reactions.
- For imported projects without an issue, Comments opens a prefilled GitHub discussion issue containing `<!-- mesh-lab-project: PROJECT_ID -->`. A maintainer links it by adding `project-discussion`. Reuse the linked issue for subsequent discussion. No public discussions or comments were fabricated during catalog import.
- GitHub counts refresh on comments, supported label events, manual dispatch, and the hourly workflow schedule. They are snapshots, not live totals. The first linked discussion per project is canonical; avoid labeling duplicates.
- Share opens the system share sheet or copies the project URL. Its count reflects successful shares/copies in this browser only. Canceled/failed shares are not counted.
- Cross-device authenticated likes, inline comments, global share counts, and private automatic email storage require a backend or third-party service. They are not implemented by this static deployment.

## Content maintenance

`docs/config.js` defines the categories, product filter groups, activity IDs, and repository URL. Keep the GitHub issue form taxonomy in `.github/ISSUE_TEMPLATE/project.yml` synchronized; a test enforces this. L1 and L1 E-ink share a product filter group; `devices` preserves specific hardware details.

`docs/data/projects.json` stores:

| Field | Purpose |
| --- | --- |
| `id`, `title`, `description`, `author` | Stable project identity and English copy |
| `categories`, `products` | Multi-select filters from the configured taxonomy |
| `devices`, `tags` | Actual hardware details and search terms |
| `image`, `url`, `source` | HTTPS cover image, primary project, optional source |
| `addedAt` | Date added to this collection, not an invented original publication date |
| `setup`, `resources` | Setup steps and labeled resource URLs |
| `activity` | Optional configured activity ID, otherwise `null` |
| `issueNumber`, `socialLinks` | Optional approved submission and public social links |

The 15 curated entries include all 10 enclosure projects from the supplied Wio Tracker L1 Wiki, EasySkyMesh, MeshCore Open image transmission, and the three existing AI projects. Summaries retain source attribution. Catalog dates denote this collection's import date. Images load from their original public sources and have a local fallback if unavailable.

## L2 Pro activity

`docs/l2.html` is the dedicated dark activity page. Home, Project Hub, and Community Activities link to it. It includes build/share rewards, platform milestones, illustrated participation steps, build ideas, documentation, FAQ, and a decorative interactive mesh background. Motion can be paused and automatically stops for reduced-motion preferences or while the hero/tab is hidden.

The activity's Submit a Project buttons open the shared form from `docs/partials/project-form.html`, initialized by `docs/project-form.js`. Wio Tracker L2 Pro and its activity are preselected. Optional public GitHub repository import reads the description and detected license without overwriting fields already filled out. No access token is requested or stored.

Submit Your Link opens a separate social reward review form. It checks supported post domains, post-shaped URLs, and the stated milestone before preparing a GitHub issue. Actual project ownership, approval status, organic metrics, eligibility, and reward fulfillment require human review. The site does not claim to verify these automatically or issue rewards. Review these submissions as separate issues; the existing project catalog approval label must only be used for project submissions.

Purchase buttons are deliberately disabled with Coming Soon text, as requested. Set `purchaseUrl` in `docs/l2-config.js` to enable both buttons. The activity Wiki and contact email are configured there. No deadline, coupon expiration, dispatch time, or merchandise contents have been invented.

The local product cutout `docs/assets/l2-pro.webp` was cropped from the official Seeed Wiki photo at `https://files.seeedstudio.com/wiki/SenseCAP/Wio_Tracker_L2/L2First.png`. Concept panels are labeled as ideas; they do not imply those apps run on the pictured device. Step illustrations are original SVG line art.

## GitHub Pages

In Settings → Pages, choose **GitHub Actions** as the source. The `Deploy Mesh Lab` workflow uploads `docs` directly. It runs on changes to `main`, successful catalog workflow runs, and manual dispatch. The `workflow_run` trigger is necessary because commits made by `GITHUB_TOKEN` do not trigger ordinary push workflows. A custom domain is optional.

All original projects, images, and trademarks belong to their creators. This site is an independent index; check the original resources for licenses and complete instructions.
