const { createClient } = require('@supabase/supabase-js');

// 创建Supabase客户端实例
const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_KEY || ''
);
const Web_Trader_UUID = process.env.Web_Trader_UUID;

// 导出客户端实例
exports.supabase = supabase;

// 统计记录数的函数
exports.count = async (table, filters = []) => {
    try {
        let query = supabase.from(table).select('*', { count: 'exact' }).limit(0);
        
        // 添加过滤条件
        filters.forEach(filter => {
            if (filter.type === 'eq') {
                query = query.eq(filter.column, filter.value);
            } else if (filter.type === 'neq') {
                query = query.neq(filter.column, filter.value);
            } else if (filter.type === 'like') {
                query = query.like(filter.column, filter.value);
            } else if (filter.type === 'in') {
                query = query.in(filter.column, filter.value);
            } else if (filter.type === 'gt') {
                query = query.gt(filter.column, filter.value);
            } else if (filter.type === 'gte') {
                query = query.gte(filter.column, filter.value);
            } else if (filter.type === 'lte') {
                query = query.lte(filter.column, filter.value);
            } else if (filter.type === 'ilike') {
                query = query.ilike(filter.column, filter.value);
            }
        });
        
        const { count, error } = await query;
        
        if (error) {
            console.error('Supabase计数错误:', error);
            throw error;
        }
        
        return count || 0;
    } catch (error) {
        console.error('Supabase计数失败:', error);
        throw error;
    }
};

// 通用的Supabase查询函数
exports.select = async (table, columns = '*', filters = [], limit=null ,offset=null, order=null ) => {
    try {
        let query = supabase.from(table).select(columns);
        
        if(filters)
        {
            if(filters.length>0)
            {            // 添加过滤条件
                filters.forEach(filter => {
                    if (filter.type === 'eq') {
                        query = query.eq(filter.column, filter.value);
                    } else if (filter.type === 'neq') {
                        query = query.neq(filter.column, filter.value);
                    } else if (filter.type === 'like') {
                        query = query.like(filter.column, filter.value);
                    } else if (filter.type === 'in') {
                        query = query.in(filter.column, filter.value);
                    } else if (filter.type === 'gt') {
                        query = query.gt(filter.column, filter.value);
<<<<<<< HEAD
                    } else if (filter.type === 'gte') {
                        query = query.gte(filter.column, filter.value);
                    } else if (filter.type === 'lte') {
                        query = query.lte(filter.column, filter.value);
                    } else if (filter.type === 'ilike') {
                        query = query.ilike(filter.column, filter.value);
=======
>>>>>>> 46e3aca09df426db1c4ec7826d0d2d5426c174d5
                    }
                });
            }
        }
       
        // 添加限制 - 只对非聚合查询应用
        if (limit && !columns.includes('COUNT(')) {
             query.range(parseInt(offset),parseInt(offset)+parseInt(limit)-1);
        }
       
        if (order) {
            if(Array.isArray(order))
            {
                order.forEach(o => {
                    query.order(o.column, { ascending: o.ascending });
                });
            }
            else
            {
                query.order(order.column, { ascending: order.ascending });
            }
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error('Supabase查询错误:', error);
            throw error;
        }
        
        return data;
    } catch (error) {
        console.error('Supabase操作失败:', error);
        throw error;
    }
};

// 插入数据
exports.insert = async (table, data) => {
    try {
        const { data: insertedData, error } = await supabase
            .from(table)
            .insert(data)
            .select();
        
        if (error) {
            console.error('Supabase插入错误:', error);
            throw error;
        }
        
        return insertedData;
    } catch (error) {
        console.error('Supabase插入失败:', error);
        throw error;
    }
};

// 更新数据
exports.update = async (table, data, filters) => {
    try {
        console.log(`🔄 [Supabase Update] 表: ${table}, 数据:`, JSON.stringify(data, null, 2));
        console.log(`🔄 [Supabase Update] 过滤条件:`, JSON.stringify(filters, null, 2));
        
        // 检查filters是否为空
        if (!filters || filters.length === 0) {
            throw new Error('更新操作必须提供至少一个过滤条件，以防止误更新所有记录');
        }
        
        let query = supabase.from(table).update(data);
        
        filters.forEach(filter => {
            if (filter.type === 'eq') {
                query = query.eq(filter.column, filter.value);
            } else if (filter.type === 'neq') {
                query = query.neq(filter.column, filter.value);
            } else if (filter.type === 'in') {
                query = query.in(filter.column, filter.value);
            }
        });
        
        const { data: updatedData, error } = await query.select();
        
        if (error) {
            console.error('❌ Supabase更新错误:', error);
            console.error('❌ 错误详情:', JSON.stringify(error, null, 2));
            throw error;
        }
        
        console.log(`✅ [Supabase Update] 更新成功，返回数据:`, JSON.stringify(updatedData, null, 2));
        console.log(`✅ [Supabase Update] 更新记录数:`, updatedData ? updatedData.length : 0);
        
        return updatedData;
    } catch (error) {
        console.error('❌ Supabase更新失败:', error);
        console.error('❌ 错误堆栈:', error.stack);
        throw error;
    }
};

// 删除数据
exports.delete = async (table, filters) => {
    try {
        let query = supabase.from(table).delete();
        
        filters.forEach(filter => {
            query = query.eq(filter.column, filter.value);
        });
        
        const { data: deletedData, error } = await query;
        
        if (error) {
            console.error('Supabase删除错误:', error);
            throw error;
        }
        
        return deletedData;
    } catch (error) {
        console.error('Supabase删除失败:', error);
        throw error;
    }
};

// 上传文件到Supabase存储
exports.uploadFile = async (bucketName, fileName, fileBuffer, mimeType) => {
    try {
        const { data, error } = await supabase.storage
            .from(bucketName)
            .upload(fileName, fileBuffer, {
                contentType: mimeType,
                upsert: true
            });
        
        if (error) {
            console.error('Supabase文件上传错误:', error);
            throw error;
        }
        
        // 获取文件的公开URL
        const { data: { publicUrl } } = supabase.storage
            .from(bucketName)
            .getPublicUrl(fileName);
        
        return {
            path: data.path,
            url: publicUrl
        };
    } catch (error) {
        console.error('Supabase文件上传失败:', error);
        throw error;
    }
};

// 删除Supabase存储中的文件
exports.deleteFile = async (bucketName, fileName) => {
    try {
        const { data, error } = await supabase.storage
            .from(bucketName)
            .remove([fileName]);
        
        if (error) {
            console.error('Supabase文件删除错误:', error);
            throw error;
        }
        
        return data;
    } catch (error) {
        console.error('Supabase文件删除失败:', error);
        throw error;
    }
};

// 获取文件的公开URL
exports.getPublicUrl = async (bucketName, fileName) => {
    try {
        const { data } = supabase.storage
            .from(bucketName)
            .getPublicUrl(fileName);
        
        return data.publicUrl;
    } catch (error) {
        console.error('获取Supabase文件URL失败:', error);
        throw error;
    }
};