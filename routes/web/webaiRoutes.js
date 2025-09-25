const express = require('express');
const router = express.Router();
const { supabase, select, insert, Web_Trader_UUID } = require('../../config/supabase');
const { query } = require('../../config/db');
const { getUserFromSession } = require('../../middleware/auth');
const { get_real_time_price, get_India_price } = require('../../config/common');
// 处理错误的辅助函数
const handleError = (res, error, message) => {
  console.error(message + ':', error);
  res.status(500).json({ success: false, message: 'Internal Server Error', details: error.message });
}

// 股票池数据
const stockPools = {
    'technology': ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'META', 'AMZN', 'CRM', 'ORCL', 'INTC'],
    'healthcare': ['JNJ', 'PFE', 'UNH', 'MRNA', 'ABBV', 'TMO', 'DHR', 'BMY', 'MRK', 'GILD'],
    'finance': ['JPM', 'BAC', 'WFC', 'GS', 'C', 'USB', 'TFC', 'PNC', 'COF', 'AXP'],
    'energy': ['XOM', 'CVX', 'COP', 'EOG', 'SLB', 'PSX', 'VLO', 'MPC', 'OXY', 'DVN'],
    'consumer': ['AMZN', 'TSLA', 'HD', 'MCD', 'NKE', 'SBUX', 'TGT', 'LOW', 'WMT', 'COST'],
    'industrial': ['BA', 'CAT', 'GE', 'HON', 'UPS', 'LMT', 'RTX', 'DE', 'MMM', 'EMR'],
    'utilities': ['NEE', 'DUK', 'SO', 'D', 'EXC', 'XEL', 'SRE', 'AEP', 'PEG', 'ED'],
    'materials': ['LIN', 'APD', 'SHW', 'ECL', 'DD', 'DOW', 'PPG', 'NEM', 'FCX', 'FMC']
};

// 生成随机数的辅助函数
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomFloat(min, max) {
    return Math.random() * (max - min) + min;
}

// 从数组中随机选择指定数量的元素
function randomSample(array, count) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, array.length));
}

// 获取股票综合数据
async function getComprehensiveStockData(symbol) {
    try {
        // 由于是模拟环境，我们返回模拟数据
        // 实际环境中这里应该调用真实的股票数据API
        const mockStockData = {
            symbol: symbol,
            name: `${symbol} Inc.`,
            sector: getRandomSector(symbol),
            current_price: getRandomFloat(50, 500),
            change_percent: getRandomFloat(-5, 5).toFixed(2),
            market_cap: getRandomFloat(50000000000, 2000000000000),
            pe_ratio: getRandomFloat(10, 50).toFixed(2),
            beta: getRandomFloat(0.5, 2).toFixed(2),
            rsi: getRandomInt(30, 70),
            ma_5: getRandomFloat(50, 500).toFixed(2),
            ma_20: getRandomFloat(50, 500).toFixed(2),
            volume_ratio: getRandomFloat(0.5, 3).toFixed(2),
            target_price: getRandomFloat(50, 600).toFixed(2)
        };
        
        return mockStockData;
    } catch (error) {
        console.error(`获取股票数据失败 ${symbol}:`, error);
        return null;
    }
}

// 根据股票代码获取行业（模拟）
function getRandomSector(symbol) {
    const sectors = Object.keys(stockPools);
    for (const [sector, symbols] of Object.entries(stockPools)) {
        if (symbols.includes(symbol)) {
            return sector;
        }
    }
    return sectors[Math.floor(Math.random() * sectors.length)];
}

// 计算AI评分
function calculateAiScore(stockData, style, risk, timeHorizon) {
    // 基础分数
    let baseScore = getRandomInt(60, 95);
    
    // 根据不同参数调整分数
    if (style === 'growth' && parseFloat(stockData.pe_ratio) > 30) {
        baseScore += 5;
    } else if (style === 'value' && parseFloat(stockData.pe_ratio) < 20) {
        baseScore += 5;
    }
    
    if (risk === 'low' && parseFloat(stockData.beta) < 1.0) {
        baseScore += 3;
    } else if (risk === 'high' && parseFloat(stockData.beta) > 1.5) {
        baseScore += 3;
    }
    
    // 确保分数在0-100之间
    return Math.min(100, Math.max(0, baseScore));
}

