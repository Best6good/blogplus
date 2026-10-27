/**
 * 学习随录 - 个人博客后端服务
 *
 * 安全设计（交付时已收紧）：
 * - 前端静态资源改为「白名单」逐文件放行，不再把整个项目目录静态暴露，
 *   避免 /server/routes/*、/server/database/blog.db、依赖包被直接下载。
 * - 设置环境变量 ADMIN_TOKEN 后可保护笔记/项目/关于我的写接口与消息管理接口；
 *   未设置时保持默认无鉴权（本地单机行为不变）。
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const createAdminAuth = require('./middleware/admin-auth');

// 路由模块
const notesRouter = require('./routes/notes');
const projectsRouter = require('./routes/projects');
const aboutRouter = require('./routes/about');
const messagesRouter = require('./routes/messages');
const statsRouter = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: true, limit: '512kb' }));

// 可选鉴权：未设 ADMIN_TOKEN 时 adminAuth 为 null，各守卫直接放行
const adminAuth = createAdminAuth();

/** 只保护非 GET 的管理写操作（笔记 / 项目 / 关于我） */
function writeGuard(req, res, next) {
  if (!adminAuth || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  return adminAuth(req, res, next);
}
/** 消息：POST 为公开联系表单；GET/PUT/DELETE 为管理面 */
function messageGuard(req, res, next) {
  if (req.method === 'POST') return next();
  if (!adminAuth) return next();
  return adminAuth(req, res, next);
}

// API 路由（先挂载鉴权守卫，再挂路由）
app.use('/api/notes', writeGuard, notesRouter);
app.use('/api/projects', writeGuard, projectsRouter);
app.use('/api/about', writeGuard, aboutRouter);
app.use('/api/messages', messageGuard, messagesRouter);
app.use('/api/stats', statsRouter);

// 前端静态资源白名单：只允许访问页面实际依赖的文件
// （不再使用 express.static(项目根目录)，防止 server/ 目录与数据库被下载）
const PUBLIC_STATIC = new Set([
  'index.html',
  'admin.html',
  'styles.css',
  'script.js',
  'admin.css',
  'admin.js'
]);
app.get(/^\/([^/]+)$/, (req, res, next) => {
  const name = req.params[0];
  if (PUBLIC_STATIC.has(name)) {
    return res.sendFile(path.join(__dirname, '..', name));
  }
  next();
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString()
    }
  });
});

// 根路径 - 返回前端页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// 404 处理（页面为单页锚点导航，无 history 路由，无需对任意路径回退 index）
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      message: '接口不存在'
    });
  }
  return res.status(404).type('text/plain').send('Not Found');
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误'
  });
});

// 检查数据库是否存在，不存在则初始化
const dbPath = path.join(__dirname, 'database', 'blog.db');
if (!fs.existsSync(dbPath)) {
  console.log('📦 数据库不存在，正在初始化...');
  require('./database/init');
}

// 启动服务器
app.listen(PORT, () => {
  console.log('');
  console.log('🎉 学习随录 - 后端服务已启动');
  console.log('');
  console.log(`🌐 网站地址: http://localhost:${PORT}`);
  console.log(`🔌 API 地址: http://localhost:${PORT}/api`);
  console.log(`💊 健康检查: http://localhost:${PORT}/api/health`);
  console.log('');
  console.log(`🔒 管理鉴权: ${adminAuth ? '已启用（ADMIN_TOKEN）' : '未启用（本地模式）'}`);
  console.log('');
  console.log('📚 API 文档:');
  console.log('   GET    /api/notes          - 获取笔记列表');
  console.log('   GET    /api/notes/:id      - 获取笔记详情');
  console.log('   GET    /api/projects       - 获取项目列表');
  console.log('   GET    /api/projects/:id   - 获取项目详情');
  console.log('   GET    /api/about          - 获取关于我信息');
  console.log('   POST   /api/messages       - 提交联系消息');
  console.log('   GET    /api/stats          - 获取统计数据');
  console.log('');
});
