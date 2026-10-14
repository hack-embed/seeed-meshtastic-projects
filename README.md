# Mesh Lab

An English-language community project collection for Seeed Mesh hardware. The website uses static HTML, CSS, and JavaScript with no frontend build or application server. GitHub Actions handles reviewed catalog updates; optional approval emails use a configured mail provider.

**Website:** https://hack-embed.github.io/seeed-meshtastic-projects/

## Run locally

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory docs
```

Open http://127.0.0.1:8765/. Home, Projects, Community Activities, the submission form, and Contact Us are sections of one page. The submission form sits below Community Activities and starts collapsed. Contribute a project expands and scrolls to it; collapsing the form preserves the draft. It is not a navigation item. Existing `#projects` links and `?project=ID#projects` project links remain valid, and `#submit` links expand the same form. Learn More links directly to Seeed’s Mesh product page.

Social Media Links is a separate optional field directly below Resources & Links. It accepts public posts and demo videos for any project, whether or not an activity is selected. Approved links appear on the project's card; the separate L2 marketing export still includes only L2 activity submissions.

## Checks

```sh
npm ci
npm run validate
npm test
npx playwright test
```

The tests cover catalog approval, taxonomy and repository import, search matching, photo captions, private contact encryption and email retry behavior. The browser suite covers combined filters, empty states, sorting, persistence, submission deep links, collapsible forms, form validation, private email exclusion, unsafe text rendering, fetch retry, and desktop/mobile layouts. On macOS it uses installed Chrome. Elsewhere, install Playwright Chromium and omit `executablePath` in `playwright.config.js`.

## Submission and AE approval

1. A maker fills the website form and continues to GitHub, or signs into GitHub and fills the native Issue Form. GitHub sign-in is required to create the issue. The website itself does not authenticate users or collect GitHub credentials.
2. The form prepares a **public issue** for the maker to create on GitHub. Long submissions use a copy-and-paste fallback when they exceed a safe URL length. A cover can be a public HTTPS image or a locally selected photo with an optional one-sentence description. The local preview supports PNG, JPG, WebP, and GIF up to 10 MB / 40 megapixels. The maker uploads the selected photo in GitHub’s final step, using the copy-photo helper or GitHub’s attachment control; selecting it on this static site alone does not upload it. Unreplaced attachment placeholders fail approval validation.
3. AE checks the content, author attribution, hardware, image permission, setup instructions, and links. Reviewers must have repository write/maintain/admin permission. Optionally set the repository Actions variable `AE_REVIEWERS` to a comma-separated list of authorized GitHub logins; when set, only those maintainers can approve.
4. AE adds the `ae-approved` label. `Review and update project catalog` parses and validates the issue, writes `docs/data/projects.json`, and commits the result to `main`.
5. `Deploy Mesh Lab` runs when the catalog workflow succeeds and publishes the current `main` version. A failed review/validation run does not deploy. Editing an approved issue does **not** republish it automatically; AE must remove and re-add `ae-approved` after reviewing the changes.
6. Approved L2 activity social links are collected in `docs/data/activity-social-links.json` for marketing. When email service settings are enabled, the separate notification job sends an approval email to the project’s encrypted contact. L2 emails also link to the social reward submission form. Provider failures are reported without blocking deployment of the reviewed catalog.

Create the repository labels `ae-approved` and `project-discussion` before use. Branch rules must allow the GitHub Actions bot to commit catalog updates. Do not give ordinary submitters write access just to use the form.

The shared project form has a Clear form button. Clearing an L2 submission restores its preselected L2 hardware and activity. Public GitHub repository import reads repository metadata and the README to suggest title, maker, description, cover, hardware, category, setup steps, and links, keeping fields that the maker has already filled. Import uses public GitHub endpoints and never asks for a token or GitHub password.

### Email privacy and setup

Project email is optional; social reward contact email is required. With approval email configured, the browser encrypts the address using the public key in `docs/notification-config.js`. Only ciphertext goes into the public issue. Actions decrypts it using a private key secret and sends through Resend; the address never enters the catalog or browser storage. Successful deliveries are recorded without recipient data so reruns do not send duplicate approval emails.

**Email delivery is disabled until the team configures it.** Required settings are a verified Resend sender, `RESEND_API_KEY` and `APPROVAL_EMAIL_PRIVATE_KEY` Actions secrets, `APPROVAL_EMAIL_FROM` and `MESH_LAB_SITE_URL` variables, and the matching public key with `enabled: true`. Until then, the form offers a private `mailto:sensecap@seeed.cc` handoff; it cannot automatically email a contact that exists only in that manual message. See [APPROVAL_EMAIL_SETUP.md](APPROVAL_EMAIL_SETUP.md) for activation, retries, failure reconciliation, and safe local access to encrypted social reward contacts.

## Search and project filters

`docs/search.js` searches the reviewed records in `docs/data/projects.json`. Its index includes `title`, `description`, `author`, `categories`, `devices`, `products`, and `tags`. Every whitespace-separated query word must match that combined metadata; matching ignores letter case, spaces, underscores, and common hyphens. For example, `X1 LoRa` requires both terms, and `weather_station` can match `weather-station`.

Search does **not** fetch live pages, crawl resource links, search comments, or read GitHub issue labels. The curated projects’ tags are maintained in the catalog; newly approved submissions receive the `Community build` tag. Repository topics can help the import rules suggest hardware/categories, but they are not automatically added as searchable project tags. Edit and review catalog metadata to change search coverage. Resource labels and social URLs are displayed on cards and detail views but are not part of the search index.

The product filter and submission form include SenseCAP MeshTracker X1. IOT replaces Integration/Integrations in the project taxonomy. Older issue values and category query links are mapped to IOT so existing submissions and links continue to work.