// 生成专业分析
function generateProfessionalAnalysis(stockData, style, score) {
    const currentPrice = parseFloat(stockData.current_price);
    const peRatio = parseFloat(stockData.pe_ratio);
    const beta = parseFloat(stockData.beta);
    
    let analysisParts = [];
    
    // 技术面分析
    if (score >= 80) {
        analysisParts.push('技术面表现强劲，多个指标发出买入信号，短期有上涨潜力。');
    } else if (score >= 60) {
        analysisParts.push('技术面整体向好，支撑位稳固，可考虑适度配置。');
    } else {
        analysisParts.push('技术面信号混杂，建议保持观望或分批建仓。');
    }
    
    // 估值分析
    if (peRatio > 0) {
        if (peRatio < 15) {
            analysisParts.push(`市盈率${peRatio}倍，估值偏低，具备投资价值。`);
        } else if (peRatio < 25) {
            analysisParts.push(`市盈率${peRatio}倍，估值合理，符合行业平均水平。`);
        } else {
            analysisParts.push(`市盈率${peRatio}倍，估值较高，需关注基本面支撑。`);
        }
    }
    
    // 风险评估
    if (beta < 0.8) {
        analysisParts.push(`Beta系数${beta}，波动性较低，适合风险偏好保守的投资者。`);
    } else if (beta < 1.5) {
        analysisParts.push(`Beta系数${beta}，波动性适中，风险可控。`);
    } else {
        analysisParts.push(`Beta系数${beta}，波动性较高，建议控制仓位。`);
    }
    
    return analysisParts.join(' ');
}

// 生成股票推荐
async function generateStockRecommendations(sector, style, risk, timeHorizon,req) {
    try {
        // 选择股票池
        let selectedSymbols;
        if (!sector) {
            // 如果没有指定行业，从所有股票中随机选择
            const allSymbols = [];
            for (const symbols of Object.values(stockPools)) {
                allSymbols.push(...symbols);
            }
            selectedSymbols = randomSample(allSymbols, 8);
        } else {
            // 根据指定行业选择股票
            const availableSymbols = stockPools[sector] || [];
            if (availableSymbols.length === 0) {
                return [];
            }
            selectedSymbols = randomSample(availableSymbols, 6);
        }
        
        console.log(`[DEBUG] Analyzing stocks: ${selectedSymbols.join(', ')}`);
        
        const recommendations = [];
        
        for (const symbol of selectedSymbols) {
            try {
                console.log(`[DEBUG] 获取 ${symbol} 的数据...`);
                
                // 获取股票数据
                const stockData = await getComprehensiveStockData(symbol);
                if (!stockData) {
                    continue;
                }
                
                // 计算AI评分
                const score = calculateAiScore(stockData, style, risk, timeHorizon);
                
                // 生成专业分析
                const professionalAnalysis = generateProfessionalAnalysis(stockData, style, score);
                
                // 计算预期收益
                const currentPrice = parseFloat(stockData.current_price);
                const targetPrice = parseFloat(stockData.target_price);
                let expectedReturn;
                
                if (targetPrice > 0) {
                    expectedReturn = ((targetPrice - currentPrice) / currentPrice * 100).toFixed(1);
                } else {
                    // 基于评分估算收益
                    expectedReturn = ((score - 50) * 0.5 + getRandomFloat(-5, 5)).toFixed(1);
                }
                
                const recommendation = {
                    symbol: symbol,
                    name: stockData.name,
                    sector: stockData.sector,
                    score: score,
                    reason: professionalAnalysis,
                    expectedReturn: Math.max(parseFloat(expectedReturn), -30).toString(), // 限制最大亏损显示
                    riskLevel: risk.charAt(0).toUpperCase() + risk.slice(1),
                    current_price: currentPrice,
                    change_percent: parseFloat(stockData.change_percent),
                    market_cap: stockData.market_cap,
                    pe_ratio: parseFloat(stockData.pe_ratio),
                    volume_ratio: parseFloat(stockData.volume_ratio)
                };
                        // 获取登录用户信息
                const user = await getUserFromSession(req);
                // 获取用户ID（从会话中获取，实际环境需要根据实际情况调整）
                let userId = null;
                try {
                    // 注意：这里需要根据实际的认证机制来获取用户ID
                    // 例如从请求的session或token中获取
                     userId = user.id
                } catch (error) {
                   
                }
                
                // 保存到数据库
                const aiStockPickerData = {
                    trader_uuid: req.headers['web-trader-uuid'],
                    userid: userId,
                    market: 'USA',
                    symbols: symbol,
                    put_price: currentPrice,
                    currprice: currentPrice,
                    target_price: targetPrice,
                    upside: Math.max(parseFloat(expectedReturn), -30).toString(),
                    out_info: JSON.stringify(recommendation)
                };
                try {
                    await insert('ai_stock_picker', aiStockPickerData);
                } catch (dbError) {
                    console.error(`保存推荐结果失败 ${symbol}:`, dbError);
                    // 继续处理，不中断流程
                }
                
                recommendations.push(recommendation);
                console.log(`[DEBUG] ${symbol} 分析完成，评分: ${score}`);
                
            } catch (error) {
                console.error(`[ERROR] 分析股票 ${symbol} 时出错:`, error);
                continue;
            }
        }
        
        // 按评分排序
        recommendations.sort((a, b) => b.score - a.score);
        
        console.log(`[DEBUG] 共生成 ${recommendations.length} 个推荐`);
        return recommendations.slice(0, 5); // 返回前5个推荐
        
    } catch (error) {
        console.error('[ERROR] 生成股票推荐失败:', error);
        return [];
    }
}

