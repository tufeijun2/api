const express = require('express');
const router = express.Router();
const { supabase, select, insert, Web_Trader_UUID, update } = require('../../config/supabase');
const { query } = require('../../config/db');
const { getUserFromSession } = require('../../middleware/auth');
const { get_real_time_price, get_India_price } = require('../../config/common');
const {get_trader_points_rules,update_user_points} = require('../../config/rulescommon');
const { generateStockAnalysis, generateInvestmentSummary } = require('../../utils/gptService');
// // const yfinance = require('yahoo-finance2').default; // 暂时注释掉，使用get_real_time_price替代 // 暂时注释掉，使用get_real_time_price替代
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
        // 获取真实股票价格
        const { get_real_time_price } = require('../../config/common');
        const realPrice = await get_real_time_price('usa', symbol);
        
        // 如果获取到真实价格，使用真实数据
        if (realPrice && realPrice > 0) {
            const realStockData = {
                symbol: symbol,
                name: `${symbol} Inc.`,
                sector: getRandomSector(symbol),
                current_price: realPrice,
                change_percent: getRandomFloat(-5, 5).toFixed(2),
                market_cap: getRandomFloat(50000000000, 2000000000000),
                pe_ratio: getRandomFloat(10, 50).toFixed(2),
                beta: getRandomFloat(0.5, 2).toFixed(2),
                rsi: getRandomInt(30, 70),
                ma_5: getRandomFloat(realPrice * 0.8, realPrice * 1.2).toFixed(2),
                ma_20: getRandomFloat(realPrice * 0.8, realPrice * 1.2).toFixed(2),
                volume_ratio: getRandomFloat(0.5, 3).toFixed(2),
                target_price: getRandomFloat(realPrice * 0.9, realPrice * 1.5).toFixed(2)
            };
            
            return realStockData;
        }
        
        // 如果无法获取真实价格，使用模拟数据作为备选
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

// 生成随机浮点数
function getRandomFloat(min, max) {
    return Math.random() * (max - min) + min;
}

// 生成随机整数
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
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

// 辅助函数：计算建议仓位
function calculateSuggestedPosition(score, risk, investmentAmount) {
    let basePosition = 0;
    
    // 基于评分计算基础仓位
    if (score >= 80) {
        basePosition = 20;
    } else if (score >= 70) {
        basePosition = 15;
    } else if (score >= 60) {
        basePosition = 10;
    } else {
        basePosition = 5;
    }
    
    // 基于风险等级调整
    if (risk === 'high') {
        basePosition = Math.min(basePosition, 10);
    } else if (risk === 'low') {
        basePosition = Math.min(basePosition, 15);
    }
    
    return basePosition;
}

// 辅助函数：获取止损百分比
function getStopLossPercentage(risk) {
    switch (risk) {
        case 'high': return 0.15; // 15%
        case 'medium': return 0.10; // 10%
        case 'low': return 0.05; // 5%
        default: return 0.10;
    }
}

// 辅助函数：获取建议操作
function getRecommendedAction(score) {
    if (score >= 75) return 'Buy';
    if (score >= 60) return 'Hold';
    if (score >= 40) return 'Watch';
    return 'Avoid';
}

// 辅助函数：获取持有周期
function getHoldingPeriod(timeHorizon) {
    switch (timeHorizon) {
        case 'short': return '1-3 months';
        case 'medium': return '3-12 months';
        case 'long': return '1-3 years';
        default: return '3-6 months';
    }
}

