const { select } = require('../config/supabase');

/**
 * 验证用户是否已登录并获取用户信息
 * @param {Object} req - Express请求对象
 * @returns {Object|null} 用户信息对象或null
 */
const getUserFromSession = async (req) => {
  try {
    // 从cookie或请求头中获取session token
    const sessionToken = req.cookies?.session_token || req.headers['session-token'];
    
    if (!sessionToken) {
      return null;
    }
    
    // 查询有效的会话
    const now = new Date().toISOString();
    const sessions = await select('user_sessions', '*', [
      { type: 'eq', column: 'session_token', value: sessionToken },
      { type: 'gt', column: 'expires_at', value: now }
    ]);
    
    if (!sessions || sessions.length === 0) {
      return null;
    }
    
    const session = sessions[0];
    
    // 查询用户信息
    const users = await select('users', '*', [
      { type: 'eq', column: 'id', value: session.user_id }
    ]);
    
    if (!users || users.length === 0) {
      return null;
    }
    
    return users[0];
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return null;
  }
};

module.exports = {
  getUserFromSession
};