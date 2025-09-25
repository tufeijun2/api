const express = require('express');
const router = express.Router();
const { select, insert, update, delete: del, count } = require('../config/supabase');
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

// 处理错误的辅助函数
const handleError = (res, error, message) => {
    console.error(message, error);
    res.status(500).json({
        success: false,
        message: message || '服务器内部错误',
        error: error.message || '未知错误'
    });
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

// 获取所有AI选股数据（带搜索、分页和筛选） - 需要登录和管理员权限
router.get('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    // 处理查询参数
    const { search, market, offset = 0, limit = 10 } = req.query;

    // 构建条件
    const conditions = [];
    if (search) {
      conditions.push({'type':'like','column':'symbols','value':search});
    }
    if (market !== undefined && market!="") {
      conditions.push({'type':'eq','column':'market','value':market});
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 如果用户不是超级管理员，并且有trader_uuid，则只返回该trader_uuid的数据
        if (user && user.trader_uuid) {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
        }
    // 构建排序
    const orderBy = {'column':'id','ascending':false};
    
    const aiStockPickers = await select('ai_stock_picker', '*', conditions, 
      parseInt(limit),
      parseInt(offset),
      orderBy
    );
    
    // 获取总数用于分页
    const total = await count('ai_stock_picker', conditions);
    
    res.status(200).json({
      success: true,
      data: aiStockPickers,
      total: total || 0,
      pages: Math.ceil((total || 0) / limit)
    });
  } catch (error) {
    handleError(res, error, '获取AI选股数据失败');
  }
});

// 获取单个AI选股数据 - 需要登录和管理员权限
router.get('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const aiStockPicker = await select('ai_stock_picker', '*', [
      { type: 'eq', column: 'id', value: id }
    ]);
    
    if (!aiStockPicker || aiStockPicker.length === 0) {
      return res.status(404).json({ success: false, message: 'AI选股数据不存在' });
    }
    
    res.status(200).json({ success: true, data: aiStockPicker[0] });
  } catch (error) {
    handleError(res, error, '获取单个AI选股数据失败');
  }
});

// 创建新的AI选股数据 - 需要登录和管理员权限
router.post('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { 
      trader_uuid, 
      userid, 
      market, 
      symbols, 
      put_price, 
      put_time, 
      currprice, 
      exite_time, 
      target_price, 
      upside, 
      out_info 
    } = req.body;
    
    // 输入验证
    if (!market || !symbols || !put_price) {
      return res.status(400).json({ success: false, message: '缺少必要的字段' });
    }
    
    const newAiStockPicker = await insert('ai_stock_picker', {
      trader_uuid,
      userid,
      market,
      symbols,
      put_price,
      put_time: put_time || new Date(),
      currprice,
      exite_time,
      target_price,
      upside,
      out_info
    });
    
    res.status(201).json({ success: true, message: 'AI选股数据创建成功', data: newAiStockPicker });
  } catch (error) {
    handleError(res, error, '创建AI选股数据失败');
  }
});

// 更新AI选股数据 - 需要登录和管理员权限
router.put('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      trader_uuid, 
      userid, 
      market, 
      symbols, 
      put_price, 
      put_time, 
      currprice, 
      exite_time, 
      target_price, 
      upside, 
      out_info 
    } = req.body;
    
    // 检查数据是否存在
    const existingPicker = await select('ai_stock_picker', '*', [
      {'type':'eq','column':'id','value':id}
    ]);
    if (!existingPicker || existingPicker.length === 0) {
      return res.status(404).json({ success: false, message: 'AI选股数据不存在' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 准备更新数据
    const updateData = {};
    
    if (trader_uuid !== undefined) updateData.trader_uuid = trader_uuid;
    if (userid !== undefined) updateData.userid = userid;
    if (market !== undefined) updateData.market = market;
    if (symbols !== undefined) updateData.symbols = symbols;
    if (put_price !== undefined) updateData.put_price = put_price;
    if (put_time !== undefined) updateData.put_time = put_time;
    if (currprice !== undefined) updateData.currprice = currprice;
    if (exite_time !== undefined) updateData.exite_time = exite_time;
    if (target_price !== undefined) updateData.target_price = target_price;
    if (upside !== undefined) updateData.upside = upside;
    if (out_info !== undefined) updateData.out_info = out_info;
    
    const updatedAiStockPicker = await update('ai_stock_picker', updateData, [
      { type: 'eq', column: 'id', value: id }
    ]);
    
    res.status(200).json({ success: true, message: 'AI选股数据更新成功', data: updatedAiStockPicker });
  } catch (error) {
    handleError(res, error, '更新AI选股数据失败');
  }
});

// 删除AI选股数据 - 需要登录和管理员权限
router.delete('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查数据是否存在
    const existingPicker = await select('ai_stock_picker', '*', [
      {'type':'eq','column':'id','value':id}
    ]);
    if (!existingPicker || existingPicker.length === 0) {
      return res.status(404).json({ success: false, message: 'AI选股数据不存在' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 检查权限
    if (user && user.trader_uuid !== existingPicker[0].trader_uuid && user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '没有权限删除此AI选股数据' });
    }
    
    await del('ai_stock_picker', [
      { type: 'eq', column: 'id', value: id }
    ]);
    
    res.status(200).json({ success: true, message: 'AI选股数据已成功删除' });
  } catch (error) {
    handleError(res, error, '删除AI选股数据失败');
  }
});

module.exports = router;