// AI Stock Picker API
router.post('/stock-picker', async (req, res) => {
    try {
        const data = req.body;
        
        // 获取用户输入的选股标准
        const sector = data.sector || '';
        const style = data.style || 'balanced';
        const risk = data.risk || 'medium';
        const timeHorizon = data.timeHorizon || 'medium';
        
        console.log(`[DEBUG] AI stock picker request: sector=${sector}, style=${style}, risk=${risk}, time_horizon=${timeHorizon}`);
        
        // 生成股票推荐
        const recommendations = await generateStockRecommendations(sector, style, risk, timeHorizon,req);
        
        return res.json({
            success: true,
            recommendations: recommendations,
            criteria: {
                sector: sector,
                style: style,
                risk: risk,
                timeHorizon: timeHorizon
            }
        });
        
    } catch (error) {
        console.error('[ERROR] AI stock picker API error:', error);
        return res.status(500).json({ error: 'Failed to generate stock recommendations' });
    }
});

// 计算持仓评分
function calculatePortfolioScore(stockData, portfolioPerformance) {
    let baseScore = 50;
    
    // 基于技术指标调整
    if (stockData) {
        const rsi = parseInt(stockData.rsi) || 50;
        const peRatio = parseFloat(stockData.pe_ratio) || 25;
        const currentPrice = parseFloat(stockData.current_price) || 0;
        const ma5 = parseFloat(stockData.ma_5) || currentPrice;
        const ma20 = parseFloat(stockData.ma_20) || currentPrice;
        
        // RSI评分
        if (rsi >= 30 && rsi <= 70) {
            baseScore += 10;
        } else if (rsi > 70) {
            baseScore -= 5;
        } else if (rsi < 30) {
            baseScore += 5;
        }
        
        // PE比率评分
        if (peRatio >= 10 && peRatio <= 25) {
            baseScore += 10;
        } else if (peRatio > 40) {
            baseScore -= 10;
        }
        
        // 均线位置
        if (currentPrice > ma5 && ma5 > ma20) {
            baseScore += 15;
        } else if (currentPrice < ma5 && ma5 < ma20) {
            baseScore -= 15;
        }
    }
    
    // 基于持仓表现调整
    if (portfolioPerformance) {
        const totalReturn = parseFloat(portfolioPerformance.totalReturn) || 0;
        const holdingDays = parseInt(portfolioPerformance.holdingDays) || 0;
        
        // 收益率调整
        if (totalReturn > 20) {
            baseScore += 20;
        } else if (totalReturn > 10) {
            baseScore += 15;
        } else if (totalReturn > 0) {
            baseScore += 10;
        } else if (totalReturn < -20) {
            baseScore -= 20;
        } else if (totalReturn < -10) {
            baseScore -= 10;
        }
        
        // 持仓时间调整
        if (holdingDays > 365) {
            baseScore += 5;
        } else if (holdingDays < 30) {
            baseScore -= 5;
        }
    }
    
    return Math.max(0, Math.min(100, baseScore));
}