// 辅助函数：获取主营业务描述
function getMainBusinessDescription(symbol, sector) {
    const businessDescriptions = {
        'AAPL': 'Consumer electronics, software, and services including iPhone, iPad, Mac, and Apple Services',
        'MSFT': 'Cloud computing, productivity software, and AI services including Azure and Office 365',
        'GOOGL': 'Search engine, advertising, cloud computing, and AI technologies',
        'NVDA': 'Graphics processing units (GPUs) and AI computing platforms',
        'TSLA': 'Electric vehicles, energy storage, and solar panel manufacturing',
        'META': 'Social media platforms, virtual reality, and digital advertising',
        'AMZN': 'E-commerce, cloud computing (AWS), and digital streaming services',
        'JPM': 'Investment banking, commercial banking, and asset management',
        'JNJ': 'Pharmaceuticals, medical devices, and consumer health products',
        'XOM': 'Oil and gas exploration, production, and refining'
    };
    
    return businessDescriptions[symbol] || `${sector} industry leader with diversified business operations`;
}

// 辅助函数：获取财务表现描述
function getFinancialPerformanceDescription(stockData) {
    const peRatio = parseFloat(stockData.pe_ratio);
    const changePercent = parseFloat(stockData.change_percent);
    
    let performance = '';
    
    if (peRatio > 0 && peRatio < 20) {
        performance += 'Attractive valuation with reasonable P/E ratio. ';
    } else if (peRatio > 20 && peRatio < 30) {
        performance += 'Moderate valuation in line with market expectations. ';
    } else if (peRatio > 30) {
        performance += 'Higher valuation requiring strong growth justification. ';
    }
    
    if (changePercent > 10) {
        performance += 'Strong recent performance with significant upside momentum.';
    } else if (changePercent > 0) {
        performance += 'Positive recent performance with steady growth.';
    } else if (changePercent > -10) {
        performance += 'Mixed recent performance with some volatility.';
    } else {
        performance += 'Challenging recent performance requiring careful evaluation.';
    }
    
    return performance;
}

// 辅助函数：获取竞争优势
function getCompetitiveAdvantages(symbol, sector) {
    const advantages = {
        'AAPL': 'Strong brand loyalty, ecosystem lock-in, and premium pricing power',
        'MSFT': 'Enterprise market dominance, cloud leadership, and AI integration',
        'GOOGL': 'Search monopoly, data advantage, and AI research leadership',
        'NVDA': 'GPU market dominance, AI chip leadership, and CUDA ecosystem',
        'TSLA': 'EV market leadership, battery technology, and autonomous driving',
        'META': 'Social media network effects, VR/AR innovation, and advertising reach',
        'AMZN': 'E-commerce scale, AWS cloud leadership, and logistics network',
        'JPM': 'Investment banking leadership, diversified revenue, and risk management',
        'JNJ': 'Pharmaceutical pipeline, medical device innovation, and global reach',
        'XOM': 'Integrated operations, scale advantages, and energy transition investments'
    };
    
    return advantages[symbol] || `Strong market position in ${sector} with competitive advantages`;
}

// 辅助函数：获取短期风险
function getShortTermRisks(symbol, risk) {
    const riskLevel = risk.toLowerCase();
    let risks = '';
    
    if (riskLevel === 'high') {
        risks = 'High volatility, market sensitivity, and potential for significant price swings';
    } else if (riskLevel === 'medium') {
        risks = 'Moderate volatility with some market sensitivity and earnings dependency';
    } else {
        risks = 'Lower volatility but still subject to market conditions and sector trends';
    }
    
    return risks;
}

// 辅助函数：获取长期风险
function getLongTermRisks(symbol, sector) {
    const sectorRisks = {
        'technology': 'Technology disruption, regulatory changes, and competitive pressures',
        'healthcare': 'Regulatory approval risks, patent expirations, and healthcare policy changes',
        'finance': 'Interest rate sensitivity, regulatory changes, and economic cycles',
        'energy': 'Commodity price volatility, environmental regulations, and energy transition',
        'consumer': 'Consumer spending patterns, economic cycles, and brand competition',
        'industrial': 'Economic cycles, supply chain disruptions, and capital spending patterns',
        'utilities': 'Regulatory changes, interest rate sensitivity, and infrastructure investments',
        'materials': 'Commodity price volatility, economic cycles, and environmental regulations'
    };
    
    return sectorRisks[sector] || 'Industry-specific risks and broader market conditions';
}

