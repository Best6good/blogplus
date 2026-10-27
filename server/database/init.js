/**
 * 数据库初始化脚本
 * 创建表结构并插入初始数据
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'blog.db');
const db = new Database(dbPath);

// 启用外键约束
db.pragma('foreign_keys = ON');

// 创建表
db.exec(`
  -- 笔记表
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    excerpt TEXT,
    content TEXT,
    tag TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    views INTEGER DEFAULT 0
  );

  -- 项目表
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    tags TEXT,
    preview_url TEXT,
    source_url TEXT,
    featured INTEGER DEFAULT 0,
    visual_type TEXT DEFAULT 'auto',
    visual_keywords TEXT DEFAULT '',
    content TEXT,
    views INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    likes INTEGER DEFAULT 0
  );

  -- 关于我信息表
  CREATE TABLE IF NOT EXISTS about (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    bio TEXT,
    email TEXT,
    github TEXT,
    avatar_text TEXT
  );

  -- 联系消息表
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    read INTEGER DEFAULT 0
  );

  -- 访问统计表
  CREATE TABLE IF NOT EXISTS visit_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page TEXT,
    visit_date TEXT DEFAULT (date('now', 'localtime')),
    count INTEGER DEFAULT 1
  );
`);

// 检查是否已有数据
const noteCount = db.prepare('SELECT COUNT(*) as count FROM notes').get().count;
const projectCount = db.prepare('SELECT COUNT(*) as count FROM projects').get().count;
const aboutCount = db.prepare('SELECT COUNT(*) as count FROM about').get().count;

if (noteCount === 0) {
  console.log('📝 正在插入初始笔记数据...');
  
  const insertNote = db.prepare(`
    INSERT INTO notes (title, excerpt, content, tag, views)
    VALUES (?, ?, ?, ?, ?)
  `);

  const notes = [
    {
      title: 'CSS 现代布局完全指南',
      excerpt: '从 Flexbox 到 Grid，再到 Subgrid 与 Container Queries，系统梳理现代 CSS 布局的核心能力。',
      tag: '前端基础',
      views: 128,
      content: `
## 前言

CSS 布局经历了从 table 布局到 float 布局，再到 Flexbox 和 Grid 的演进。本文将系统梳理现代 CSS 布局的核心能力。

## Flexbox 布局

Flexbox 是一维布局模型，非常适合处理行或列中的元素排列。

\`\`\`css
.container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}
\`\`\`

### 常用属性

- \`flex-direction\` - 主轴方向
- \`justify-content\` - 主轴对齐
- \`align-items\` - 交叉轴对齐
- \`flex-wrap\` - 换行方式
- \`gap\` - 间距

## Grid 布局

Grid 是二维布局模型，可以同时控制行和列。

\`\`\`css
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: auto;
  gap: 1.5rem;
}
\`\`\`

## Subgrid

Subgrid 允许子元素继承父网格的轨道定义，是 Grid 的重要增强。

## Container Queries

容器查询让组件能够根据自身容器的大小来调整样式，是响应式设计的新范式。

## 总结

现代 CSS 布局提供了强大的工具，合理组合使用可以构建出灵活、健壮的布局系统。
      `.trim()
    },
    {
      title: '深入理解事件循环',
      excerpt: '通过宏任务、微任务、渲染帧的调度顺序，彻底搞懂浏览器中的异步执行模型。',
      tag: 'JavaScript',
      views: 256,
      content: `
## 什么是事件循环

JavaScript 是单线程语言，但它通过事件循环机制实现了非阻塞的异步操作。

## 宏任务与微任务

### 宏任务 (Macro Task)
- setTimeout / setInterval
- setImmediate (Node.js)
- I/O 操作
- UI 渲染

### 微任务 (Micro Task)
- Promise.then / catch / finally
- MutationObserver
- process.nextTick (Node.js)

## 执行顺序

1. 执行同步代码
2. 执行所有微任务
3. 浏览器渲染（如有必要）
4. 执行下一个宏任务
5. 回到步骤 2

## 代码示例

\`\`\`javascript
console.log('1');

setTimeout(() => {
  console.log('2');
  Promise.resolve().then(() => {
    console.log('3');
  });
}, 0);

Promise.resolve().then(() => {
  console.log('4');
});

console.log('5');
// 输出: 1, 5, 4, 2, 3
\`\`\`

## 与渲染帧的关系

requestAnimationFrame 在渲染阶段执行，位于微任务之后、重绘之前。

## 总结

理解事件循环是掌握 JavaScript 异步编程的关键，有助于写出更高效、更可预测的代码。
      `.trim()
    },
    {
      title: '从零搭建 Vite 组件库',
      excerpt: '记录如何配置 TypeScript、Rollup、UnoCSS 与测试环境，打造可发布的 UI 组件库。',
      tag: '工程化',
      views: 89,
      content: `
## 项目初始化

使用 Vite 快速搭建组件库项目。

\`\`\`bash
npm create vite@latest my-component-lib -- --template vue-ts
\`\`\`

## TypeScript 配置

配置 tsconfig.json，确保类型声明正确生成。

## Rollup 构建配置

使用 Vite 的库模式进行构建，输出 ESM 和 CJS 两种格式。

\`\`\`typescript
// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [vue(), dts()],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'MyComponentLib',
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: { vue: 'Vue' },
      },
    },
  },
});
\`\`\`

## UnoCSS 集成

使用 UnoCSS 进行原子化 CSS 管理，支持按需生成。

## 测试环境

使用 Vitest + Vue Test Utils 进行组件测试。

## 发布流程

配置 package.json，设置正确的入口文件和版本管理策略。

## 总结

搭建一个组件库涉及多方面的配置，但一旦搭建完成，后续开发就会非常高效。
      `.trim()
    },
    {
      title: 'Web 性能指标与实践',
      excerpt: 'LCP、INP、CLS 三大核心指标的含义，以及真实项目中的优化策略。',
      tag: '性能优化',
      views: 167,
      content: `
## Core Web Vitals

Google 定义的三大核心 Web 性能指标。

### LCP (Largest Contentful Paint)

衡量页面主要内容加载完成的时间。
- 目标：< 2.5 秒
- 影响因素：图片加载、字体加载、服务端响应

### INP (Interaction to Next Paint)

衡量用户交互到页面响应的延迟。
- 目标：< 200 毫秒
- 影响因素：JavaScript 执行时间、DOM 复杂度

### CLS (Cumulative Layout Shift)

衡量页面布局的意外偏移量。
- 目标：< 0.1
- 影响因素：图片无尺寸、动态内容插入

## 优化策略

### LCP 优化
1. 优化关键渲染路径
2. 懒加载非关键资源
3. 使用 CDN 加速静态资源
4. 优化图片格式和大小

### INP 优化
1. 减少长任务
2. 使用 requestIdleCallback 处理非紧急任务
3. 优化事件处理器
4. 减少 DOM 深度

### CLS 优化
1. 为图片和视频设置尺寸
2. 避免动态插入内容
3. 使用 transform 动画代替触发布局的属性

## 性能监控

使用 Performance API 和 Lighthouse 进行性能监控和分析。

## 总结

性能优化是一个持续的过程，需要不断监控、分析和改进。
      `.trim()
    },
    {
      title: 'React Hooks 最佳实践',
      excerpt: '深入理解 useState、useEffect、useMemo 等常用 Hook 的使用场景和注意事项。',
      tag: 'React',
      views: 203,
      content: `
## useState 最佳实践

### 状态拆分原则
将相关的状态放在一起，不相关的状态分开管理。

### 函数式更新
当新状态依赖于旧状态时，使用函数式更新。

\`\`\`jsx
setCount(prev => prev + 1);
\`\`\`

## useEffect 使用指南

### 依赖数组
正确设置依赖数组，避免无限循环或遗漏更新。

### 清理函数
在副作用中创建的订阅、定时器等，必须在清理函数中移除。

\`\`\`jsx
useEffect(() => {
  const timer = setInterval(() => {
    // ...
  }, 1000);
  return () => clearInterval(timer);
}, []);
\`\`\`

## useMemo 与 useCallback

### useMemo
缓存计算结果，避免昂贵的重复计算。

### useCallback
缓存函数引用，避免子组件不必要的重渲染。

## 自定义 Hook

将可复用的逻辑抽离为自定义 Hook，提高代码复用性。

\`\`\`jsx
function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : initialValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}
\`\`\`

## 常见陷阱

1. 不要在条件语句中调用 Hook
2. 不要在循环中调用 Hook
3. 不要在嵌套函数中调用 Hook

## 总结

合理使用 Hooks 可以让函数组件拥有强大的状态管理和副作用处理能力。
      `.trim()
    },
    {
      title: 'TypeScript 高级类型技巧',
      excerpt: '掌握条件类型、映射类型、模板字面量类型等高级特性，写出更安全的代码。',
      tag: 'TypeScript',
      views: 178,
      content: `
## 条件类型

条件类型允许我们根据条件选择类型。

\`\`\`typescript
type IsString<T> = T extends string ? true : false;
type A = IsString<string>;  // true
type B = IsString<number>;  // false
\`\`\`

## 映射类型

映射类型可以基于已有类型创建新类型。

\`\`\`typescript
type Readonly<T> = {
  readonly [P in keyof T]: T[P];
};

type Partial<T> = {
  [P in keyof T]?: T[P];
};
\`\`\`

## 模板字面量类型

TypeScript 4.1 引入的强大特性。

\`\`\`typescript
type EventName<T extends string> = \`on\${Capitalize<T>}\`;
type ClickEvent = EventName<'click'>;  // 'onClick'
\`\`\`

## 推断类型 infer

infer 关键字用于在条件类型中推断类型。

\`\`\`typescript
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : any;
\`\`\`

## 实用工具类型

- \`Pick<T, K>\` - 选取部分属性
- \`Omit<T, K>\` - 排除部分属性
- \`Extract<T, U>\` - 提取交集
- \`Exclude<T, U>\` - 排除并集
- \`NonNullable<T>\` - 排除 null 和 undefined

## 总结

掌握 TypeScript 的高级类型技巧，可以编写出更安全、更具表达力的代码。
      `.trim()
    }
  ];

  const insertMany = db.transaction(() => {
    for (const note of notes) {
      insertNote.run(note.title, note.excerpt, note.content, note.tag, note.views);
    }
  });
  
  insertMany();
  console.log(`✅ 已插入 ${notes.length} 篇笔记`);
}

if (projectCount === 0) {
  console.log('💼 正在插入初始项目数据...');
  
  const insertProject = db.prepare(`
    INSERT INTO projects (title, description, tags, preview_url, source_url, featured, visual_type, visual_keywords, content, likes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const projects = [
    {
      title: '任务管理看板',
      description: '支持拖拽排序、标签过滤与进度统计的协作看板应用，采用 Kanban 方法论设计。',
      tags: 'React,TypeScript',
      preview_url: 'https://example.com/kanban',
      source_url: 'https://github.com/example/kanban',
      featured: 1,
      visual_type: 'auto',
      visual_keywords: '任务管理 拖拽排序 实时协作 性能优化 全栈开发',
      likes: 42
    },
    {
      title: '个人笔记 API',
      description: '轻量级 RESTful API 服务，支持笔记的增删改查、全文搜索与分类归档。',
      tags: 'Node.js,SQLite',
      preview_url: 'https://example.com/api-docs',
      source_url: 'https://github.com/example/note-api',
      featured: 0,
      visual_type: 'auto',
      visual_keywords: 'RESTful API 全文搜索 索引设计',
      likes: 28
    },
    {
      title: '3D 数据可视化大屏',
      description: '结合 Three.js 与 ECharts，将抽象数据转化为可交互的三维场景。',
      tags: 'Vue,Three.js',
      preview_url: 'https://example.com/dataviz',
      source_url: 'https://github.com/example/dataviz',
      featured: 0,
      visual_type: 'auto',
      visual_keywords: '三维地球 实时数据 性能优化',
      likes: 56
    },
    {
      title: 'Markdown 编辑器',
      description: '所见即所得的 Markdown 编辑器，支持实时预览、语法高亮与快捷键操作。',
      tags: 'JavaScript,CSS',
      preview_url: 'https://example.com/md-editor',
      source_url: 'https://github.com/example/md-editor',
      featured: 0,
      visual_type: 'auto',
      visual_keywords: '实时预览 语法高亮 自动保存',
      likes: 35
    },
    {
      title: '天气预报小程序',
      description: '基于微信小程序的天气预报应用，支持多城市、实时天气与未来七天预报。',
      tags: '小程序,API',
      preview_url: 'https://example.com/weather',
      source_url: 'https://github.com/example/weather-miniapp',
      featured: 0,
      visual_type: 'auto',
      visual_keywords: '晴 多云 阴 雨 雪 雾',
      likes: 19
    }
  ];

  const insertMany = db.transaction(() => {
    for (const project of projects) {
      insertProject.run(
        project.title,
        project.description,
        project.tags,
        project.preview_url,
        project.source_url,
        project.featured,
        project.visual_type,
        project.visual_keywords || '',
        project.content || '',
        project.likes
      );
    }
  });
  
  insertMany();
  console.log(`✅ 已插入 ${projects.length} 个项目`);
}

if (aboutCount === 0) {
  console.log('👤 正在插入关于我数据...');
  
  db.prepare(`
    INSERT INTO about (name, bio, email, github, avatar_text)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    '学习随录',
    '我是一名热爱前端开发的学习者，喜欢把复杂的技术概念拆解成清晰的笔记，也享受从零开始构建产品的过程。这个博客是我的数字花园，记录着每一段学习旅程中的思考与收获。',
    'hello@example.com',
    'https://github.com/example',
    '学'
  );
  
  console.log('✅ 已插入关于我信息');
}

console.log('');
console.log('🎉 数据库初始化完成！');
console.log(`📁 数据库文件: ${dbPath}`);

db.close();
