const axios = require('axios');

// Danh sách các API endpoint để kiểm tra URL
const CHECK_APIS = [
    'https://feeds.chongluadao.vn/checksafe/cld',
    'https://feeds.chongluadao.vn/checksafe/scamadviser',
    'https://feeds.chongluadao.vn/checksafe/safebrowsing',
    'https://feeds.chongluadao.vn/checksafe/ecrimex',
    'https://feeds.chongluadao.vn/checksafe/scamvn',
    'https://feeds.chongluadao.vn/checksafe/cyradar',
    'https://feeds.chongluadao.vn/checksafe/phishtank'
];

/**
 * Kiểm tra tính an toàn của một URL sử dụng nhiều API
 * @param {string} url - URL cần kiểm tra
 * @returns {Promise<Object>} - Kết quả kiểm tra
 */
async function checkUrlSafety(url) {
    try {
        // Validate URL
        if (!url || typeof url !== 'string') {
            throw new Error('URL không hợp lệ');
        }

        // Chuẩn bị payload
        const payload = {
            url: url,
            readOnly: true
        };

        

        // Gọi tất cả API đồng thời
        const promises = CHECK_APIS.map(async (apiUrl, index) => {
            try {
                const response = await axios.post(apiUrl, payload, {
                    timeout: 20000, // 20 giây timeout
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'Kaiyo-Api/1.0'
                    }
                });

                return {
                    api: apiUrl,
                    success: true,
                    data: response.data,
                    index: index
                };
            } catch (error) {
                console.warn(`⚠️ API ${index + 1} failed: ${error.message}`);
                return {
                    api: apiUrl,
                    success: false,
                    error: error.message,
                    index: index
                };
            }
        });

        // Đợi tất cả API trả về kết quả
        const results = await Promise.all(promises);

        // Phân tích kết quả
        const analysis = analyzeResults(results, url);
        
        return analysis;

    } catch (error) {
        console.error('❌ Lỗi khi kiểm tra URL:', error.message);
        return {
            success: false,
            error: error.message,
            url: url,
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Phân tích kết quả từ các API
 * @param {Array} results - Mảng kết quả từ các API
 * @param {string} url - URL đã kiểm tra
 * @returns {Object} - Kết quả phân tích
 */
function analyzeResults(results, url) {
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);
    
    console.log(`✅ Thành công: ${successfulResults.length}/${results.length} API`);
    console.log(`❌ Thất bại: ${failedResults.length}/${results.length} API`);

    // Phân loại kết quả
    const safeResults = [];
    const unsafeResults = [];
    const unknownResults = [];

    successfulResults.forEach(result => {
        if (result.data && result.data.data) {
            const resultData = result.data.data;
            
            if (resultData.result === 'nodata') {
                safeResults.push({
                    api: result.api,
                    result: 'safe',
                    note: resultData.note || 'Không có dữ liệu nguy hiểm'
                });
            } else if (resultData.result === 'unsafe') {
                unsafeResults.push({
                    api: result.api,
                    result: 'unsafe',
                    note: resultData.note || 'URL được đánh dấu là nguy hiểm'
                });
            } else {
                unknownResults.push({
                    api: result.api,
                    result: 'unknown',
                    note: resultData.note || 'Kết quả không xác định'
                });
            }
        }
    });

    // Đưa ra kết luận cuối cùng
    let finalResult = 'safe';
    let riskLevel = 'low';
    let message = 'URL này có vẻ an toàn';

    if (unsafeResults.length > 0) {
        finalResult = 'unsafe';
        riskLevel = 'high';
        message = `URL này có nguy cơ cao! Được đánh dấu là nguy hiểm bởi ${unsafeResults.length} nguồn`;
    } else if (unknownResults.length > safeResults.length) {
        finalResult = 'unknown';
        riskLevel = 'medium';
        message = 'Không thể xác định tính an toàn của URL này';
    }

    // Tạo báo cáo chi tiết
    const report = {
        success: true,
        url: url,
        timestamp: new Date().toISOString(),
        result: finalResult,
        riskLevel: riskLevel,
        message: message,
        summary: {
            total: results.length,
            successful: successfulResults.length,
            failed: failedResults.length,
            safe: safeResults.length,
            unsafe: unsafeResults.length,
            unknown: unknownResults.length
        },
        details: {
            safe: safeResults,
            unsafe: unsafeResults,
            unknown: unknownResults,
            failed: failedResults.map(r => ({
                api: r.api,
                error: r.error
            }))
        }
    };

    
    
    return report;
}

// API Handler cho route /api/checkurl?url=
async function checkurlHandler(req, res) {
    try {
        // Lấy URL từ query parameter
        const { url } = req.query;
        
        // Kiểm tra tham số bắt buộc
        if (!url) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu tham số url',
                error: 'MISSING_URL_PARAMETER',
                usage: 'Sử dụng: /api/checkurl?url=https://example.com'
            });
        }

        // Validate URL format
        try {
            new URL(url);
        } catch (urlError) {
            return res.status(400).json({
                success: false,
                message: 'URL không hợp lệ',
                error: 'INVALID_URL_FORMAT',
                url: url
            });
        }

        console.log(`🔍 API Request: Kiểm tra URL ${url}`);

        // Gọi function kiểm tra URL
        const result = await checkUrlSafety(url);

        // Trả về kết quả
        if (result.success) {
            res.json({
                success: true,
                data: result,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Lỗi khi kiểm tra URL',
                error: result.error,
                url: url,
                timestamp: new Date().toISOString()
            });
        }

    } catch (error) {
        console.error('❌ API Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

// Export handler function cho auto scan
module.exports = checkurlHandler;