// 生成整体投资策略
function generateOverallStrategy(recommendations, criteria) {
    const { investmentAmount, risk, timeHorizon, sector } = criteria;
    
    // 计算总建议仓位
    const totalSuggestedPosition = recommendations.reduce((sum, rec) => {
        return sum + (rec.investmentAdvice?.suggestedPosition || 0);
    }, 0);
    
    // 生成仓位分配建议
    const positionAllocation = recommendations.map(rec => {
        const amount = (investmentAmount * (rec.investmentAdvice?.suggestedPosition || 0) / 100);
        return `${rec.symbol}: ${rec.investmentAdvice?.suggestedPosition || 0}% ($${amount.toFixed(0)})`;
    }).join(', ');
    
    // 生成风险管理建议
    const riskManagement = generateRiskManagementAdvice(risk, recommendations);
    
    // 生成交易策略
    const tradingStrategy = generateTradingStrategy(timeHorizon, sector, risk);
    
    return {
        positionAllocation: `Total allocation: ${totalSuggestedPosition}% of portfolio. Individual positions: ${positionAllocation}`,
        riskManagement: riskManagement,
        tradingStrategy: tradingStrategy
    };
}

// 生成风险管理建议
function generateRiskManagementAdvice(risk, recommendations) {
    const riskLevel = risk.toLowerCase();
    let advice = '';
    
    if (riskLevel === 'high') {
        advice = 'Set strict stop-losses at 15% below entry price. Monitor positions daily and consider reducing exposure during high volatility periods.';
    } else if (riskLevel === 'medium') {
        advice = 'Set stop-losses at 10% below entry price. Regular portfolio rebalancing quarterly. Monitor market conditions and adjust positions accordingly.';
    } else {
        advice = 'Conservative stop-losses at 5% below entry price. Focus on quality companies with strong fundamentals. Regular portfolio review every 6 months.';
    }
    
    return advice;
}

// 生成交易策略
function generateTradingStrategy(timeHorizon, sector, risk) {
    const horizon = timeHorizon.toLowerCase();
    let strategy = '';
    
    if (horizon === 'short') {
        strategy = 'Focus on short-term momentum and technical indicators. Monitor earnings announcements and sector news closely. Consider quick profit-taking on 20%+ gains.';
    } else if (horizon === 'medium') {
        strategy = 'Balance between fundamental analysis and technical trends. Hold positions through quarterly earnings cycles. Rebalance portfolio every 3-6 months.';
    } else {
        strategy = 'Focus on long-term value creation and fundamental analysis. Hold through market cycles. Annual portfolio review and rebalancing.';
    }
    
    return strategy;
}

// 解析GPT生成的结构化策略
function parseGPTStrategy(gptResponse) {
    try {
        // 如果GPT返回的是结构化文本，尝试解析
        const lines = gptResponse.split('\n');
        let positionAllocation = '';
        let riskManagement = '';
        let tradingStrategy = '';
        
        let currentSection = '';
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            if (trimmedLine.includes('**Position Allocation**')) {
                currentSection = 'position';
                continue;
            } else if (trimmedLine.includes('**Risk Management**')) {
                currentSection = 'risk';
                continue;
            } else if (trimmedLine.includes('**Trading Strategy**')) {
                currentSection = 'trading';
                continue;
            }
            
            if (currentSection === 'position' && trimmedLine) {
                positionAllocation += trimmedLine + ' ';
            } else if (currentSection === 'risk' && trimmedLine) {
                riskManagement += trimmedLine + ' ';
            } else if (currentSection === 'trading' && trimmedLine) {
                tradingStrategy += trimmedLine + ' ';
            }
        }
        
        return {
            positionAllocation: positionAllocation.trim() || 'Portfolio allocation based on risk tolerance and investment preferences.',
            riskManagement: riskManagement.trim() || 'Implement stop-losses and regular portfolio rebalancing.',
            tradingStrategy: tradingStrategy.trim() || 'Follow systematic entry and exit strategies based on market conditions.'
        };
    } catch (error) {
        console.error('Error parsing GPT strategy:', error);
        return {
            positionAllocation: 'Portfolio allocation based on risk tolerance and investment preferences.',
            riskManagement: 'Implement stop-losses and regular portfolio rebalancing.',
            tradingStrategy: 'Follow systematic entry and exit strategies based on market conditions.'
        };
    }
}

