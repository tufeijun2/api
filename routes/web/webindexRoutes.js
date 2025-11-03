const express = require('express');
const router = express.Router();
const moment = require('moment');
const {get_device_fingerprint} = require('../../config/common');
const { select, insert, update, delete: del, count,Web_Trader_UUID, supabase } = require('../../config/supabase');
const { getUserFromSession } = require('../../middleware/auth');
const {get_trader_points_rules,update_user_points} = require('../../config/rulescommon');
// 获取交易员信息数据
router.get('/trader_profiles', async (req, res) => {
  try {
      const Web_Trader_UUID = req.headers['web-trader-uuid'];
      const conditions = [];
      console.log(Web_Trader_UUID)
      conditions.push({ type: 'eq', column: 'trader_uuid', value: Web_Trader_UUID });
      // 加入删除状态筛选
      conditions.push({ type: 'eq', column: 'isdel', value: false });
      // const orderBy = {'column':'id','ascending':false};
      const users = await select('trader_profiles', '*', conditions,
          null,
            null, null
        ) || [];
      res.status(200).json({ 
        success: true, 
        data:{
          trader_profiles: users[0] || {},
        }
      });
  } catch (error) {
    console.error('Error in /trader_profiles:', error);
    res.status(200).json({ 
      success: true, 
      data:{
        trader_profiles: {},
      }
    });
  }
});

// 获取网站首页数据
router.get('/index', async (req, res) => {
  try {
     const Web_Trader_UUID = req.headers['web-trader-uuid'];
      const conditions = [];
     
      conditions.push({ type: 'eq', column: 'trader_uuid', value: Web_Trader_UUID });
      // const orderBy = {'column':'id','ascending':false};
      const users = await select('trader_profiles', '*', conditions,
          null,
            null, null
        ) || [];
      let orderBy = {'column':'updated_at','ascending':false};
      const strategy_info= await select('trading_strategies', '*', conditions,
          1,
            0, orderBy
        ) || [];
       orderBy = {'column':'id','ascending':false};
      // 获取三个月前的日期
      const threeMonthsAgo = moment().subtract(3, 'months').toDate();
      // 复制conditions数组以避免影响其他查询
      const tradeConditions = [...conditions];
      // 添加entry_date为三个月以内的条件
      tradeConditions.push({ type: 'gte', column: 'entry_date', value: threeMonthsAgo });
      let trades= await select('view_trader_trade', '*', tradeConditions,
          null,
            null, orderBy
        ) || [];
       
         // 格式化公告数据
        trades = trades.map(item => ({
            ...item,
            Market_Value:(item.exit_price && item.exit_date)?(item.exit_price * item.size).toFixed(2):(item.current_price * item.size).toFixed(2),
            Ratio: (item.exit_price && item.exit_date)?((item.exit_price-item.entry_price)/item.entry_price * 100).toFixed(2):((item.current_price-item.entry_price)/item.entry_price * 100).toFixed(2),
            Amount: (item.exit_price && item.exit_date)?((item.exit_price-item.entry_price )* item.size*item.direction).toFixed(2):((item.current_price-item.entry_price )* item.size*item.direction).toFixed(2),
            status: (item.exit_price && item.exit_date)?  "Take Profit":"Active",
        }));
        let Monthly=0
        console.log(moment().add(-1, 'month').format('YYYY-MM-01'))
        const exitList= trades.filter((item)=> !item.exit_date || item.exit_date>=moment().format('YYYY-MM-01'))
        console.log(exitList)
         exitList.forEach((item)=>{
          if(item.status!="Active"){
          Monthly+=parseFloat(item.Amount/item.exchange_rate)
          }
        })
        let Total=0;
         const allList= trades.filter((item)=>item.exit_date)
          allList.forEach((item)=>{
            Total+=parseFloat(item.Amount/item.exchange_rate)
          })
      
      // 处理空数据情况
      const traderProfile = users[0] || {};
      if (users.length > 0 && users[0]) {
        traderProfile.total_trades = (traderProfile.total_trades || 0) + trades.length;
      }
      
      res.status(200).json({ 
        success: true, 
        data:{
          trader_profiles: traderProfile,
          strategy_info: strategy_info[0] || null,
          trades: trades,
          Monthly: Monthly.toFixed(2),
          Total: Total.toFixed(2),
        }
      });
  } catch (error) {
    console.error('Error in /index:', error);
    // 返回默认数据而不是500错误
    res.status(200).json({ 
      success: true, 
      data:{
        trader_profiles: {},
        strategy_info: null,
        trades: [],
        Monthly: '0.00',
        Total: '0.00',
      }
    });
  }
});