## Likes, comments, and shares

- The card's Like button toggles a heart stored in the current browser (`meshlab-likes`). It is not an authenticated global vote. The UI explicitly explains the scope.
- Public hearts and comment counts come from a linked GitHub issue. The display combines public GitHub hearts with the current browser's heart; a user who also reacts on GitHub can contribute to both. Most Liked sorts by this displayed total.
- An approved community submission automatically uses its submission issue for comments and public GitHub heart reactions.
- For imported projects without an issue, Comments opens a prefilled GitHub discussion issue containing `<!-- mesh-lab-project: PROJECT_ID -->`. A maintainer links it by adding `project-discussion`. Reuse the linked issue for subsequent discussion. No public discussions or comments were fabricated during catalog import.
- GitHub counts refresh on comments, supported label events, manual dispatch, and the hourly workflow schedule. They are snapshots, not live totals. The first linked discussion per project is canonical; avoid labeling duplicates.
- Share opens the system share sheet or copies the project URL. Its count reflects successful shares/copies in this browser only. Canceled/failed shares are not counted.
- Cross-device authenticated likes, inline comment submission, and global share counts still require a backend or third-party service. Comments are written on GitHub; the static site shows reviewed snapshots.

## Content maintenance

`docs/config.js` defines the categories, product filter groups, activity IDs, and repository URL. Keep the GitHub issue form taxonomy in `.github/ISSUE_TEMPLATE/project.yml` synchronized; a test enforces this. L1 and L1 E-ink share a product filter group; `devices` preserves specific hardware details.

`docs/data/projects.json` stores:

| Field | Purpose |
| --- | --- |
| `id`, `title`, `description`, `author` | Stable project identity and English copy |
| `categories`, `products` | Multi-select filters from the configured taxonomy |
| `devices`, `tags` | Actual hardware details and search terms |
| `image`, `imageAlt`, `url`, `source` | HTTPS cover image, optional cover description used as alternative text, primary project, optional source |
| `addedAt` | Date added to this collection, not an invented original publication date |
| `setup`, `resources` | Setup steps and labeled resource URLs |
| `activity` | Optional configured activity ID, otherwise `null` |
| `issueNumber`, `socialLinks` | Optional approved submission and public social links |

The 15 curated entries include all 10 enclosure projects from the supplied Wio Tracker L1 Wiki, EasySkyMesh, MeshCore Open image transmission, and the three existing AI projects. Summaries retain source attribution. Catalog dates denote this collection's import date. Images load from their original public sources and have a local fallback if unavailable.

## L2 Pro activity

`docs/l2.html` is the dedicated dark activity page. Home, Project Hub, and Community Activities link to it. It includes build/share rewards, platform milestones, three participation steps, build ideas, documentation, FAQ, and a decorative network across the entire page. Smaller floating L2 devices fill the hero background with multiple demo screens. The hub uses a pale green grid, varied section gradients, and a full-background L2 campaign banner. Motion respects reduced-motion preferences and pauses while the tab or relevant decoration is hidden.

The activity’s Submit a Project buttons—including the participation step—open the shared form from `docs/partials/project-form.html`, initialized by `docs/project-form.js`. Wio Tracker L2 Pro and its activity are preselected.

Submit Your Link opens a separate social reward form, also available through `l2.html#submit-social`. Makers select a previously approved L2 project from the published catalog, choose a platform, add a direct post/video link, and provide a required private contact email. The form no longer asks for current upvotes/views or repeats the platform threshold beneath the selection. Empty or unavailable project lists show an explanation and a submission or retry action. The form checks the selected project and supported post URL format; AE still verifies the maker’s GitHub account, actual approval, organic metrics, and reward eligibility. Social review issues must not receive the project catalog’s `ae-approved` label.

Build Reward is a **Seeed Discount Coupon: $15 off orders of $50+**. Shipping does not count toward the minimum or receive the discount. Eligible purchases are in the Seeed Mesh product line, excluding XIAO development kits. A working project with an approved submission qualifies.

Share Reward is a **Seeed Merchandise Pack** for an approved project whose social post reaches an eligible platform’s milestone. Social sharing is optional. Each project may earn one coupon and one merchandise pack; reaching milestones on multiple platforms does not earn extra packs for the same project. Merchandise may include pins, Velcro patches, and mugs, with contents depending on availability. The site prepares submissions; AE handles review and reward fulfillment.

Purchase buttons remain disabled with Coming Soon text until a purchase URL is supplied. Set `purchaseUrl` in `docs/l2-config.js` to enable them. The activity Wiki and contact email are configured there. No deadline, coupon expiration, or dispatch time is specified.

The local product cutout `docs/assets/l2-pro.webp` was cropped from the official Seeed Wiki photo at `https://files.seeedstudio.com/wiki/SenseCAP/Wio_Tracker_L2/L2First.png`. Step images live in `docs/assets/l2-steps/`; the screen tiles in `docs/assets/l2-screens/tile/` are resized copies of the provided L2 screenshots. Shared styles are in `docs/base.css`; the hub uses `docs/hub.css` and the activity page `docs/l2.css`.

## GitHub Pages

In Settings → Pages, choose **GitHub Actions** as the source. The `Deploy Mesh Lab` workflow uploads `docs` directly. It runs on changes to `main`, successful catalog workflow runs, and manual dispatch. The `workflow_run` trigger is necessary because commits made by `GITHUB_TOKEN` do not trigger ordinary push workflows. A custom domain is optional.

All original projects, images, and trademarks belong to their creators. This site is an independent index; check the original resources for licenses and complete instructions.
