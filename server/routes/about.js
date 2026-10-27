/**
 * 关于我相关 API 路由
 */

const express = require('express');
const router = express.Router();
const db = require('../database');

// 获取关于我信息
router.get('/', (req, res) => {
  try {
    const about = db.prepare(
      `SELECT * FROM about ORDER BY id DESC LIMIT 1`
    ).get();

    res.json({
      success: true,
      data: about || {
        name: '学习随录',
        bio: '',
        email: '',
        github: '',
        avatar_text: '学'
      }
    });
  } catch (error) {
    console.error('获取关于我信息失败:', error);
    res.status(500).json({ success: false, message: '获取关于我信息失败' });
  }
});

// 更新关于我信息
router.put('/', (req, res) => {
  try {
    const { name, bio, email, github, avatar_text } = req.body;

    const about = db.prepare('SELECT id FROM about ORDER BY id DESC LIMIT 1').get();

    if (about) {
      db.prepare(
        `UPDATE about SET name = ?, bio = ?, email = ?, github = ?, avatar_text = ?
         WHERE id = ?`
      ).run(name, bio, email, github, avatar_text, about.id);
    } else {
      db.prepare(
        `INSERT INTO about (name, bio, email, github, avatar_text)
         VALUES (?, ?, ?, ?, ?)`
      ).run(name, bio, email, github, avatar_text);
    }

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新关于我信息失败:', error);
    res.status(500).json({ success: false, message: '更新关于我信息失败' });
  }
});

module.exports = router;
