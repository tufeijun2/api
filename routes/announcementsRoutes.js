const express = require('express');
const router = express.Router();
const { select, insert, update, delete: deleteData, count } = require('../config/supabase');
const { getUserFromSession } = require('../middleware/auth');

// 验证用户是否已登录的中间件
const authenticateUser = async (req, res, next) => {
  try {
    // 从cookie或请求头中获取session token
    const sessionToken = req.cookies?.session_token || req.headers['session-token'];
    
    if (!sessionToken) {
      return res.status(401).json({ success: false, message: '用户未登录' });
    }
    
    // 查询有效的会话
    const now = new Date().toISOString();
    const sessions = await select('user_sessions', '*', [
      { type: 'eq', column: 'session_token', value: sessionToken },
      { type: 'gt', column: 'expires_at', value: now }
    ]);
    
    if (!sessions || sessions.length === 0) {
      // 会话无效或已过期，清除cookie
      res.clearCookie('session_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/' 
      });
      return res.status(401).json({ success: false, message: '会话已过期，请重新登录' });
    }
    
    const session = sessions[0];
    
    // 查询用户信息
    const users = await select('users', '*', [
      { type: 'eq', column: 'id', value: session.user_id }
    ]);
    
    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    
    // 将用户信息添加到请求对象中
    req.user = users[0];
    
    next();
  } catch (error) {
    console.error('验证用户登录状态失败:', error);
    res.status(500).json({ success: false, message: '验证用户登录状态失败' });
  }
};

// 验证用户是否为管理员的中间件
const authorizeAdmin = (req, res, next) => {
  // 确保authenticateUser中间件已在前面执行
  if (!req.user) {
    return res.status(401).json({ success: false, message: '用户未登录' });
  }
  
  // 检查用户角色是否为admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: '权限不足，需要管理员权限' });
  }
  
  next();
};

// 格式化日期时间的辅助函数
const formatDatetime = (datetime) => {
    if (!datetime) return null;
    
    try {
        const date = new Date(datetime);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch (error) {
        console.error('日期格式化错误:', error);
        return datetime; // 如果格式化失败，返回原始值
    }
};

// 处理错误的辅助函数
const handleError = (res, error, message) => {
    console.error(message, error);
    res.status(500).json({
        success: false,
        message: message || '服务器内部错误',
        error: error.message || '未知错误'
    });
};

// 获取公告列表 - 需要管理员权限
router.get('/', authenticateUser, authorizeAdmin, async (req, res) => {
    try {
        const { limit = 10, offset = 0, query = '', active, priority } = req.query;
        
        const conditions = [];
        if (query && query!="") {
            conditions.push({ type: 'ilike', column: 'title', value: `%${query}%` });
        }
        if (active !== undefined && active!="") conditions.push({ type: 'eq', column: 'active', value: active === 'true' });
        if (priority !== undefined && priority!="") conditions.push({ type: 'eq', column: 'priority', value: parseInt(priority) });
       // 获取登录用户信息
     const user = await getUserFromSession(req);
        
        // 使用user_id进行筛选，而不是trader_uuid
    if (user && user.trader_uuid) {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
     }
      const orderBy = {'column':'id','ascending':false};
        // 查询数据
        const announcements = await select('announcements', '*', conditions, 
            parseInt(limit), 
            parseInt(offset), 
            orderBy
        );
        
        // 查询总记录数
        const total = await count('announcements', conditions);
        
        // 格式化公告数据
        const formattedAnnouncements = announcements.map(announcement => ({
            ...announcement,
            created_at: formatDatetime(announcement.created_at),
            updated_at: announcement.updated_at ? formatDatetime(announcement.updated_at) : null
        }));
        
        res.status(200).json({ success: true, data: formattedAnnouncements, total: total });
    } catch (error) {
        handleError(res, error, '获取公告列表失败');
    }
});

// 获取单个公告 - 需要登录
router.get('/:id', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        
        // id是integer类型
        const announcements = await select('announcements', '*', [
            { type: 'eq', column: 'id', value: parseInt(id) }
        ]);
        
        if (!announcements || announcements.length === 0) {
            return res.status(404).json({ success: false, message: '公告不存在' });
        }
        
        const announcement = announcements[0];
        
        // 格式化公告数据
        const formattedAnnouncement = {
            ...announcement,
            created_at: formatDatetime(announcement.created_at),
            updated_at: announcement.updated_at ? formatDatetime(announcement.updated_at) : null
        };
        
        res.status(200).json({ success: true, data: formattedAnnouncement });
    } catch (error) {
        handleError(res, error, '获取公告失败');
    }
});

