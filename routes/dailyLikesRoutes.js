const express = require('express');
const router = express.Router();
const { select, insert, update, delete: del, count } = require('../config/supabase');
const { getUserFromSession } = require('../middleware/auth');

// 获取所有每日点赞数据（带搜索、分页和筛选）
router.get('/', async (req, res) => {
  try {
    // 处理查询参数
    const { date, offset = 0, limit = 10 } = req.query;
    
    // 构建条件
    const conditions = [];
    if (date) {
      conditions.push({ type: 'eq', column: 'date', value: date });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 使用user_id进行筛选
    if (user && user.user_id) {
      conditions.push({ type: 'eq', column: 'user_id', value: user.user_id });
    }
    
    // 构建排序
    const orderBy = { 'column': 'date', 'ascending': false };
    
    const dailyLikes = await select('daily_likes', '*', conditions, limit,
      offset,
      orderBy
    );
    
    // 获取总数用于分页
    const total = await count('daily_likes', conditions);
    
    res.status(200).json({
      success: true,
      data: dailyLikes,
      total: total || 0,
      pages: Math.ceil((total || 0) / limit)
    });
  } catch (error) {
    console.error('获取每日点赞数据失败:', error);
    res.status(500).json({ success: false, error: '获取每日点赞数据失败', details: error.message });
  }
});

// 获取单个每日点赞数据
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // id是uuid类型，使用对象条件
    const dailyLikes = await select('daily_likes', '*', [{ 'type': 'eq', 'column': 'id', 'value': id }]);
    
    if (!dailyLikes || dailyLikes.length === 0) {
      return res.status(404).json({ success: false, error: '每日点赞数据不存在' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 检查权限 - 只有管理员或记录所属者可以查看
    if (user && user.user_id !== dailyLikes[0].user_id && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限查看此每日点赞数据' });
    }
    
    res.status(200).json({ success: true, data: dailyLikes[0] });
  } catch (error) {
    console.error('获取单个每日点赞数据失败:', error);
    res.status(500).json({ success: false, error: '获取单个每日点赞数据失败', details: error.message });
  }
});

// 创建新的每日点赞数据
router.post('/', async (req, res) => {
  try {
    const { date, total_likes } = req.body;
    
    // 输入验证
    if (!date || !total_likes) {
      return res.status(400).json({ success: false, error: '缺少必要的字段' });
    }
    
    // 检查日期是否已存在
    const existingRecord = await select('daily_likes', '*', [{ 'type': 'eq', 'column': 'date', 'value': date }]);
    if (existingRecord && existingRecord.length > 0) {
      return res.status(400).json({ success: false, error: '该日期的每日点赞数据已存在' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    const newDailyLike = await insert('daily_likes', {
      date,
      total_likes,
      user_id: user ? user.user_id : null
    });
    
    res.status(201).json({ success: true, data: newDailyLike });
  } catch (error) {
    console.error('创建每日点赞数据失败:', error);
    res.status(500).json({ success: false, error: '创建每日点赞数据失败', details: error.message });
  }
});

// 更新每日点赞数据
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, total_likes } = req.body;
    
    // 检查数据是否存在
    const existingRecord = await select('daily_likes', '*', [{ 'type': 'eq', 'column': 'id', 'value': id }]);
    if (!existingRecord || existingRecord.length === 0) {
      return res.status(404).json({ success: false, error: '每日点赞数据不存在' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 检查权限 - 只有管理员或记录所属者可以更新
    if (user && user.user_id !== existingRecord[0].user_id && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限更新此每日点赞数据' });
    }
    
    // 检查日期是否已存在其他记录
    if (date && date !== existingRecord[0].date) {
      const dateRecord = await select('daily_likes', '*', [{ 'type': 'eq', 'column': 'date', 'value': date }]);
      if (dateRecord && dateRecord.length > 0) {
        return res.status(400).json({ success: false, error: '该日期的每日点赞数据已存在' });
      }
    }
    
    const updateData = {};
    
    if (date !== undefined) updateData.date = date;
    if (total_likes !== undefined) updateData.total_likes = total_likes;
    
    const updatedRecord = await update('daily_likes', updateData, [
      { type: 'eq', column: 'id', value: id }
    ]);
    
    res.status(200).json({ success: true, data: updatedRecord });
  } catch (error) {
    console.error('更新每日点赞数据失败:', error);
    res.status(500).json({ success: false, error: '更新每日点赞数据失败', details: error.message });
  }
});

// 删除每日点赞数据
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查数据是否存在
    const existingRecord = await select('daily_likes', '*', [{ 'type': 'eq', 'column': 'id', 'value': id }]);
    if (!existingRecord || existingRecord.length === 0) {
      return res.status(404).json({ success: false, error: '每日点赞数据不存在' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 检查权限 - 只有管理员或记录所属者可以删除
    if (user && user.user_id !== existingRecord[0].user_id && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限删除此每日点赞数据' });
    }
    
    // 删除每日点赞数据
    await del('daily_likes', [
      { type: 'eq', column: 'id', value: id }
    ]);
    
    res.status(200).json({ success: true, message: '每日点赞数据已成功删除' });
  } catch (error) {
    console.error('删除每日点赞数据失败:', error);
    res.status(500).json({ success: false, error: '删除每日点赞数据失败', details: error.message });
  }
});

module.exports = router;