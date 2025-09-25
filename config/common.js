const crypto = require('crypto');
const axios = require('axios');

// 存储印度股票价格列表
let India_price_List = {};

/**
 * 生成设备指纹
 * @param {Object} request - Express请求对象
 * @returns {string} - 设备指纹哈希值
 */
function get_device_fingerprint(request) {
  if (!request) {
    throw new Error('Request object is required');
  }
  
  const user_agent =  request.headers['user-agent']; 
  const ip = request.ip;
  
  // 可以添加更多设备特征
  const fingerprint_data = `${ip}:${user_agent}`;
  return crypto.createHash('sha256').update(fingerprint_data).digest('hex');
}

/**
 * 获取印度股票价格
 */
async function get_India_price() {
 
  const token = "jggf1-iglcjq-ykgka";
  const url = `http://india-api.allyjp.site/exchange-whitezzzs/lhms-api/list?token=${token}`;
  try {
    const resp = await axios.get(url, { timeout: 15000 });
    const data = resp.data;
    const sdata = data.data;
    for (const item of sdata) {
      try {
        const symbol = item.co.split('.')[0];
        India_price_List[symbol] = item.a;
      } catch (error) {
        // 忽略错误，继续处理下一个项目
      }
    }
  } catch (error) {
    console.error('Error fetching India prices:', error);
    return null;
  }
}

/**
 * 获取实时股票价格
 * @param {string} market - 市场类型 (usa或其他)
 * @param {string} symbol - 股票代码
 * @param {string} asset_type - 资产类型 (可选)
 * @returns {Promise<number|null>} - 实时价格或null
 */
async function get_real_time_price(market, symbol, asset_type = null) {
  symbol = String(symbol).toUpperCase().split(":")[0];
  
  if (market.toLowerCase() === "usa") {
    // 获取美国股票价格
    const api_key = "YIQDtez6a6OhyWsg2xtbRbOUp3Akhlp4";
    
    // 股票查法兜底：asset_type为stock或未传但symbol像股票代码
   
      const url = `https://api.polygon.io/v2/last/trade/${symbol}?apiKey=${api_key}`;
      try {
        const resp = await axios.get(url, { timeout: 5000 });
      
        const data = resp.data;
        let price = null;
        
        if (data.results && typeof data.results.p !== 'undefined') {
          price = data.results.p;
        } else if (data.last && typeof data.last.price !== 'undefined') {
          price = data.last.price;
        }
      
        if (price !== null) {
          return parseFloat(price);
        }
      } catch (error) {
        //console.error(`Error fetching price for ${symbol}:`, error);
        return null;
      }
    
    // 默认返回None
    return null;
  } else {
    // 获取印度股票价格
    try {
      // 如果价格列表为空，尝试获取
      if (Object.keys(India_price_List).length === 0) {
        await get_India_price();
      }
      
      const price_value = India_price_List[symbol.split(".")[0]];
      return price_value !== undefined ? parseFloat(price_value) : null;
    } catch (error) {
      console.error(`Error getting price for ${symbol}:`, error);
      return null;
    }
  }
}

module.exports = {
  get_device_fingerprint,
  get_real_time_price,
  get_India_price
};