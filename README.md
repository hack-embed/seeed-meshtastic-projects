# Mesh Works · Seeed Meshtastic 项目集合

一个独立的社区项目索引，收集基于 Seeed 硬件的 Meshtastic 开源代码、制作教程与硬件创意。采用原生 HTML / CSS / JavaScript，无框架、无构建依赖。

默认发布地址：<https://hack-embed.github.io/seeed-meshtastic-projects/>

## 本地运行

安装 Python 3 后，从仓库根目录运行：

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory docs
```

打开 <http://127.0.0.1:8765/>。不要直接双击 HTML 文件，浏览器需要通过 HTTP 读取项目 JSON。项目封面使用外部图片，需要联网；加载失败会显示文字封面。

## 公网部署：GitHub Pages

1. 把本仓库推送到自己的 GitHub 公开仓库。
2. 打开仓库 **Settings → Pages**。
3. 在 **Build and deployment** 中选择 **Deploy from a branch**。
4. 选择 `main` 分支和 `/docs` 文件夹，点击 Save。
5. 等待自动生成的 `pages-build-deployment` 任务成功，即可访问 `https://用户名.github.io/仓库名/`。

本项目使用 `.nojekyll`，GitHub 直接发布静态文件，不需要 `npm install` 或 `npm run build`。GitHub Free 支持公开仓库的 Pages 托管，不需要购买服务器；自定义域名的注册费用另计。

后续每次向 `main` 推送更新，Pages 都会自动重新发布。域名可在 **Settings → Pages → Custom domain** 绑定，并按 GitHub 提示配置 DNS、启用 HTTPS。

如果更换账号或仓库名，修改 `docs/index.html` 中 `repo-link` 和 `submit-link` 两个链接，再更新本说明中的网站地址。其他站内资源均使用相对路径，可部署在子目录。

官方说明：<https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site>

## 添加和维护项目

编辑 `docs/data/projects.json`，复制一条现有记录并填写：

| 字段          | 含义                                                              |
| ------------- | ----------------------------------------------------------------- |
| `id`          | 唯一标识，使用小写英文和连字符；发布后尽量不变                    |
| `title`       | 项目名称                                                          |
| `description` | 中文简介，不宣称未核实的能力                                      |
| `category`    | AI 与自动化 / 户外与定位 / 外壳与改装 / 太阳能与供电 / 网络与网关 |
| `devices`     | 设备名称数组，保持同一设备名称一致                                |
| `tags`        | 搜索关键词数组                                                    |
| `author`      | 原作者                                                            |
| `kind`        | 开源代码 / 制作教程 / 社区制作                                    |
| `url`         | 原项目或教程的 HTTPS 地址                                         |
| `image`       | 获准使用的封面图片 HTTPS 地址；可以留空                           |
| `source`      | 可选，收录信息的来源页面                                          |

项目按照数据文件顺序展示。增加设备名称会自动生成对应筛选项。检查数据和语法：

```sh
node scripts/validate.mjs
node --check docs/app.js
```

浏览器检查：搜索 `esp32s3`；按分类和设备交叉筛选；搜索无匹配词后清除筛选；打开详情后用 Escape 关闭；收藏、刷新并筛选收藏；在手机宽度下检查卡片与投稿说明。

## 投稿和收藏

- **投稿**：访问者登录 GitHub 后填写 Issue 表单（`.github/ISSUE_TEMPLATE/project.yml`）。维护者核实原作者、硬件、源码或教程链接、封面授权后，手动加入数据文件。提交 Issue 不会直接发布内容。
- **收藏**：保存在当前浏览器的 `localStorage`。不会同步到其他设备，不是公共点赞统计。清理浏览器数据会清除收藏。
- **搜索**：在浏览器执行，支持多关键词交集，以及设备名的大小写、空格和连字符归一化。筛选状态保存在 URL，便于分享。

## 文件结构

```text
docs/
  index.html              页面结构
  style.css               响应式样式
  app.js                  筛选、搜索、详情、收藏
  data/projects.json      项目目录
  assets/                 本站绘制的 SVG 标识与示意图
  .nojekyll               直接发布静态资源
.github/ISSUE_TEMPLATE/   GitHub 投稿表单
scripts/validate.mjs      项目数据检查
```

## 来源与范围

首批项目根据 Seeed Solution / Seeed Projects 的公开 GitHub 仓库和 Seeed Wiki 的 Wio Tracker L1 外壳集合整理，每条数据保留原项目链接和作者。社区制作条目不代表已确认其拥有某种开源许可证；代码、设计文件和图片的使用条件以原项目为准。

项目和封面归各自作者所有，商标归各自权利人所有。本站为独立索引，非 Seeed 或 Meshtastic 官方网站。后续可添加 Cloudflare Workers + D1，实现公共点赞统计或免 GitHub 登录投稿；当前部署不依赖后端。