// 解析GPT持仓分析文本
function parsePortfolioAnalysis(gptText, score) {
    const sections = [];
    const lines = gptText.split('\n').filter(line => line.trim());
    const contentText = lines.join(' ');
    
    if (contentText.length > 200) {
        const midPoint = Math.floor(contentText.length / 2);
        sections.push({
            'title': '持仓分析',
            'score': Math.min(100, score + getRandomInt(-10, 10)),
            'content': contentText.substring(0, midPoint)
        });
        sections.push({
            'title': '投资建议',
            'score': Math.min(100, score + getRandomInt(-5, 15)),
            'content': contentText.substring(midPoint)
        });
    } else {
        sections.push({
            'title': '综合分析',
            'score': score,
            'content': contentText
        });
    }
    
    return sections;
}

// 生成备用持仓诊断
function generateFallbackPortfolioDiagnosis(symbol, purchasePrice = null, purchaseDate = null, portfolioPerformance = null) {
    const score = getRandomInt(45, 85);
    
    const diagnosis = {
        'symbol': symbol,
        'overallScore': score,
        'summary': `${symbol} analysis based on current market data, overall score: ${score}/100.`,
        'portfolioPerformance': portfolioPerformance,
        'sections': [
            {
                'title': 'Technical Analysis',
                'score': getRandomInt(40, 90),
                'content': `${symbol} technical indicators show the stock is currently in a ${getRandomInt(0, 1) ? 'relatively strong' : 'consolidation'} phase.`
            },
            {
                'title': 'Investment Recommendation',
                'score': getRandomInt(50, 95),
                'content': `Based on current market conditions, recommend to ${getRandomInt(0, 1) ? 'maintain current position' : 'adjust position appropriately'}.`
            }
        ]
    };
    
    return diagnosis;
}

// 生成持仓诊断
async function generatePortfolioDiagnosis(symbol, purchasePrice, purchaseDate, purchaseMarket, analysisType) {
    try {
        // 获取当前股票数据
        const stockData = await getComprehensiveStockData(symbol);
        if (!stockData) {
            return generateFallbackPortfolioDiagnosis(symbol, purchasePrice, purchaseDate);
        }
        
        const currentPrice = parseFloat(stockData.current_price);
        
        // 计算持仓表现
        let portfolioPerformance = null;
        let holdingDays = 0;
        let totalReturn = 0;
        
        if (purchasePrice && purchaseDate) {
            try {
                const purchaseDt = new Date(purchaseDate);
                const currentDt = new Date();
                holdingDays = Math.floor((currentDt - purchaseDt) / (1000 * 60 * 60 * 24));
                
                if (parseFloat(purchasePrice) > 0) {
                    totalReturn = ((currentPrice - parseFloat(purchasePrice)) / parseFloat(purchasePrice)) * 100;
                }
                
                portfolioPerformance = {
                    'purchasePrice': parseFloat(purchasePrice),
                    'currentPrice': currentPrice,
                    'totalReturn': totalReturn,
                    'holdingDays': holdingDays,
                    'purchaseDate': purchaseDate,
                    'purchaseMarket': purchaseMarket
                };
            } catch (error) {
                console.error(`[WARNING] 持仓计算失败:`, error);
            }
        }
        
        // 由于是模拟环境，我们直接生成模拟的分析结果
        // 实际环境中这里应该调用GPT API进行分析
        const mockAnalysis = generateMockPortfolioAnalysis(symbol, stockData, portfolioPerformance);
        
        // 计算评分
        const overallScore = calculatePortfolioScore(stockData, portfolioPerformance);
        
        // 构建诊断结果
        const diagnosis = {
            'symbol': symbol,
            'overallScore': overallScore,
            'summary': `${symbol} comprehensive analysis score: ${overallScore}/100. ${mockAnalysis.substring(0, 100)}${mockAnalysis.length > 100 ? '...' : ''}`,
            'portfolioPerformance': portfolioPerformance,
            'sections': parsePortfolioAnalysis(mockAnalysis, overallScore)
        };
        
        console.log(`[DEBUG] Portfolio diagnosis ${symbol}: Score ${overallScore}, Portfolio return ${totalReturn.toFixed(2)}%`);
        return diagnosis;
        
    } catch (error) {
        console.error(`[ERROR] 持仓诊断失败 ${symbol}:`, error);
        return generateFallbackPortfolioDiagnosis(symbol, purchasePrice, purchaseDate);
    }
}

