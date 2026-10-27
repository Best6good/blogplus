/**
 * 统计数据相关 API 路由
 * - 优化: 单次 SQL 完成三表计数（避免 3 次往返）
 * - 优化: 30s 内存缓存（统计变化频率低，避免每次请求扫库）
 * - 优化: 返回值去掉前端未消费的 unreadMessages 字段
 */

const express = require('express');
const router = express.Router();
const db = require('../database');

// 30s 内存缓存（统计类数据允许短暂陈旧）
const CACHE_TTL_MS = 30 * 1000;
let cache = null;          // { payload, expiresAt }

// 单次查询三张表的统计值（子查询并行执行，SQLite 内部单线程串行但避免 3 次往返）
function fetchStats() {
  const row = db.prepare(
    `SELECT
       (SELECT COUNT(*) FROM notes) AS notes,
       (SELECT COUNT(*) FROM projects) AS projects,
       (SELECT COUNT(DISTINCT tag) FROM notes
          WHERE tag IS NOT NULL AND tag <> '') AS tags`
  ).get();
  return {
    notes:     row.notes || 0,
    projects:  row.projects || 0,
    tags:      row.tags || 0
  };
}

// 获取博客统计数据（带缓存）
router.get('/', (req, res) => {
  try {
    const now = Date.now();
    if (cache && cache.expiresAt > now) {
      // 命中缓存
      res.set('X-Cache', 'HIT');
      return res.json({ success: true, data: cache.payload, cached: true });
    }

    // 缓存过期 → 查库刷新
    const data = fetchStats();
    cache = { payload: data, expiresAt: now + CACHE_TTL_MS };

    res.set('X-Cache', 'MISS');
    res.json({ success: true, data, cached: false });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ success: false, message: '获取统计数据失败' });
  }
});

// 主动清空缓存（admin 删除/新增内容后调用，POST /stats/invalidate）
router.post('/invalidate', (_req, res) => {
  cache = null;
  res.json({ success: true, message: '缓存已清空' });
});

// 记录页面访问（保持原行为）
router.post('/visit', (req, res) => {
  try {
    const { page } = req.body;

    if (!page) {
      return res.status(400).json({ success: false, message: '缺少页面参数' });
    }

    // 检查今天是否已有记录
    // 注意：统一使用 SQLite 本地时间 date('now','localtime') 判断“今天”，
    // 避免前端 UTC 日期（toISOString）与库内本地日期混用导致的跨日错位
    const existing = db.prepare(
      `SELECT id, count FROM visit_stats
       WHERE page = ? AND visit_date = date('now', 'localtime')`
    ).get(page);

    if (existing) {
      db.prepare(
        'UPDATE visit_stats SET count = count + 1 WHERE id = ?'
      ).run(existing.id);
    } else {
      db.prepare(
        `INSERT INTO visit_stats (page, visit_date, count)
         VALUES (?, date('now', 'localtime'), 1)`
      ).run(page);
    }

    res.json({ success: true, message: '访问已记录' });
  } catch (error) {
    console.error('记录访问失败:', error);
    res.status(500).json({ success: false, message: '记录访问失败' });
  }
});

module.exports = router;