// 生成专业分析
function generateProfessionalAnalysis(stockData, style, score) {
    const currentPrice = parseFloat(stockData.current_price);
    const peRatio = parseFloat(stockData.pe_ratio);
    const beta = parseFloat(stockData.beta);
    
    let analysisParts = [];
    
    // Technical Analysis
    if (score >= 80) {
        analysisParts.push('Technical indicators show strong bullish signals with multiple buy signals, indicating short-term upside potential.');
    } else if (score >= 60) {
        analysisParts.push('Technical analysis shows overall positive trend with stable support levels, consider moderate allocation.');
    } else {
        analysisParts.push('Technical signals are mixed, recommend maintaining caution or phased entry strategy.');
    }
    
    // Valuation Analysis
    if (peRatio > 0) {
        if (peRatio < 15) {
            analysisParts.push(`P/E ratio of ${peRatio} indicates undervalued stock with investment potential.`);
        } else if (peRatio < 25) {
            analysisParts.push(`P/E ratio of ${peRatio} indicates reasonable valuation in line with industry average.`);
        } else {
            analysisParts.push(`P/E ratio of ${peRatio} indicates higher valuation, monitor fundamental support.`);
        }
    }
    
    // Risk Assessment
    if (beta < 0.8) {
        analysisParts.push(`Beta coefficient of ${beta} suggests lower volatility, suitable for conservative investors.`);
    } else if (beta < 1.5) {
        analysisParts.push(`Beta coefficient of ${beta} suggests moderate volatility with controllable risk.`);
    } else {
        analysisParts.push(`Beta coefficient of ${beta} suggests higher volatility, recommend controlled position sizing.`);
    }
    
    return analysisParts.join(' ');
}

