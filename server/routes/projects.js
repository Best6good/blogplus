/**
 * 项目相关 API 路由
 */

const express = require('express');
const router = express.Router();
const db = require('../database');

// 获取项目列表
router.get('/', (req, res) => {
  try {
    const { featured } = req.query;

    let whereClause = [];
    let params = [];

    if (featured !== undefined) {
      whereClause.push('featured = ?');
      params.push(featured === 'true' || featured === '1' ? 1 : 0);
    }

    const whereSql = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';

    const projects = db.prepare(
      `SELECT * FROM projects
       ${whereSql}
       ORDER BY featured DESC, created_at DESC`
    ).all(...params);

    // 处理 tags 字段（字符串转数组）
    const result = projects.map(project => ({
      ...project,
      tags: project.tags ? project.tags.split(',').map(t => t.trim()) : []
    }));

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('获取项目列表失败:', error);
    res.status(500).json({ success: false, message: '获取项目列表失败' });
  }
});

// 获取单个项目详情
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const project = db.prepare(
      `SELECT * FROM projects WHERE id = ?`
    ).get(id);

    if (!project) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    // 前台阅读详情（?inc=1）时累加浏览量；后台编辑加载不带 inc，不误加
    if (req.query.inc === '1') {
      db.prepare('UPDATE projects SET views = views + 1 WHERE id = ?').run(id);
      project.views = (project.views || 0) + 1;
    }

    project.tags = project.tags ? project.tags.split(',').map(t => t.trim()) : [];

    // 获取上一个和下一个项目
    const prevProject = db.prepare(
      `SELECT id, title FROM projects WHERE id < ? ORDER BY id DESC LIMIT 1`
    ).get(id);

    const nextProject = db.prepare(
      `SELECT id, title FROM projects WHERE id > ? ORDER BY id ASC LIMIT 1`
    ).get(id);

    res.json({
      success: true,
      data: {
        project,
        prev: prevProject || null,
        next: nextProject || null
      }
    });
  } catch (error) {
    console.error('获取项目详情失败:', error);
    res.status(500).json({ success: false, message: '获取项目详情失败' });
  }
});

// 创建项目
router.post('/', (req, res) => {
  try {
    const { title, description, tags, preview_url, source_url, featured, visual_type, visual_keywords, content } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: '项目名称不能为空' });
    }

    const tagsStr = Array.isArray(tags) ? tags.join(',') : (tags || '');

    const result = db.prepare(
      `INSERT INTO projects (title, description, tags, preview_url, source_url, featured, visual_type, visual_keywords, content)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      title,
      description || '',
      tagsStr,
      preview_url || '',
      source_url || '',
      featured ? 1 : 0,
      visual_type || 'default',
      visual_keywords || '',
      content || ''
    );

    res.json({
      success: true,
      data: {
        id: result.lastInsertRowid,
        message: '创建成功'
      }
    });
  } catch (error) {
    console.error('创建项目失败:', error);
    res.status(500).json({ success: false, message: '创建项目失败' });
  }
});

// 更新项目
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, tags, preview_url, source_url, featured, visual_type, visual_keywords, content } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: '项目名称不能为空' });
    }

    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
    if (!project) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    const tagsStr = Array.isArray(tags) ? tags.join(',') : (tags || '');

    db.prepare(
      `UPDATE projects
       SET title = ?, description = ?, tags = ?, preview_url = ?, source_url = ?,
           featured = ?, visual_type = ?, visual_keywords = ?, content = ?,
           updated_at = datetime('now', 'localtime')
       WHERE id = ?`
    ).run(
      title,
      description || '',
      tagsStr,
      preview_url || '',
      source_url || '',
      featured ? 1 : 0,
      visual_type || 'default',
      visual_keywords || '',
      content || '',
      id
    );

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新项目失败:', error);
    res.status(500).json({ success: false, message: '更新项目失败' });
  }
});

// 删除项目
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
    if (!project) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    db.prepare('DELETE FROM projects WHERE id = ?').run(id);

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除项目失败:', error);
    res.status(500).json({ success: false, message: '删除项目失败' });
  }
});

module.exports = router;