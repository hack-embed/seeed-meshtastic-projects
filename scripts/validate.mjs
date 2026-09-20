import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const projects = JSON.parse(
  await readFile(
    new URL("../docs/data/projects.json", import.meta.url),
    "utf8",
  ),
);
const categories = new Set([
  "AI 与自动化",
  "户外与定位",
  "外壳与改装",
  "太阳能与供电",
  "网络与网关",
]);
const ids = new Set(),
  links = new Set();
assert(Array.isArray(projects) && projects.length > 0, "项目列表不能为空");
for (const p of projects) {
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.id), `项目标识无效: ${p.id}`);
  assert(!ids.has(p.id), `重复标识: ${p.id}`);
  ids.add(p.id);
  for (const key of ["title", "description", "author", "kind"])
    assert(typeof p[key] === "string" && p[key].trim(), `${p.id}: 缺少 ${key}`);
  assert(categories.has(p.category), `${p.id}: 分类无效`);
  assert(
    ["开源代码", "制作教程", "社区制作"].includes(p.kind),
    `${p.id}: 项目类型无效`,
  );
  for (const key of ["devices", "tags"])
    assert(
      Array.isArray(p[key]) &&
        p[key].length &&
        p[key].every((v) => typeof v === "string" && v.trim()),
      `${p.id}: ${key} 必须是非空字符串数组`,
    );
  assert(typeof p.url === "string" && p.url, `${p.id}: 缺少项目链接`);
  for (const key of ["url", "image", "source"])
    if (p[key]) {
      const url = new URL(p[key]);
      assert(
        url.protocol === "https:" && !url.username && !url.password,
        `${p.id}: ${key} 必须是公开 HTTPS 地址`,
      );
    }
  assert(!links.has(p.url), `重复项目链接: ${p.url}`);
  links.add(p.url);
}
console.log(
  `验证通过：${projects.length} 个项目，${new Set(projects.flatMap((p) => p.devices)).size} 种设备。`,
);