// 创建公告 - 需要管理员权限
router.post('/', authenticateUser, authorizeAdmin, async (req, res) => {
    try {
        const {title, content, active = true, priority = 1,
            trader_uuid, popup_enabled = true, delay_seconds = 10,
            show_to_members = true, allow_close_dialog = 0
        } = req.body;
        
        // 验证输入
        if (!title || !content) {
            return res.status(400).json({ success: false, message: '标题、内容和trader_uuid不能为空' });
        }
          // 获取登录用户信息
     const user = await getUserFromSession(req);
        // 创建公告
        const newAnnouncement = {
            title,
            content,
            active: !!active,
            priority: parseInt(priority) || 1,
            popup_enabled: !!popup_enabled,
            delay_seconds: parseInt(delay_seconds) || 10,
            show_to_members: !!show_to_members,
            allow_close_dialog: parseInt(allow_close_dialog) || 0,
            // 移除自动生成的时间字段，由数据库自动生成
            trader_uuid:user.trader_uuid
        };
        
        const insertedAnnouncements = await insert('announcements', newAnnouncement);
        
        res.status(201).json({ success: true, message: '公告创建成功', data: insertedAnnouncements[0] });
    } catch (error) {
        handleError(res, error, '创建公告失败');
    }
});

// 更新公告 - 需要管理员权限
router.put('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const {title, content, active, priority,
            trader_uuid, popup_enabled, delay_seconds,
            show_to_members, allow_close_dialog
        } = req.body;
        
        // 检查公告是否存在
        // id是integer类型
        const existingAnnouncements = await select('announcements', '*', [
            { type: 'eq', column: 'id', value: parseInt(id) }
        ]);
        
        if (!existingAnnouncements || existingAnnouncements.length === 0) {
            return res.status(404).json({ success: false, message: '公告不存在' });
        }
        
        // 准备更新数据
        const updateData = {};
        
        if (title !== undefined) updateData.title = title;
        if (content !== undefined) updateData.content = content;
        if (active !== undefined) updateData.active = !!active;
        if (priority !== undefined) updateData.priority = parseInt(priority) || 1;
        if (trader_uuid !== undefined) updateData.trader_uuid = trader_uuid;
        if (popup_enabled !== undefined) updateData.popup_enabled = !!popup_enabled;
        if (delay_seconds !== undefined) updateData.delay_seconds = parseInt(delay_seconds) || 10;
        if (show_to_members !== undefined) updateData.show_to_members = !!show_to_members;
        if (allow_close_dialog !== undefined) updateData.allow_close_dialog = parseInt(allow_close_dialog) || 0;
        
        // 移除自动生成的updated_at字段，由数据库自动生成
        
        // 更新公告
        const updatedAnnouncements = await update('announcements', updateData, [
            { type: 'eq', column: 'id', value: parseInt(id) }
        ]);
        
        res.status(200).json({ success: true, message: '公告更新成功', data: updatedAnnouncements[0] });
    } catch (error) {
        handleError(res, error, '更新公告失败');
    }
});

// 删除公告 - 需要管理员权限
router.delete('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // 检查公告是否存在
        const existingAnnouncements = await select('announcements', '*', [
            { type: 'eq', column: 'id', value: parseInt(id) }
        ]);
        
        if (!existingAnnouncements || existingAnnouncements.length === 0) {
            return res.status(404).json({ success: false, message: '公告不存在' });
        }
        
        // 删除公告
        await deleteData('announcements', [
            { type: 'eq', column: 'id', value: parseInt(id) }
        ]);
        
        res.status(200).json({ success: true, message: '公告删除成功' });
    } catch (error) {
        handleError(res, error, '删除公告失败');
    }
});

module.exports = router;