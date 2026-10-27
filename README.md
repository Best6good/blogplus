# 学习随录 - 个人博客系统

一个用于记录学习笔记和项目实践的个人博客，采用前后端分离架构。

## 技术栈

### 前端
- 原生 HTML / CSS / JavaScript
- Apple 风格玻璃质感设计（通透磨砂 + 边缘折射光带）
- 深色/浅色主题切换（橙红磨砂玻璃质感切换按钮）
- 响应式布局

### 后端
- Node.js + Express
- SQLite (better-sqlite3, WAL 模式)
- RESTful API 设计

## 项目结构

```
blogplus/
├── index.html          # 前台页面
├── styles.css          # 样式文件（前台与后台共用同一套设计系统）
├── script.js           # 前台交互脚本（含项目卡片动态预览动画生成）
├── admin.html          # 内容管理后台页面
├── admin.css           # 后台布局样式（组件外观复用 styles.css）
├── admin.js            # 后台交互脚本
└── server/             # 后端服务
    ├── app.js          # 服务入口（含静态资源白名单与可选鉴权）
    ├── package.json    # 依赖配置
    ├── middleware/
    │   └── admin-auth.js  # 可选的管理接口鉴权（ADMIN_TOKEN）
    ├── database/
    │   ├── index.js    # 数据库连接（WAL）
    │   ├── init.js     # 初始化脚本（建表 + 种子数据）
    │   └── blog.db     # SQLite 数据库文件（shm/wal 为运行临时文件，可忽略）
    └── routes/         # API 路由
        ├── notes.js    # 笔记相关接口
        ├── projects.js # 项目相关接口
        ├── about.js    # 关于我接口
        ├── messages.js # 联系消息接口
        └── stats.js    # 统计数据接口（带 30s 缓存）
```

## 快速开始

> 仓库不包含 `blog.db`（数据库属运行时数据，已在 `.gitignore` 中排除）。
> 克隆后按下面第 2 步运行 `npm run init-db` 即可生成一份带种子数据的库。

### 1. 安装后端依赖

```bash
cd server
npm install
```

### 2. 初始化数据库（首次运行）

```bash
npm run init-db
```

### 3. 启动服务

```bash
npm start
```

或者开发模式（自动重启）：

```bash
npm run dev
```

### 4. 访问网站

打开浏览器访问：http://localhost:3001

内容管理后台：http://localhost:3001/admin.html

## 安全与鉴权（可选）

- **静态资源白名单**：后端仅放行前台实际引用的 6 个静态文件，不会把整个项目目录暴露出去，避免 `server/routes/*`、数据库文件与依赖包被直接下载。
- **管理鉴权**：设置环境变量 `ADMIN_TOKEN` 后，所有非 GET 的管理写操作与消息管理接口要求请求头 `Authorization: Bearer <ADMIN_TOKEN>`（或查询参数 `admin_token=`）。未设置时默认放行，保持本地单机行为。

```bash
# Linux / macOS
ADMIN_TOKEN=你的令牌 npm start
# Windows PowerShell
$env:ADMIN_TOKEN="你的令牌"; npm start
```

后台前端配合：在 localStorage 写入与令牌相同的 `blog_admin_token` 后，后台请求会自动附带该请求头。

## 内容管理后台

### 可以管理的内容

| 模块 | 支持的操作 | 字段 |
| --- | --- | --- |
| 学习笔记 | 新建 / 编辑 / 删除 | 标题、摘要、标签、正文（Markdown，带实时预览） |
| 项目实践 | 新建 / 编辑 / 删除 | 名称、简介、技术标签、精选开关、卡片预览样式、预览动画关键词、在线预览链接、源码链接、详情正文 |
| 关于我 | 编辑 | 名称、个人简介、邮箱、GitHub 链接、头像文字 |
| 联系消息 | 查看 / 标为已读 / 删除 | 前台「联系我」表单提交的消息 |

