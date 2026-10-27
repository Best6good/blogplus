/**
 * 可选的管理接口鉴权
 *
 * 行为约定：
 * - 未设置环境变量 ADMIN_TOKEN 时：本中间件直接放行，
 *   保持默认「本地单机、无鉴权」行为，不影响任何现有功能。
 * - 设置了 ADMIN_TOKEN 时：要求请求携带
 *   `Authorization: Bearer <ADMIN_TOKEN>`（或查询参数 admin_token=<TOKEN>），
 *   否则返回 401 JSON。
 *
 * 前端配合：admin.js 若在 localStorage 中存有 blog_admin_token，
 * 会为每个请求自动附带该请求头（请与后端环境变量保持一致）。
 */
module.exports = function createAdminAuth() {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return null; // 未启用

  return function adminAuth(req, res, next) {
    const header = req.get('authorization') || '';
    const queryToken = req.query.admin_token;

    if (header === `Bearer ${token}` || queryToken === token) {
      return next();
    }
    return res.status(401).json({
      success: false,
      message: '未授权：缺少或无效的管理令牌'
    });
  };
};
