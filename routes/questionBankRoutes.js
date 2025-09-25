const express = require('express');
const router = express.Router();
const { select, insert, update, delete: deleteData, count } = require('../config/supabase');
const { handleError } = require('../utils/errorHandler');
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
  
  // 检查用户角色是否为admin或superadmin
  if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({ success: false, message: '权限不足，需要管理员权限' });
  }
  
  next();
};

// 格式化日期时间
const formatDatetime = (datetime) => {
  if (!datetime) return null;
  return new Date(datetime).toISOString().replace('Z', '').replace('T', ' ');
};

// 格式化题目数据
const formatQuestion = (question) => {
  return {
    ...question,
    create_time: formatDatetime(question.create_time),
    correctAnswer: question.correctAnswer !== undefined ? parseInt(question.correctAnswer) : 0,
    disable: question.disable || false
  };
};

// 获取题库列表 - 需要登录和管理员权限
router.get('/list', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { limit = 10, offset = 0, keyword = '' } = req.query;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(limit) || 10;
    const actualOffset = parseInt(offset) || (page - 1) * pageSize;
    
    // 构建查询条件
    const conditions = [];
    if (keyword) {
      conditions.push({ type: 'ilike', column: 'question', value: `%${keyword}%` });
    }
    
   // 获取登录用户信息
        const user = await getUserFromSession(req);
        
        // 如果用户不是超级管理员，并且有trader_uuid，则只返回该trader_uuid的数据
        if (user && user.trader_uuid) {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
        }
    
    // 查询数据
    const orderBy = { column: 'id', ascending: false };
    const questions = await select('question_bank', '*', conditions, pageSize, actualOffset, orderBy);
    
    // 查询总记录数
    const total = await count('question_bank', conditions);
    
    // 格式化数据
    const formattedQuestions = questions.map(question => formatQuestion(question));
    
    res.status(200).json({
      success: true,
      data: {
        list: formattedQuestions,
        total: total,
        page: page,
        pageSize: pageSize
      }
    });
  } catch (error) {
    handleError(res, error, '获取题库列表失败');
  }
});

// 获取单个题目详情 - 需要登录和管理员权限
router.get('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const questions = await select('question_bank', '*', [
      { type: 'eq', column: 'id', value: id }
    ]);
    
    if (!questions || questions.length === 0) {
      return res.status(404).json({
        success: false,
        message: '题目不存在'
      });
    }
    
    // 格式化数据
    const formattedQuestion = formatQuestion(questions[0]);
    
    res.status(200).json({
      success: true,
      data: formattedQuestion
    });
  } catch (error) {
    handleError(res, error, '获取题目详情失败');
  }
});

// 添加题目 - 需要登录和管理员权限
router.post('/add', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { question, questionimg, options, correctAnswer, disable = false } = req.body;
    
    // 验证必填字段
    if (!question || !options || correctAnswer === undefined) {
      return res.status(400).json({
        success: false,
        message: '题目内容、选项和正确答案为必填项'
      });
    }
    
    // 验证选项
    if (!Array.isArray(options) || options.length < 2) {
      return res.status(400).json({
        success: false,
        message: '至少需要2个选项'
      });
    }
    
    // 验证正确答案
    if (correctAnswer < 0 || correctAnswer >= options.length) {
      return res.status(400).json({
        success: false,
        message: '正确答案索引超出范围'
      });
    }
     // 获取登录用户信息
        const user = await getUserFromSession(req);
    // 插入数据
    const insertedData = await insert('question_bank', {
      question,
      questionimg,
      options,
      correctAnswer: parseInt(correctAnswer),
      disable: Boolean(disable),
      create_time: new Date().toISOString(),
      trader_uuid:user.trader_uuid
    });
    
    // 格式化数据
    const formattedQuestion = formatQuestion(insertedData[0]);
    
    res.status(201).json({
      success: true,
      message: '题目添加成功',
      data: formattedQuestion
    });
  } catch (error) {
    handleError(res, error, '添加题目失败');
  }
});

// 更新题目 - 需要登录和管理员权限
router.put('/update/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { question, questionimg, options, correctAnswer, disable } = req.body;
    
    // 检查题目是否存在
    const existingQuestions = await select('question_bank', '*', [
      { type: 'eq', column: 'id', value: id }
    ]);
    
    if (!existingQuestions || existingQuestions.length === 0) {
      return res.status(404).json({
        success: false,
        message: '题目不存在'
      });
    }
    
    // 验证必填字段
    if (!question || !options || correctAnswer === undefined) {
      return res.status(400).json({
        success: false,
        message: '题目内容、选项和正确答案为必填项'
      });
    }
    
    // 验证选项
    if (!Array.isArray(options) || options.length < 2) {
      return res.status(400).json({
        success: false,
        message: '至少需要2个选项'
      });
    }
    
    // 验证正确答案
    if (correctAnswer < 0 || correctAnswer >= options.length) {
      return res.status(400).json({
        success: false,
        message: '正确答案索引超出范围'
      });
    }
    
    // 准备更新数据
    const updateData = {};
    
    if (question !== undefined) updateData.question = question;
    if (questionimg !== undefined) updateData.questionimg = questionimg;
    if (options !== undefined) updateData.options = options;
    if (correctAnswer !== undefined) updateData.correctAnswer = parseInt(correctAnswer);
    if (disable !== undefined) updateData.disable = Boolean(disable);
    
    // 更新数据
    const updatedData = await update('question_bank', updateData, [
      { type: 'eq', column: 'id', value: id }
    ]);
    
    // 格式化数据
    const formattedQuestion = formatQuestion(updatedData[0]);
    
    res.status(200).json({
      success: true,
      message: '题目更新成功',
      data: formattedQuestion
    });
  } catch (error) {
    handleError(res, error, '更新题目失败');
  }
});

// 删除题目 - 需要登录和管理员权限
router.delete('/delete/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查题目是否存在
    const existingQuestions = await select('question_bank', '*', [
      { type: 'eq', column: 'id', value: id }
    ]);
    
    if (!existingQuestions || existingQuestions.length === 0) {
      return res.status(404).json({
        success: false,
        message: '题目不存在'
      });
    }
    
    // 删除题目
    await deleteData('question_bank', [
      { type: 'eq', column: 'id', value: id }
    ]);
    
    res.status(200).json({
      success: true,
      message: '题目删除成功'
    });
  } catch (error) {
    handleError(res, error, '删除题目失败');
  }
});

// 切换题目状态 - 需要登录和管理员权限
router.put('/:id/toggle', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 先获取当前状态
    const questions = await select('question_bank', 'disable', [
      { type: 'eq', column: 'id', value: id }
    ]);
    
    if (!questions || questions.length === 0) {
      return res.status(404).json({
        success: false,
        message: '题目不存在'
      });
    }
    
    const newStatus = !questions[0].disable;
    
    // 更新状态
    await update('question_bank', 
      { disable: newStatus }, 
      [{ type: 'eq', column: 'id', value: id }]
    );
    
    res.status(200).json({
      success: true,
      message: newStatus ? '题目禁用成功' : '题目启用成功',
      data: { disable: newStatus }
    });
  } catch (error) {
    handleError(res, error, '切换题目状态失败');
  }
});

module.exports = router;