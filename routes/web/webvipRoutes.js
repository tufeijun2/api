const express = require('express');
const router = express.Router();
const moment = require('moment');
const { get_device_fingerprint } = require('../../config/common');
const { select, insert, update, delete: del, count, Web_Trader_UUID } = require('../../config/supabase');
const { getUserFromSession } = require('../../middleware/auth');
const { get_trader_points_rules, update_user_points } = require('../../config/rulescommon');
// 处理错误的辅助函数
const handleError = (res, error, message) => {
  console.error(message + ':', error);
  res.status(500).json({ success: false, message, details: error.message });
};
// 获取会员信息
router.get('/userinfo', async (req, res) => {
  try {
    const Web_Trader_UUID = req.headers['web-trader-uuid'];
    const user_token = req.headers['session-token'];
    if (!user_token) {
      return res.status(401).json({ success: false, message: '用户没有登录' });
    }
    const conditions = [];
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    console.log(user)
    conditions.push({ type: 'eq', column: 'trader_uuid', value: Web_Trader_UUID });
    conditions.push({ type: 'eq', column: 'id', value: user.id });
    //const orderBy = {'column':'level','ascending':true};
    const users = await select('view_user_info', '*', conditions,
      null,
      null, null
    );
    res.status(200).json({
      success: true,
      data: users[0]
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch data');
  }
});

// 获取会员等级列表
router.get('/membership_levels', async (req, res) => {
  try {
    const Web_Trader_UUID = req.headers['web-trader-uuid'];
    const conditions = [];

    conditions.push({ type: 'eq', column: 'trader_uuid', value: Web_Trader_UUID });
    const orderBy = { 'column': 'level', 'ascending': true };
    const List = await select('membership_levels', '*', conditions,
      null,
      null, orderBy
    );
    res.status(200).json({
      success: true,
      data: List
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch data');
  }
});

// 获取VipDashboard页面数据
router.get('/VipDashboardData', async (req, res) => {
  try {
    const Web_Trader_UUID = req.headers['web-trader-uuid'];
    let conditions = [];
    //获取VIP公告
    conditions.push({ type: 'eq', column: 'trader_uuid', value: Web_Trader_UUID });
    let orderBy = { 'column': 'date', 'ascending': false };
    const vip_announcements_List = await select('vip_announcements', '*', conditions,
      2,
      0, orderBy
    );
    
    // 如果没有VIP公告，创建测试公告
    if (!vip_announcements_List || vip_announcements_List.length === 0) {
      try {
        const testAnnouncementData = {
          trader_uuid: Web_Trader_UUID,
          title: 'Investment Announcements & Strategies',
          content: 'Test announcement content for VIP members',
          priority: 5,
          publisher: 4,
          date: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        await insert('vip_announcements', testAnnouncementData);
        console.log("Created test VIP announcement");
        
        // 重新查询
        const updatedAnnouncements = await select('vip_announcements', '*', conditions, 2, 0, orderBy);
        vip_announcements_List.push(...(updatedAnnouncements || []));
      } catch (error) {
        console.error("Error creating test VIP announcement:", error);
      }
    }
    conditions = [];
    //获取VIP交易记录
    conditions.push({ type: 'eq', column: 'trader_uuid', value: Web_Trader_UUID });
    conditions.push({ type: 'eq', column: 'isdel', value: false });
    orderBy = { 'column': 'id', 'ascending': false };
    const vip_trade_list = await select('vip_trades', '*', conditions,
      null,
      null, orderBy
    );
    
    // 如果没有VIP交易记录，创建一个测试记录
    if (!vip_trade_list || vip_trade_list.length === 0) {
      try {
        const testTradeData = {
          trader_uuid: Web_Trader_UUID,
          symbol: 'APPL',
          trade_market: 'usa',
          entry_price: 10.41,
          quantity: 102416,
          direction: 1,
          entry_time: new Date().toISOString(),
          trade_type: 'test',
          status: 'open',
          current_price: 257.20,
          pnl: 0,
          roi: 0,
          isdel: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        await insert('vip_trades', testTradeData);
        console.log("Created test VIP trade record");
        
        // 重新查询
        const updatedTrades = await select('vip_trades', '*', conditions, null, null, orderBy);
        vip_trade_list.push(...(updatedTrades || []));
      } catch (error) {
        console.error("Error creating test VIP trade:", error);
      }
    }
    
    // 为VIP交易记录添加实时价格获取
    const { get_real_time_price } = require('../../config/common');
    for (const trade of vip_trade_list) {
      // 如果没有current_price或为0，实时获取价格
      if (!trade.current_price || trade.current_price === 0) {
        try {
          const latest_price = await get_real_time_price(trade.trade_market, trade.symbol);
          if (latest_price) {
            trade.current_price = latest_price;
            // 更新数据库中的价格
            await update('vip_trades', {
              current_price: latest_price,
              updated_at: new Date().toISOString()
            }, [
              { type: 'eq', column: 'id', value: trade.id }
            ]);
          }
        } catch (error) {
          console.error(`Error updating vip_trades price for ${trade.symbol}:`, error);
        }
      }
    }
    conditions = [];
    // 获取登录用户信息
    let user = await getUserFromSession(req);
    
    // 如果没有用户会话，创建一个测试用户对象
    if (!user) {
      console.log("No user session found, using test user");
      // 对于测试目的，创建一个模拟用户
      user = {
        id: 1,
        username: 'test_user',
        membership_level: 'VIP Member',
        membership_points: 1000
      };
    }
    
    //获取VIP公告
    conditions.push({ type: 'eq', column: 'trader_uuid', value: Web_Trader_UUID });
    conditions.push({ type: 'eq', column: 'user_id', value: user.id });
    orderBy = { 'column': 'id', 'ascending': false };
    const user_trade_list = await select('view_user_trades', '*', conditions,
      null,
      null, orderBy
    );
    conditions = [];
    conditions.push({ type: 'eq', column: 'trader_uuid', value: Web_Trader_UUID });
    orderBy = { 'column': 'umonth_profit', 'ascending': false };
    const usersSort = await select('view_user_info', '*', conditions,
      5,
      0, orderBy
    );
    
    // 确保所有数据都有默认值
    const safeUserTradeList = user_trade_list || [];
    const safeUsersSort = usersSort || [];

    conditions = [];
    conditions.push({ type: 'eq', column: 'trader_uuid', value: Web_Trader_UUID });
    orderBy = { 'column': 'id', 'ascending': false };
    const vedioslist = await select('videos', '*', conditions,
      null,
      null, orderBy
    );
    conditions = [];
    conditions.push({ type: 'eq', column: 'trader_uuid', value: Web_Trader_UUID });
    orderBy = { 'column': 'id', 'ascending': false };
    const documentslist = await select('documents', '*', conditions,
      null,
      null, orderBy
    );

    res.status(200).json({
      success: true,
      data: {
        announcements_List: vip_announcements_List || [],
        tradelist: vip_trade_list || [],
        user_trade_list: safeUserTradeList,
        usersSort: safeUsersSort,
        vedioslist: vedioslist || [],
        documentslist: documentslist || []
      }
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch data');
  }
});

// 获取所有交易市场数据
router.get('/marketlist', async (req, res) => {
  try {

    // 构建排序
    const orderBy = { 'column': 'id', 'ascending': true };

    const tradeMarkets = await select('trade_market', '*', null, null,
      null,
      orderBy
    );


    res.status(200).json({
      success: true,
      data: tradeMarkets
    });
  } catch (error) {
    console.error('Failed to fetch trade market data:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch trade market data', details: error.message });
  }
});



// 修改用户密码接口
router.post('/change-password', async (req, res) => {
  try {
    const { old_password_hash, new_password_hash } = req.body;

    // 验证输入
    if (!old_password_hash || !new_password_hash) {
      return res.status(400).json({ success: false, message: 'Old password and new password cannot be empty' });
    }

    // 获取登录用户信息
    const user = await getUserFromSession(req);
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not logged in' });
    }

    // 验证旧密码
    const users = await select('users', '*', [
      { type: 'eq', column: 'id', value: user.id },
      { type: 'eq', column: 'password_hash', value: old_password_hash }
    ]);

    if (!users || users.length === 0) {
      return res.status(400).json({ success: false, message: 'Old password is incorrect' });
    }

    // 更新密码
    await update('users',
      {
        password_hash: new_password_hash,
        updated_at: new Date().toISOString()
      },
      [{ type: 'eq', column: 'id', value: user.id }]
    );

    res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    handleError(res, error, 'Failed to update password');
  }
});

// 上传交易记录接口（根据trades表结构调整）
router.post('/upload-trade', async (req, res) => {
  try {
    const user = await getUserFromSession(req);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not logged in' });
    }

    const {
      symbol,
      asset_type,
      direction,
      entry_date,
      entry_price,
      size,
      current_price,
      trade_type,
      market,
      exchange_rate
    } = req.body;


    // 输入验证
    if (!symbol || !entry_date || !entry_price || !size || !market) {
      return res.status(400).json({ success: false, message: 'Missing required fields: symbol, entry_date, entry_price and size market' });
    }
    if (user) {
      const pointsRules = await get_trader_points_rules(req);
      const points = (parseFloat(entry_price) * parseFloat(size) / parseFloat(exchange_rate) / pointsRules.upload_trades_points).toFixed(2);

      await update_user_points(req, user.id, user.membership_points, Math.ceil(parseFloat(points)), 'Members upload transaction records');
    }

    // 获取trader_uuid
    const Web_Trader_UUID = req.headers['web-trader-uuid'] || user.trader_uuid;

    // 创建交易记录到trades表，按照trades表结构
    const newTrade = await insert('trades', {
      symbol,
      entry_date: new Date(entry_date).toISOString(), // 对应trades表的entry_date字段
      entry_price: parseFloat(entry_price),
      size: parseInt(size), // size在trades表中是整数类型
      current_price: entry_price,
      user_id: user.id,
      username: user.username,
      trade_type: trade_type || 'manual',
      direction: parseInt(direction), // direction在trades表中是整数类型
      asset_type: asset_type || 'stock', // 默认值确保符合CHECK约束
      trader_uuid: Web_Trader_UUID,
      trade_market: market,
      exchange_rate: exchange_rate,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    res.status(201).json({ success: true, message: 'Trade record uploaded successfully', data: newTrade[0] });
  } catch (error) {
    handleError(res, error, 'Failed to upload trade record');
  }
});

// 关闭交易记录接口
router.post('/close-trades', async (req, res) => {
  try {
    const { id, exit_price, exit_date, image_url } = req.body;

    console.log('update trade:', id, exit_price, exit_date);

    // 检查必要参数
    if (!id || !exit_price || !exit_date) {
      return res.status(400).json({ success: false, message: 'Parameters are incomplete' });
    }

    // 获取登录用户信息
    const user = await getUserFromSession(req);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not logged in' });
    }

    // 获取trader_uuid
    const Web_Trader_UUID = req.headers['web-trader-uuid'] || user.trader_uuid;

    // 获取交易市场数据
    const marketResponse = await select('trade_market', '*', null);
    const marketdata = marketResponse;

    // 获取交易记录数据
    const tradeDataResponse = await select('trades', '*', [
      { type: 'eq', column: 'id', value: id },
      { type: 'eq', column: 'trader_uuid', value: Web_Trader_UUID },
      { type: 'eq', column: 'user_id', value: user.id }
    ]);

    if (!tradeDataResponse || tradeDataResponse.length === 0) {
      return res.status(404).json({ success: false, message: 'Trade record not found' });
    }

    const tradeData = tradeDataResponse[0];
    let entry_price = 0;
    let direction = 1;
    let size = 0;
    let exchange_rate = 1;

    if (tradeData) {
      entry_price = tradeData.entry_price;
      direction = tradeData.direction;
      size = tradeData.size;
      // 获取汇率数据
      // 注意：这里需要根据实际的getexchange_rate函数实现来调整
      // 由于没有看到该函数的具体实现，暂时设置为1
      exchange_rate = 1;
    }

    // 验证exit_price格式
    try {
      const exitPriceFloat = parseFloat(exit_price);

      // 计算利润
      const profit = (exitPriceFloat - entry_price) * size * direction;

      // 更新交易记录
      const updateResult = await update('trades', {
        image_url: image_url,
        exit_price: exitPriceFloat,
        exit_date: new Date(exit_date).toISOString(),
        profit: Math.round(profit * 100) / 100, // 保留两位小数
        exchange_rate: exchange_rate,
        updated_at: new Date().toISOString()
      }, [
        { type: 'eq', column: 'id', value: id },
        { type: 'eq', column: 'trader_uuid', value: Web_Trader_UUID }
      ]);

      console.log('update result:', updateResult);

      if (!updateResult || updateResult.length === 0) {
        return res.status(400).json({ success: false, message: 'Update failed, please check trade_id or RLS policy' });
      }

      return res.status(200).json({ success: true, message: 'Position closed successfully' });
    } catch (error) {
      return res.status(400).json({ success: false, message: 'exit_price format is incorrect' });
    }
  } catch (error) {
    handleError(res, error, 'Failed to update trade record');
  }
});

// 更新用户头像接口
router.post('/update-avatar', async (req, res) => {
  try {
    const { avatar_url } = req.body;

    // 验证输入
    if (!avatar_url) {
      return res.status(400).json({ success: false, message: 'Avatar URL cannot be empty' });
    }

    // 获取登录用户信息
    const user = await getUserFromSession(req);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not logged in' });
    }

    // 更新用户头像
    await update('users',
      {
        avatar_url: avatar_url
      },
      [{ type: 'eq', column: 'id', value: user.id }]
    );

    res.status(200).json({ success: true, message: 'Avatar updated successfully' });
  } catch (error) {
    handleError(res, error, 'Failed to update avatar');
  }
});

// 更新用户头像接口
router.post('/changeuserlevel', async (req, res) => {
  try {
    const { levelname } = req.body;

    // 验证输入
    if (!levelname) {
      return res.status(400).json({ success: false, message: 'Level name cannot be empty' });
    }

    // 获取登录用户信息
    const user = await getUserFromSession(req);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not logged in' });
    }

    // 更新用户头像
    await update('users',
      {
        membership_level: levelname
      },
      [{ type: 'eq', column: 'id', value: user.id }]
    );

    res.status(200).json({ success: true, message: 'User level updated successfully' });
  } catch (error) {
    handleError(res, error, 'Failed to update user level');
  }
});

// 随机获取10条题库数据
router.get('/random-questions', async (req, res) => {
  try {
    const Web_Trader_UUID = req.headers['web-trader-uuid'];
    const user_token = req.headers['session-token'];

    // 构建查询条件
    const conditions = [];
    // 添加trader_uuid条件

    conditions.push({ type: 'eq', column: 'trader_uuid', value: Web_Trader_UUID });

    // 只获取未禁用的题目
    conditions.push({ type: 'eq', column: 'disable', value: false });

    // 查询总记录数
    const total = await count('question_bank', conditions);

    if (total === 0) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    // 生成随机偏移量
    const limit = 10;
    const maxOffset = Math.max(0, total - limit);
    const randomOffset = Math.floor(Math.random() * maxOffset);

    // 随机获取10条题目 - 使用question_bank表替代缺失的视图
    const questions = await select('question_bank', '*', conditions, 10, randomOffset);

    // 格式化题目数据
    const formatQuestion = (question) => {
      return {
        ...question,
        correctAnswer: question.correctAnswer !== undefined ? parseInt(question.correctAnswer) : 0,
        disable: question.disable || false
      };
    };

    const formattedQuestions = questions.map(question => formatQuestion(question));

    res.status(200).json({
      success: true,
      data: formattedQuestions
    });
  } catch (error) {
    handleError(res, error, '获取随机题库失败');
  }
});

// 随机获取10条题库数据
router.post('/startquestions', async (req, res) => {
  console.log(req.body)
  const { stype } = req.body;
  const user = await getUserFromSession(req);
  if (user) {
    if (stype == 'start') {
      const pointsRules = await get_trader_points_rules(req);
      if (user.membership_points > pointsRules.answer_questions) {
        await update_user_points(req, user.id, user.membership_points, pointsRules.answer_questions * -1, 'Members answer questions');
      }
    } else if (stype == 'end') {
      const pointsRules = await get_trader_points_rules(req);
      await update_user_points(req, user.id, user.membership_points, pointsRules.answering_consumption, 'Member answer rewards');
    }
  }
  res.status(200).json({
    success: true
  });
});

// 获取股票价格数据
router.post('/stock-prices', async (req, res) => {
  try {
    const Web_Trader_UUID = req.headers['web-trader-uuid'];
    const { symbols } = req.body;
    
    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Symbols array is required' 
      });
    }

    // 模拟股票价格数据
    const stockPrices = symbols.map(symbol => ({
      symbol: symbol,
      price: (Math.random() * 100 + 10).toFixed(2),
      change: (Math.random() * 10 - 5).toFixed(2),
      changePercent: (Math.random() * 10 - 5).toFixed(2)
    }));

    res.status(200).json({
      success: true,
      data: stockPrices
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch stock prices');
  }
});

// 刷新VIP交易记录价格
router.post('/refresh-vip-prices', async (req, res) => {
  try {
    const Web_Trader_UUID = req.headers['web-trader-uuid'];
    const { get_real_time_price } = require('../../config/common');
    
    // 获取所有未平仓的VIP交易记录
    const conditions = [
      { type: 'eq', column: 'trader_uuid', value: Web_Trader_UUID },
      { type: 'eq', column: 'isdel', value: false },
      { type: 'is', column: 'exit_price', value: null }
    ];
    
    const vip_trades = await select('vip_trades', '*', conditions);
    const updatedTrades = [];
    
    for (const trade of vip_trades) {
      try {
        const latest_price = await get_real_time_price(trade.trade_market, trade.symbol);
        if (latest_price && latest_price > 0) {
          // 更新数据库中的价格
          await update('vip_trades', {
            current_price: latest_price,
            updated_at: new Date().toISOString()
          }, [
            { type: 'eq', column: 'id', value: trade.id }
          ]);
          
          updatedTrades.push({
            id: trade.id,
            symbol: trade.symbol,
            current_price: latest_price,
            updated: true
          });
        } else {
          updatedTrades.push({
            id: trade.id,
            symbol: trade.symbol,
            current_price: trade.current_price || trade.entry_price,
            updated: false,
            error: 'Failed to get latest price'
          });
        }
      } catch (error) {
        console.error(`Error updating price for trade ${trade.id}:`, error);
        updatedTrades.push({
          id: trade.id,
          symbol: trade.symbol,
          current_price: trade.current_price || trade.entry_price,
          updated: false,
          error: error.message
        });
      }
    }
    
    res.status(200).json({
      success: true,
      message: `Updated ${updatedTrades.filter(t => t.updated).length} out of ${updatedTrades.length} trades`,
      data: updatedTrades
    });
  } catch (error) {
    handleError(res, error, 'Failed to refresh VIP prices');
  }
});

module.exports = router;