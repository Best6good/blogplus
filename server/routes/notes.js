/**
 * 笔记相关 API 路由
 */

const express = require('express');
const router = express.Router();
const db = require('../database');

// 获取笔记列表（支持分页和标签筛选）
router.get('/', (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const tag = req.query.tag || '';
    const search = req.query.search || '';
    const offset = (page - 1) * limit;

    let whereClause = [];
    let params = [];

    if (tag) {
      whereClause.push('tag = ?');
      params.push(tag);
    }

    if (search) {
      whereClause.push('(title LIKE ? OR excerpt LIKE ? OR content LIKE ?)');
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const whereSql = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';

    const total = db.prepare(
      `SELECT COUNT(*) as count FROM notes ${whereSql}`
    ).get(...params).count;

    const notes = db.prepare(
      `SELECT id, title, excerpt, tag, created_at, views 
       FROM notes 
       ${whereSql}
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    // 获取所有标签
    const tags = db.prepare(
      `SELECT DISTINCT tag FROM notes WHERE tag IS NOT NULL AND tag != '' ORDER BY tag`
    ).all().map(row => row.tag);

    res.json({
      success: true,
      data: {
        list: notes,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        tags
      }
    });
  } catch (error) {
    console.error('获取笔记列表失败:', error);
    res.status(500).json({ success: false, message: '获取笔记列表失败' });
  }
});

// 获取单篇笔记详情
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const note = db.prepare(
      `SELECT * FROM notes WHERE id = ?`
    ).get(id);

    if (!note) {
      return res.status(404).json({ success: false, message: '笔记不存在' });
    }

    // 前台阅读详情（?inc=1）时累加浏览量；后台编辑加载不带 inc，不误加
    if (req.query.inc === '1') {
      db.prepare('UPDATE notes SET views = views + 1 WHERE id = ?').run(id);
      note.views = (note.views || 0) + 1;
    }

    // 获取上一篇和下一篇
    const prevNote = db.prepare(
      `SELECT id, title FROM notes WHERE id < ? ORDER BY id DESC LIMIT 1`
    ).get(id);

    const nextNote = db.prepare(
      `SELECT id, title FROM notes WHERE id > ? ORDER BY id ASC LIMIT 1`
    ).get(id);

    res.json({
      success: true,
      data: {
        note,
        prev: prevNote || null,
        next: nextNote || null
      }
    });
  } catch (error) {
    console.error('获取笔记详情失败:', error);
    res.status(500).json({ success: false, message: '获取笔记详情失败' });
  }
});

// 创建笔记
router.post('/', (req, res) => {
  try {
    const { title, excerpt, content, tag } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: '标题不能为空' });
    }

    const result = db.prepare(
      `INSERT INTO notes (title, excerpt, content, tag)
       VALUES (?, ?, ?, ?)`
    ).run(title, excerpt || '', content || '', tag || '');

    res.json({
      success: true,
      data: {
        id: result.lastInsertRowid,
        message: '创建成功'
      }
    });
  } catch (error) {
    console.error('创建笔记失败:', error);
    res.status(500).json({ success: false, message: '创建笔记失败' });
  }
});

// 更新笔记
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { title, excerpt, content, tag } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: '标题不能为空' });
    }

    const note = db.prepare('SELECT id FROM notes WHERE id = ?').get(id);
    if (!note) {
      return res.status(404).json({ success: false, message: '笔记不存在' });
    }

    db.prepare(
      `UPDATE notes 
       SET title = ?, excerpt = ?, content = ?, tag = ?, updated_at = datetime('now', 'localtime')
       WHERE id = ?`
    ).run(title, excerpt || '', content || '', tag || '', id);

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新笔记失败:', error);
    res.status(500).json({ success: false, message: '更新笔记失败' });
  }
});

// 删除笔记
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const note = db.prepare('SELECT id FROM notes WHERE id = ?').get(id);
    if (!note) {
      return res.status(404).json({ success: false, message: '笔记不存在' });
    }

    db.prepare('DELETE FROM notes WHERE id = ?').run(id);

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除笔记失败:', error);
    res.status(500).json({ success: false, message: '删除笔记失败' });
  }
});

module.exports = router;
