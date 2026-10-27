/**
 * 联系表单相关 API 路由
 */

const express = require('express');
const router = express.Router();
const db = require('../database');

// 提交联系消息
router.post('/', (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ 
        success: false, 
        message: '请填写所有必填字段' 
      });
    }

    // 简单的邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: '请输入有效的邮箱地址' 
      });
    }

    // 限制消息长度
    if (message.length > 1000) {
      return res.status(400).json({ 
        success: false, 
        message: '消息内容不能超过1000个字符' 
      });
    }

    const result = db.prepare(
      `INSERT INTO messages (name, email, message)
       VALUES (?, ?, ?)`
    ).run(name, email, message);

    res.json({
      success: true,
      data: {
        id: result.lastInsertRowid,
        message: '消息已发送，我会尽快回复您！'
      }
    });
  } catch (error) {
    console.error('提交消息失败:', error);
    res.status(500).json({ success: false, message: '提交消息失败，请稍后重试' });
  }
});

// 获取消息列表（管理用）
router.get('/', (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const total = db.prepare('SELECT COUNT(*) as count FROM messages').get().count;

    const messages = db.prepare(
      `SELECT * FROM messages 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`
    ).all(limit, offset);

    res.json({
      success: true,
      data: {
        list: messages,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('获取消息列表失败:', error);
    res.status(500).json({ success: false, message: '获取消息列表失败' });
  }
});

// 标记消息为已读
router.put('/:id/read', (req, res) => {
  try {
    const { id } = req.params;

    const message = db.prepare('SELECT id FROM messages WHERE id = ?').get(id);
    if (!message) {
      return res.status(404).json({ success: false, message: '消息不存在' });
    }

    db.prepare('UPDATE messages SET read = 1 WHERE id = ?').run(id);

    res.json({ success: true, message: '已标记为已读' });
  } catch (error) {
    console.error('标记消息失败:', error);
    res.status(500).json({ success: false, message: '操作失败' });
  }
});

// 删除消息
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const message = db.prepare('SELECT id FROM messages WHERE id = ?').get(id);
    if (!message) {
      return res.status(404).json({ success: false, message: '消息不存在' });
    }

    db.prepare('DELETE FROM messages WHERE id = ?').run(id);

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除消息失败:', error);
    res.status(500).json({ success: false, message: '删除失败' });
  }
});

module.exports = router;