// 获取whatsapp信息
router.get('/get-whatsapp-link', async (req, res) => {
  try {
    let whatsagent=null;
    const device_fingerprint = get_device_fingerprint(req);
     
     const Web_Trader_UUID = req.headers['web-trader-uuid'];
      let conditions = [];
      
      conditions.push({ type: 'eq', column: 'trader_uuid', value: Web_Trader_UUID });
      conditions.push({ type: 'eq', column: 'device_fingerprint', value: device_fingerprint });
      // const orderBy = {'column':'id','ascending':false};
     
      let existing_record = await select('contact_records', '*', conditions,
          null,
            null, null
        );
       let agent_id=0;
       console.log(existing_record)
      if(existing_record.length>0)
      {
        
       agent_id = existing_record[0].agent_id;
       
      }
      if(existing_record.length<=0)
      {
        
        conditions = [];
        conditions.push({ type: 'eq', column: 'trader_uuid', value: Web_Trader_UUID });
          const all_agent = await select('view_whatsapp_count', '*', conditions,
          1,
            0, null
        );
       console.log(all_agent)
          agent_id = all_agent[0].id;
         if(all_agent.length>0)
          {
           let insert_data = {
                        'device_fingerprint': device_fingerprint,
                        'agent_id': agent_id,
                        'ip_address': req.ip,
                        'user_agent': req.headers['user-agent'],
                        'trader_uuid':Web_Trader_UUID
                    }
            console.log(insert_data)
            await insert('contact_records', insert_data);
          }
      }
       conditions = [];
        conditions.push({ type: 'eq', column: 'trader_uuid', value: Web_Trader_UUID });
        conditions.push({ type: 'eq', column: 'id', value: agent_id });
         console.log(conditions)
         existing_record = await select('whatsapp_agents', '*', conditions,
          null,
            null, null
        );
       console.log(existing_record)
        if(existing_record)
        {
          whatsagent=existing_record[0];
        }
     
      res.status(200).json({ 
        success: true, 
        data: `whatsapp://send?phone=${whatsagent.phone_number}`
      });
  } catch (error) {
    handleError(res, error, 'Failed to fetch data');
  }
});




// 处理错误的辅助函数
const handleError = (res, error, message) => {
  console.error(`[ERROR] ${message}:`, error);
  res.status(500).json({
    success: false,
    message: message || 'Internal Server Error'
  });
};

// 获取公告信息
router.get('/announcement', async (req, res) => {
  try {
    const Web_Trader_UUID = req.headers['web-trader-uuid'];
    // 获取最新的公告
    const conditions = [
      { type: 'eq', column: 'trader_uuid', value: Web_Trader_UUID },
      { type: 'eq', column: 'active', value: true },
      { type: 'eq', column: 'popup_enabled', value: true }
    ];
    const orderBy = { column: 'created_at', ascending: false };
    const announcements = await select('announcements', '*', conditions, 1, 0, orderBy);
    
    if (announcements && announcements.length > 0) {
      const announcement = announcements[0];
      // 处理时间格式
      let formattedDate = '';
      if (announcement.created_at) {
        // 在JavaScript中处理UTC时间转本地时间
        const utcDate = new Date(announcement.created_at);
        formattedDate = moment(utcDate).format('MMM D, YYYY');
      }
      
      res.status(200).json({
        success: true,
        announcement: {
          title: announcement.title || 'Important Notice',
          content: announcement.content || 'Welcome to join our trading community!',
          allow_close_dialog: announcement.allow_close_dialog || false,
          date: formattedDate,
          delay_seconds:announcement.delay_seconds
        }
      });
    } else {
      // 如果没有公告，返回默认内容
      const formattedCurrentDate = moment().format('MMM D, YYYY');
      
      res.status(200).json({
        success: false,
        announcement: {
          title: 'Welcome to Join Exclusive Trading Community',
          content: 'Get real-time trading signal alerts, professional strategy analysis, one-on-one trading guidance, and exclusive market analysis reports. Join our exclusive community now and start your path to investment success!',
          date: formattedCurrentDate,
          allow_close_dialog: true,
          delay_seconds:5
        }
      });
    }
  } catch (error) {
    console.error(`[ERROR] Failed to get announcement:`, error);
    // 返回默认内容
    const formattedCurrentDate = moment().format('MMM D, YYYY');
    
    res.status(200).json({
      success: true,
      announcement: {
        title: 'Welcome to Join Exclusive Trading Community',
        content: 'Get real-time trading signal alerts, professional strategy analysis, one-on-one trading guidance, and exclusive market analysis reports.',
        date: formattedCurrentDate,
        allow_close_dialog: true,
        delay_seconds:5
      }
    });
  }
});


