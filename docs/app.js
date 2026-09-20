const $ = (id) => document.getElementById(id);
const categories = [
  "全部项目",
  "AI 与自动化",
  "户外与定位",
  "外壳与改装",
  "太阳能与供电",
  "网络与网关",
];
const params = new URLSearchParams(location.search);
let projects = [],
  category = categories.includes(params.get("category"))
    ? params.get("category")
    : "全部项目",
  savedOnly = false;
let saved = new Set();
try {
  const stored = JSON.parse(localStorage.getItem("meshworks-saved") || "[]");
  if (Array.isArray(stored))
    saved = new Set(stored.filter((x) => typeof x === "string"));
} catch {}
const escapeHtml = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const safeUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
};
const normalize = (value) => value.toLowerCase().replace(/[\s_\-–]+/g, "");
const fallback =
  '<div class="fallback-cover"><span>⌁</span><span>MADE FOR THE MESH</span></div>';
function attachImageFallbacks(root) {
  root.querySelectorAll("img[data-cover]").forEach((img) => {
    img.addEventListener(
      "error",
      () => {
        const cover = document.createElement("div");
        cover.innerHTML = fallback;
        img.replaceWith(cover.firstElementChild);
      },
      { once: true },
    );
  });
}
function notify(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => ($("toast").hidden = true), 2500);
}
function toggleSave(id) {
  saved.has(id) ? saved.delete(id) : saved.add(id);
  try {
    localStorage.setItem("meshworks-saved", JSON.stringify([...saved]));
  } catch {
    notify("浏览器未允许存储，收藏仅在本次页面中保留。");
  }
  render();
}
function renderCategories() {
  $("categories").innerHTML = categories
    .map(
      (name) =>
        `<button class="tab" type="button" aria-pressed="${category === name}" data-category="${escapeHtml(name)}">${name}</button>`,
    )
    .join("");
}
function render() {
  const words = $("search")
    .value.trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const device = $("device").value;
  const result = projects.filter(
    (p) =>
      (category === "全部项目" || p.category === category) &&
      (device === "all" || p.devices.includes(device)) &&
      (!savedOnly || saved.has(p.id)) &&
      words.every((word) =>
        normalize(
          [
            p.title,
            p.description,
            p.author,
            p.category,
            ...p.devices,
            ...p.tags,
          ].join(" "),
        ).includes(normalize(word)),
      ),
  );
  renderCategories();
  $("result-count").textContent =
    `找到 ${result.length} 个项目${savedOnly ? " · 我的收藏" : ""}`;
  $("saved-count").textContent = projects.filter((p) => saved.has(p.id)).length;
  $("saved-only").setAttribute("aria-pressed", String(savedOnly));
  $("empty").hidden = result.length !== 0;
  $("project-grid").innerHTML = result
    .map(
      (p) =>
        `<article class="project-card"><div class="card-cover"><button type="button" class="cover-button" data-detail="${escapeHtml(p.id)}" aria-label="查看 ${escapeHtml(p.title)} 的详情">${safeUrl(p.image) ? `<img data-cover src="${escapeHtml(safeUrl(p.image))}" alt="${escapeHtml(p.title)}" loading="lazy" decoding="async">` : fallback}</button><span class="cover-label">${escapeHtml(p.kind)}</span><button class="save" type="button" data-save="${escapeHtml(p.id)}" aria-label="${saved.has(p.id) ? "取消收藏" : "收藏"} ${escapeHtml(p.title)}" aria-pressed="${saved.has(p.id)}">${saved.has(p.id) ? "♥" : "♡"}</button></div><div class="card-body"><span class="card-category">${escapeHtml(p.category)}</span><h3><button class="card-title" type="button" data-detail="${escapeHtml(p.id)}">${escapeHtml(p.title)}</button></h3><p class="card-description">${escapeHtml(p.description)}</p><div class="tags">${p.devices.map((d) => `<span class="tag">${escapeHtml(d)}</span>`).join("")}</div><div class="card-bottom"><span class="author">by ${escapeHtml(p.author)}</span><a href="${escapeHtml(safeUrl(p.url))}" target="_blank" rel="noopener noreferrer">查看项目 ↗</a></div></div></article>`,
    )
    .join("");
  attachImageFallbacks($("project-grid"));
  const url = new URL(location.href);
  url.searchParams.delete("q");
  url.searchParams.delete("category");
  url.searchParams.delete("device");
  if ($("search").value.trim())
    url.searchParams.set("q", $("search").value.trim());
  if (category !== "全部项目") url.searchParams.set("category", category);
  if (device !== "all") url.searchParams.set("device", device);
  history.replaceState(null, "", url);
}
function showDetail(id) {
  const p = projects.find((item) => item.id === id);
  if (!p) return;
  $("detail-content").innerHTML =
    `${safeUrl(p.image) ? `<img class="detail-image" data-cover src="${escapeHtml(safeUrl(p.image))}" alt="${escapeHtml(p.title)}">` : fallback}<div class="dialog-body"><p class="eyebrow">${escapeHtml(p.category)} / ${escapeHtml(p.kind)}</p><h2 id="detail-title">${escapeHtml(p.title)}</h2><p>${escapeHtml(p.description)}</p><div class="tags">${p.devices.map((d) => `<span class="tag">${escapeHtml(d)}</span>`).join("")}</div><div class="dialog-links"><a class="button dark" href="${escapeHtml(safeUrl(p.url))}" target="_blank" rel="noopener noreferrer">${p.kind === "开源代码" ? "查看源代码" : "查看制作教程"} ↗</a>${p.source && safeUrl(p.source) !== safeUrl(p.url) ? `<a class="text-link" href="${escapeHtml(safeUrl(p.source))}" target="_blank" rel="noopener noreferrer">收录来源 ↗</a>` : ""}</div><p class="detail-attribution">作者：${escapeHtml(p.author)}<br>项目介绍根据公开资料整理，图片来自项目作者或 Seeed Wiki。具体代码、设计文件及许可请查看原项目。</p></div>`;
  attachImageFallbacks($("detail-content"));
  $("detail").showModal();
}
async function loadProjects() {
  $("load-error").hidden = true;
  $("result-count").textContent = "正在加载项目…";
  try {
    const response = await fetch("./data/projects.json");
    if (!response.ok) throw new Error("catalog unavailable");
    projects = await response.json();
    if (!Array.isArray(projects)) throw new Error("invalid catalog");
    const devices = [...new Set(projects.flatMap((p) => p.devices))].sort();
    $("device").innerHTML =
      '<option value="all">全部设备</option>' +
      devices
        .map(
          (d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`,
        )
        .join("");
    if (devices.includes(params.get("device")))
      $("device").value = params.get("device");
    $("catalog-stats").textContent =
      `${String(projects.length).padStart(2, "0")} 个项目 / ${devices.length} 种设备 / 持续收录`;
    render();
  } catch {
    $("load-error").hidden = false;
    $("empty").hidden = true;
    $("result-count").textContent = "项目加载失败";
    $("catalog-stats").textContent = "社区项目 · 持续收录";
  }
}
$("search").value = params.get("q") || "";
$("search").addEventListener("input", render);
$("device").addEventListener("change", render);
$("categories").addEventListener("click", (event) => {
  const target = event.target.closest("[data-category]");
  if (target) {
    category = target.dataset.category;
    render();
  }
});
$("project-grid").addEventListener("click", (event) => {
  const save = event.target.closest("[data-save]");
  if (save) {
    const id = save.dataset.save;
    toggleSave(id);
    $("project-grid")
      .querySelector(`[data-save="${CSS.escape(id)}"]`)
      ?.focus({ preventScroll: true });
    return;
  }
  const detail = event.target.closest("[data-detail]");
  if (detail) showDetail(detail.dataset.detail);
});
$("saved-only").addEventListener("click", () => {
  savedOnly = !savedOnly;
  render();
});
$("reset").addEventListener("click", () => {
  $("search").value = "";
  $("device").value = "all";
  category = "全部项目";
  savedOnly = false;
  render();
});
$("retry").addEventListener("click", loadProjects);
document
  .querySelectorAll(".contribute")
  .forEach((button) =>
    button.addEventListener("click", () => $("contribute-dialog").showModal()),
  );
document.querySelectorAll("dialog").forEach((dialog) => {
  dialog
    .querySelector("[data-close]")
    .addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();
    if (
      event.target === dialog &&
      (event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom)
    )
      dialog.close();
  });
});
document.addEventListener("keydown", (event) => {
  if (
    event.key === "/" &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !document.querySelector("dialog[open]") &&
    !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName) &&
    !document.activeElement.isContentEditable
  ) {
    event.preventDefault();
    $("search").focus();
  }
});
renderCategories();
loadProjects();