后台复用前台同一套设计系统：按钮、弹窗、Toast、表单、标签、入场动画与主题切换均与博客保持一致。

### 卡片预览动画（visual_type）

后台为每个项目选择一种预览动画，关键词用**空格分隔**（最多 8 个）：

| 变体 | 说明 |
| --- | --- |
| `auto`（默认） | 按关键词个数自动挑选最合适的动画 |
| `carousel` | 堆叠轮播：三槽推挤，词从右侧平滑滑入中央彩色展示后让位 |
| `dial` | 环形表盘：关键词环形分布，表针按 360°/N 步进指向并点亮当前词 |
| `marquee` | 三行弹幕：关键词分配到 3 行循环飘过（字号随词数自适应） |
| `wave` | 波浪：同屏水平排列 + 依次上下浮动 |

预览窗口统一玻璃质感（通透 + 磨砂 + 圆润边框）、DM Sans 字体；各动画均可适配不同关键词个数。

## 功能特性

### 前台
- 学习笔记：列表/标签筛选/搜索分页、Markdown 渲染、详情弹窗、上一篇/下一篇
- 项目实践：特色大卡 + 普通卡片、动态预览动画、详情弹窗、在线预览/源码跳转
- 关于我：个人展示、联系表单（提交后可在后台查看）
- 交互体验：深/浅色主题切换动画、滚动入场动画、弹窗过渡、Toast、响应式布局

### 后台
- 笔记 / 项目 / 关于我 / 联系消息 四个模块的管理
- 项目预览动画与关键词的可视化配置

## API 接口

### 笔记 notes
- `GET    /api/notes` - 列表（分页 / 标签 / 搜索）
- `GET    /api/notes/:id` - 详情（含上下篇；`?inc=1` 累加浏览量）
- `POST   /api/notes` - 创建
- `PUT    /api/notes/:id` - 更新
- `DELETE /api/notes/:id` - 删除

### 项目 projects
- `GET    /api/projects` - 列表（`?featured=true` 可筛选精选）
- `GET    /api/projects/:id` - 详情（含上下篇；`?inc=1` 累加浏览量）
- `POST   /api/projects` - 创建
- `PUT    /api/projects/:id` - 更新
- `DELETE /api/projects/:id` - 删除

### 其他
- `GET  /api/about` - 获取关于我
- `PUT  /api/about` - 更新关于我
- `POST /api/messages` - 提交联系消息（公开）
- `GET  /api/messages` - 消息列表（管理）
- `PUT  /api/messages/:id/read` - 标记已读（管理）
- `DELETE /api/messages/:id` - 删除消息（管理）
- `GET  /api/stats` - 博客统计（30s 缓存）
- `POST /api/stats/invalidate` - 清空统计缓存
- `POST /api/stats/visit` - 记录页面访问
- `GET  /api/health` - 健康检查

> 说明：`views` 浏览量字段仅在前台以 `?inc=1` 打开详情时累加并返回，前端当前未展示；`projects.likes` 字段仅为兼容历史数据保留，前端未读取。两字段均不影响功能。

## 数据库表结构

- `notes`：id, title, excerpt, content, tag, created_at, updated_at, views
- `projects`：id, title, description, tags, preview_url, source_url, featured, visual_type, visual_keywords, content, views, created_at, updated_at, likes
- `about`：id, name, bio, email, github, avatar_text
- `messages`：id, name, email, message, created_at, read
- `visit_stats`：id, page, visit_date, count

## 自定义配置

### 修改端口

```bash
# 环境变量优先，默认 3001
PORT=8080 npm start
```

或修改 `server/app.js` 中的默认值。

### 添加初始数据

编辑 `server/database/init.js` 中的初始数据数组，然后运行：

```bash
npm run init-db
```

> 注意：`init.js` 仅在对应表为空时插入种子数据，不会覆盖已有内容。

## License

MIT
