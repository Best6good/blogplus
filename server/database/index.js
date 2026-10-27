/**
 * 数据库连接模块
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'blog.db');
const db = new Database(dbPath);

// 启用 WAL 模式以获得更好的并发性能
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

module.exports = db;
