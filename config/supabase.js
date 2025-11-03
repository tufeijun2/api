const { createClient } = require('@supabase/supabase-js');

// 创建Supabase客户端实例（如果配置存在）
let supabase = null;
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
} else {
    console.warn('⚠️  Supabase配置缺失，某些功能可能不可用');
}

const Web_Trader_UUID = process.env.Web_Trader_UUID;

// 导出客户端实例
exports.supabase = supabase;

// 统计记录数的函数
exports.count = async (table, filters = []) => {
    try {
        if (!supabase) {
            console.warn(`Supabase未配置，无法执行count操作: ${table}`);
            return 0;
        }
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
        if (!supabase) {
            console.warn(`Supabase未配置，无法执行select操作: ${table}`);
            return [];
        }
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
                    }
                });
            }
        }
       
        // 添加限制 - 只对非聚合查询应用
        if (limit && !columns.includes('COUNT(')) {
             query.range(parseInt(offset),parseInt(offset)+parseInt(limit)-1);
        }
       
        if (order) {
            query.order(order.column, { ascending: order.ascending });
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
        if (!supabase) {
            console.warn(`Supabase未配置，无法执行insert操作: ${table}`);
            return [];
        }
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
        if (!supabase) {
            console.warn(`Supabase未配置，无法执行update操作: ${table}`);
            return [];
        }
        let query = supabase.from(table).update(data);
        
        filters.forEach(filter => {
            query = query.eq(filter.column, filter.value);
        });
        
        const { data: updatedData, error } = await query.select();
        
        if (error) {
            console.error('Supabase更新错误:', error);
            throw error;
        }
        
        return updatedData;
    } catch (error) {
        console.error('Supabase更新失败:', error);
        throw error;
    }
};

// 删除数据
exports.delete = async (table, filters) => {
    try {
        if (!supabase) {
            console.warn(`Supabase未配置，无法执行delete操作: ${table}`);
            return [];
        }
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
        if (!supabase) {
            console.warn(`Supabase未配置，无法执行uploadFile操作`);
            throw new Error('Supabase未配置');
        }
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
        if (!supabase) {
            console.warn(`Supabase未配置，无法执行deleteFile操作`);
            throw new Error('Supabase未配置');
        }
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
        if (!supabase) {
            console.warn(`Supabase未配置，无法执行getPublicUrl操作`);
            return null;
        }
        const { data } = supabase.storage
            .from(bucketName)
            .getPublicUrl(fileName);
        
        return data.publicUrl;
    } catch (error) {
        console.error('获取Supabase文件URL失败:', error);
        throw error;
    }
};