// 生成模拟持仓分析（替代GPT API）
function generateMockPortfolioAnalysis(symbol, stockData, portfolioPerformance) {
    const currentPrice = parseFloat(stockData.current_price);
    const marketCap = parseFloat(stockData.market_cap);
    const peRatio = parseFloat(stockData.pe_ratio);
    const beta = parseFloat(stockData.beta);
    const rsi = parseInt(stockData.rsi);
    
    let analysis = [];
    
    // 持仓表现评估
    if (portfolioPerformance) {
        const totalReturn = portfolioPerformance.totalReturn;
        const holdingDays = portfolioPerformance.holdingDays;
        
        let returnStatus = 'neutral';
        if (totalReturn > 10) returnStatus = 'positive';
        else if (totalReturn < -5) returnStatus = 'negative';
        
        let returnDesc = '';
        switch(returnStatus) {
            case 'positive':
                returnDesc = `The holding has generated a solid return of ${totalReturn.toFixed(2)}% over ${holdingDays} days of holding. This demonstrates successful stock selection.`;
                break;
            case 'negative':
                returnDesc = `The holding has experienced a loss of ${Math.abs(totalReturn).toFixed(2)}% over ${holdingDays} days. This underperformance may require reassessment.`;
                break;
            default:
                returnDesc = `The holding has generated a return of ${totalReturn.toFixed(2)}% over ${holdingDays} days, which aligns with market expectations.`;
        }
        
        analysis.push(`Portfolio Performance Assessment: ${returnDesc}`);
    }
    
    // 当前市场位置
    let marketPosition = `Current Market Position: ${symbol} is currently trading at $${currentPrice.toFixed(2)} with a market cap of $${(marketCap / 1000000000).toFixed(1)}B. `;
    
    if (peRatio > 0) {
        if (peRatio < 15) {
            marketPosition += `The P/E ratio of ${peRatio.toFixed(1)} indicates the stock may be undervalued. `;
        } else if (peRatio < 25) {
            marketPosition += `The P/E ratio of ${peRatio.toFixed(1)} reflects a fair valuation relative to sector peers. `;
        } else {
            marketPosition += `The P/E ratio of ${peRatio.toFixed(1)} suggests the stock is trading at a premium valuation. `;
        }
    }
    
    if (beta < 0.8) {
        marketPosition += `With a beta of ${beta.toFixed(2)}, the stock exhibits lower volatility than the broader market.`;
    } else if (beta < 1.3) {
        marketPosition += `The beta of ${beta.toFixed(2)} indicates volatility comparable to the overall market.`;
    } else {
        marketPosition += `The stock has a beta of ${beta.toFixed(2)}, implying higher volatility and potential for larger price swings.`;
    }
    
    analysis.push(marketPosition);
    
    // 技术面分析
    let techAnalysis = `Technical Analysis: `;
    if (rsi < 30) {
        techAnalysis += `RSI is at ${rsi}, indicating the stock may be oversold and a bounce could be imminent. `;
    } else if (rsi > 70) {
        techAnalysis += `RSI is at ${rsi}, suggesting the stock may be overbought and due for a pullback. `;
    } else {
        techAnalysis += `RSI is at ${rsi}, indicating balanced buying and selling pressure. `;
    }
    
    techAnalysis += getRandomInt(0, 1) ? 
        'Recent price action shows signs of accumulation with increasing volume on up days.' : 
        'Trading volume has been below average, indicating limited conviction in current price movements.';
    
    analysis.push(techAnalysis);
    
    // 投资建议
    let recommendation = `Investment Recommendation: `;
    const randomChoice = getRandomInt(0, 2);
    if (randomChoice === 0) {
        recommendation += 'Maintain current position. The stock continues to demonstrate solid fundamentals and technical strength.';
    } else if (randomChoice === 1) {
        recommendation += 'Consider reducing position size. While the long-term outlook remains positive, short-term overbought conditions suggest potential for a correction.';
    } else {
        recommendation += 'Hold with a stop-loss order. Maintain current exposure but protect downside risk with a stop-loss at 5-8% below current levels.';
    }
    
    analysis.push(recommendation);
    
    return analysis.join('\n');
}