// 生成股票推荐
async function generateStockRecommendations(sector, style, risk, timeHorizon, investmentAmount, req) {
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
                
                // 使用GPT生成专业分析
                const criteria = { style, risk, timeHorizon, investmentAmount };
                const gptAnalysis = await generateStockAnalysis(stockData, 'stock-picker', criteria);
                const professionalAnalysis = gptAnalysis || generateProfessionalAnalysis(stockData, style, score);
                
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
                
                // 计算建议仓位（基于投资金额）
                const suggestedPosition = calculateSuggestedPosition(score, risk, investmentAmount);
                
                // 计算目标价格和止损价格
                const calculatedTargetPrice = targetPrice > 0 ? targetPrice : currentPrice * (1 + parseFloat(expectedReturn) / 100);
                const stopLossPrice = currentPrice * (1 - getStopLossPercentage(risk));
                
                const recommendation = {
                    symbol: symbol,
                    companyName: stockData.name,
                    industry: stockData.sector,
                    currentPrice: currentPrice,
                    marketCap: stockData.market_cap,
                    peRatio: parseFloat(stockData.pe_ratio),
                    week52Change: stockData.change_percent + '%',
                    
                    // 公司基本面
                    fundamentals: {
                        mainBusiness: getMainBusinessDescription(symbol, stockData.sector),
                        financialPerformance: getFinancialPerformanceDescription(stockData),
                        competitiveAdvantages: getCompetitiveAdvantages(symbol, stockData.sector)
                    },
                    
                    // 投资建议
                    investmentAdvice: {
                        recommendedAction: getRecommendedAction(score),
                        targetPrice: calculatedTargetPrice,
                        stopLoss: stopLossPrice,
                        suggestedPosition: suggestedPosition,
                        holdingPeriod: getHoldingPeriod(timeHorizon)
                    },
                    
                    // 风险评估
                    riskAssessment: {
                        shortTermRisks: getShortTermRisks(symbol, risk),
                        longTermRisks: getLongTermRisks(symbol, stockData.sector),
                        riskLevel: risk.charAt(0).toUpperCase() + risk.slice(1)
                    },
                    
                    // 保留原有字段用于兼容性
                    name: stockData.name,
                    sector: stockData.sector,
                    score: score,
                    reason: professionalAnalysis,
                    expectedReturn: Math.max(parseFloat(expectedReturn), -30).toString(),
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
         // 获取用户积分规则
        const pointsRules = await get_trader_points_rules(req);
        const user=await getUserFromSession(req);
        if(user)
        {
            if(user.membership_points<pointsRules.ai_recommended_consumption)
            {
                return res.status(200).json({ success: false, error: 'Insufficient user points, unable to use AI recommendation function' });
            }
        }
        
        // 获取用户输入的选股标准
        const sector = data.sector || '';
        const style = data.style || 'balanced';
        const risk = data.risk || 'medium';
        const timeHorizon = data.timeHorizon || 'medium';
        const investmentAmount = data.investmentAmount || 100000; // 默认10万美元
        
        console.log(`[DEBUG] AI stock picker request: sector=${sector}, style=${style}, risk=${risk}, time_horizon=${timeHorizon}`);
        
        // 生成股票推荐
        const recommendations = await generateStockRecommendations(sector, style, risk, timeHorizon, investmentAmount, req);
        
        // 使用GPT生成投资摘要和整体策略
        const criteria = { sector, style, risk, timeHorizon, investmentAmount };
        const investmentSummary = await generateInvestmentSummary(recommendations, criteria);
        
        // 解析GPT生成的结构化策略
        const overallStrategy = parseGPTStrategy(investmentSummary);
        if(user){
        await update_user_points(req,user.id,user.membership_points,pointsRules.ai_recommended_consumption*-1,'Members use AI to recommend stocks');
        }
       
        return res.json({
            success: true,
            recommendations: recommendations,
            investmentSummary: investmentSummary,
            overallStrategy: overallStrategy,
            criteria: {
                sector: sector,
                style: style,
                risk: risk,
                timeHorizon: timeHorizon,
                investmentAmount: investmentAmount
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
                console.log(portfolioPerformance)
            } catch (error) {
                console.error(`[WARNING] 持仓计算失败:`, error);
            }
        }
        
        // 使用GPT生成专业诊断分析
        const gptAnalysis = await generateStockAnalysis(stockData, 'portfolio-diagnosis', portfolioPerformance);
        const mockAnalysis = gptAnalysis || generateMockPortfolioAnalysis(symbol, stockData, portfolioPerformance);
        
        // 计算评分
        const overallScore = calculatePortfolioScore(stockData, portfolioPerformance);
        
        // 构建诊断结果
        const diagnosis = {
            'symbol': symbol,
            'overallScore': overallScore,
            'summary': `${symbol} comprehensive analysis score: ${overallScore}/100. ${mockAnalysis.substring(0, 100)}${mockAnalysis.length > 100 ? '...' : ''}`,
            'portfolioPerformance': portfolioPerformance,
            'sections': parsePortfolioAnalysis(mockAnalysis, overallScore),
            'gptAnalysis': gptAnalysis // 添加GPT分析结果
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
         // 获取用户积分规则
       
        const user=await getUserFromSession(req);
         if(user){
             const pointsRules = await get_trader_points_rules(req);
            if(user.membership_points<pointsRules.ai_diagnostic_consumption)
            {
                return res.status(200).json({ success: false, error: 'Insufficient user points, unable to use AI stock diagnosis function' });
            }
        }
       
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
        if(user){
            await update_user_points(req,user.id,user.membership_points,pointsRules.ai_diagnostic_consumption*-1,'Members use AI to diagnose stocks');
        }
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

// 添加JavaScript版本的round、float、int函数
function round(value, decimals = 0) {
    return Number(value.toFixed(decimals));
}

function float(value) {
    return parseFloat(value);
}

function int(value) {
    return parseInt(value);
}

// 创建备用股票数据
function create_fallback_stock_data(symbol, info = {}) {
    // 股票名称映射
    const stock_names = {
        'AAPL': 'Apple Inc.',
        'MSFT': 'Microsoft Corp.',
        'GOOGL': 'Alphabet Inc.',
        'TSLA': 'Tesla Inc.',
        'NVDA': 'NVIDIA Corp.',
        'META': 'Meta Platforms Inc.',
        'AMZN': 'Amazon.com Inc.',
        'JNJ': 'Johnson & Johnson',
        'PFE': 'Pfizer Inc.',
        'UNH': 'UnitedHealth Group',
        'MRNA': 'Moderna Inc.',
        'JPM': 'JPMorgan Chase & Co.',
        'BAC': 'Bank of America Corp.',
        'WFC': 'Wells Fargo & Company',
        'GS': 'Goldman Sachs Group Inc.'
    };
    
    // 行业映射
    const sector_map = {
        'AAPL': 'Technology', 'MSFT': 'Technology', 'GOOGL': 'Technology', 'TSLA': 'Technology',
        'NVDA': 'Technology', 'META': 'Technology', 'AMZN': 'Consumer Discretionary',
        'JNJ': 'Healthcare', 'PFE': 'Healthcare', 'UNH': 'Healthcare', 'MRNA': 'Healthcare',
        'JPM': 'Financials', 'BAC': 'Financials', 'WFC': 'Financials', 'GS': 'Financials'
    };
    
    // 模拟合理的股票数据
    const base_price = getRandomFloat(50, 300);
    const change_percent = getRandomFloat(-5, 5);
    const prev_close = base_price / (1 + change_percent/100);
    
    console.log(`[DEBUG] 为 ${symbol} 创建备用数据: 价格=${base_price.toFixed(2)}`);
    
    const fallback_data = {
        'symbol': symbol,
        'name': stock_names[symbol] || `${symbol} Corp.`,
        'sector': sector_map[symbol] || 'Technology',
        'industry': 'Software',
        'current_price': round(base_price, 2),
        'prev_close': round(prev_close, 2),
        'change': round(base_price - prev_close, 2),
        'change_percent': round(change_percent, 2),
        'market_cap': getRandomInt(10, 2000) * 1000000000,  // 100亿到2万亿
        'pe_ratio': round(getRandomFloat(15, 35), 1),
        'forward_pe': round(getRandomFloat(12, 30), 1),
        'peg_ratio': round(getRandomFloat(0.8, 2.5), 2),
        'price_to_book': round(getRandomFloat(1.2, 8.0), 2),
        'debt_to_equity': round(getRandomFloat(0.1, 1.5), 2),
        'roe': round(getRandomFloat(0.08, 0.25), 3),
        'dividend_yield': round(getRandomFloat(0, 0.05), 3),
        'beta': round(getRandomFloat(0.7, 1.8), 2),
        'ma_5': round(base_price * getRandomFloat(0.98, 1.02), 2),
        'ma_20': round(base_price * getRandomFloat(0.95, 1.05), 2),
        'rsi': round(getRandomFloat(30, 70), 1),
        'volatility': round(getRandomFloat(15, 40), 1),
        'volume_ratio': round(getRandomFloat(0.5, 3.0), 2),
        'avg_volume': getRandomInt(1000000, 50000000),
        'high_52w': round(base_price * getRandomFloat(1.1, 1.5), 2),
        'low_52w': round(base_price * getRandomFloat(0.6, 0.9), 2),
        'target_price': round(base_price * getRandomFloat(1.05, 1.25), 2),
        'recommendation': round(getRandomFloat(1.5, 4.5), 1)
    };
    
    return fallback_data;
}