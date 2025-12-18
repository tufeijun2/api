const express = require('express');
const router = express.Router();
const moment = require('moment');
const {get_device_fingerprint} = require('../../config/common');
const { select, insert, update, delete: del, count,Web_Trader_UUID } = require('../../config/supabase');
const { getUserFromSession } = require('../../middleware/auth');

// 处理错误的辅助函数
const handleError = (res, error, message) => {
  console.error(message + ':', error);
  res.status(500).json({ success: false, message, details: error.message });
};

// 获取VipDashboard页面数据
router.get('/documentlist', async (req, res) => {
  try {
      const Web_Trader_UUID = req.headers['web-trader-uuid'];
      
      if (!Web_Trader_UUID) {
        return res.status(400).json({
          success: false,
          message: 'Web-Trader-UUID header is required'
        });
      }
      
      let conditions = [];
      conditions.push({ type: 'eq', column: 'trader_uuid', value: Web_Trader_UUID });
      // 获取登录用户信息（用于后续权限检查，但不影响列表返回）
      const user = await getUserFromSession(req);
      // 移除对未登录用户的过滤，让所有用户都能看到所有文档（包括VIP）的数量
      // 注意：实际下载VIP文档时仍需要权限检查
      const orderBy = {'column':'ispublic','ascending':false};
      const documentslist = await select('documents', '*', conditions,
          null,
            null, orderBy
        );
      
      // 确保返回数组，即使查询失败也返回空数组
      const result = (documentslist && Array.isArray(documentslist)) ? documentslist : [];
        
      res.status(200).json({ 
        success: true, 
        data: result,
        message:'获取文档数据成功'
      });
  } catch (error) {
    console.error('获取文档列表失败:', error);
    handleError(res, error, 'Failed to fetch data');
  }
});

module.exports = router;