// AI Portfolio Diagnosis API
router.post('/portfolio-diagnosis', async (req, res) => {
    try {
        const data = req.body;
        
        // 获取用户输入的持仓信息
        const symbol = data.symbol || '';
        const purchasePrice = data.purchasePrice || '';
        const purchaseDate = data.purchaseDate || '';
        const purchaseMarket = data.purchaseMarket || 'USA';
        const analysisType = data.analysisType || 'comprehensive';
        
        if (!symbol) {
            return res.status(400).json({ error: 'Stock symbol is required' });
        }
        
        console.log(`[DEBUG] AI portfolio diagnosis request: symbol=${symbol}, purchase_price=${purchasePrice}, purchase_date=${purchaseDate}, market=${purchaseMarket}`);
        
        // 生成持仓诊断
        const diagnosis = await generatePortfolioDiagnosis(symbol, purchasePrice, purchaseDate, purchaseMarket, analysisType);
        
        return res.json({
            success: true,
            diagnosis: diagnosis
        });
        
    } catch (error) {
        console.error('[ERROR] AI portfolio diagnosis API error:', error);
        return res.status(500).json({ error: 'Failed to generate portfolio diagnosis' });
    }
});

// AI推荐历史功能接口
router.get('/apihistory', async (req, res) => {
    try {
        const webTraderUUID = req.headers['web-trader-uuid'] || Web_Trader_UUID;
        const userToken = req.headers['session-token'];
        
        if (!userToken) {
            return res.status(401).json({ success: false, message: 'User not logged in' });
        }
        
        // 获取登录用户信息
        const user = await getUserFromSession(req);
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'Invalid user session' });
        }
        
        const conditions = [];
         conditions.push({ type: 'eq', column: 'trader_uuid', value: webTraderUUID });
        conditions.push({ type: 'eq', column: 'userid', value: user.id });
        
        // 查询用户的AI选股历史
        const historyList = await select('ai_stock_picker', '*', conditions, null,null, { column: 'put_time', ascending: false });
        
        // 为每条历史记录添加实时价格信息（这里使用模拟数据）
        for (const item of historyList) {
            console.log(item)
            // 模拟获取实时价格
            const mockPrice =await get_real_time_price(item.market,item.symbols);
            
            item.currprice = parseFloat(mockPrice);
            
            // 解析out_info字段
            try {
                item.out_info = JSON.parse(item.out_info);
            } catch (e) {
                item.out_info = {};
            }
        }
        
        res.status(200).json({
            success: true,
            data: historyList
        });
        
    } catch (error) {
        handleError(res, error, '获取AI推荐历史失败');
    }
});

module.exports = router;