// 获取排行榜数据
router.get('/leaderboard', async (req, res) => {
  try {
      const Web_Trader_UUID = req.headers['web-trader-uuid'];
     let sort=req.query.sort;
      if(!sort)
      {
        sort='profit'
      }
      let sortType='';
      switch(sort)
      {
        case 'profit':
          sortType='total_profit'
          break;
        case 'followers':
          sortType='followers_count'
          break;
        case 'likes':
          sortType='likes_count'
          break;
      }
    
      const conditions = [];
     // 获取登录用户信息
       
      conditions.push({ type: 'eq', column: 'trader_uuid', value: Web_Trader_UUID });

       const orderBy = {'column':sortType,'ascending':false};
      const users = await select('leaderboard_traders', '*', conditions,
          null,
            null, orderBy
        );
      res.status(200).json({ 
        success: true, 
        data:users
      });
  } catch (error) {
    handleError(res, error, '获取数据失败');
  }
});

// 交易员点赞接口
router.post('/like-trader', async (req, res) => {
  try {
    const Web_Trader_UUID = req.headers['web-trader-uuid'];
   
     const user=await getUserFromSession(req);
     if(user)
     {
        const pointsRules = await get_trader_points_rules(req);
        await update_user_points(req,user.id,user.membership_points,pointsRules.likes_points,'Members Use likes');
     }
    // 检查点赞记录
    const device_fingerprint = get_device_fingerprint(req);
      // 更新leaderboard_traders表中的点赞数
      const leaderboardConditions = [
        { type: 'eq', column: 'trader_uuid', value: Web_Trader_UUID }
      ];
      let traderProfile = await select('trader_profiles', '*', leaderboardConditions, 1, 0, null);
      likes_count=traderProfile[0].likes_count+1;
      await update('trader_profiles', { likes_count: likes_count }, leaderboardConditions);
      
      return res.status(200).json({
        success: true,
        message: 'Like successful',
        isLiked: true
      });
    
  } catch (error) {
    handleError(res, error, 'Like operation failed');
  }
});

// leaderboard点赞接口
router.post('/like-leaderboard', async (req, res) => {
  try {
    const Web_Trader_UUID = req.headers['web-trader-uuid'];
    const { id } = req.body;
    const user=await getUserFromSession(req);
     if(user)
     {
        const pointsRules = await get_trader_points_rules(req);
        await update_user_points(req,user.id,user.membership_points,pointsRules.likes_points,'Members Use likes');
     }
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Trader ID cannot be empty'
      });
    }
   
      
      // 更新leaderboard_traders表中的点赞数
      const leaderboardConditions = [
        { type: 'eq', column: 'trader_uuid', value: Web_Trader_UUID },
        { type: 'eq', column: 'id', value: id }
      ];
         let traderProfile = await select('leaderboard_traders', '*', leaderboardConditions, 1, 0, null);
      let likes_count=traderProfile[0].likes_count+1;
      await update('leaderboard_traders', { likes_count: likes_count }, leaderboardConditions);
      
      return res.status(200).json({
        success: true,
        message: 'Like successful',
        isLiked: true
      });
    
  } catch (error) {
    handleError(res, error, 'Like operation failed');
  }
});

module.exports = router;