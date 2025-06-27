const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Import module rút gọn link
const { shortenUrl, redirect, getStats, getAllUrls, deleteUrl, setBaseUrl, getOverallStats } = require('../src/models/rutgon');

// === ROUTES RÚT GỌN LINK ===

// POST /api/shorten - Rút gọn URL
router.post('/shorten', async (req, res) => {
    try {
        const { url, customCode, expiryHours } = req.body;
        
        if (!url) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu tham số URL',
                error: 'MISSING_URL'
            });
        }

        const result = await shortenUrl(url, customCode, expiryHours);
        const statusCode = result.success ? 200 : 400;
        
        res.status(statusCode).json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

// GET /api/stats/:shortCode - Xem thống kê
router.get('/stats/:shortCode', async (req, res) => {
    try {
        const { shortCode } = req.params;
        const result = await getStats(shortCode);
        const statusCode = result.success ? 200 : 404;
        
        res.status(statusCode).json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

// GET /api/stats - Xem thống kê tổng quan
router.get('/stats', async (req, res) => {
    try {
        const result = await getOverallStats();
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

// GET /api/urls - Xem tất cả URLs (có phân trang)
router.get('/urls', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        
        const result = await getAllUrls(page, limit);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

// DELETE /api/delete/:shortCode - Xóa URL
router.delete('/delete/:shortCode', async (req, res) => {
    try {
        const { shortCode } = req.params;
        const result = await deleteUrl(shortCode);
        const statusCode = result.success ? 200 : 404;
        
        res.status(statusCode).json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

// POST /api/config/baseurl - Cập nhật base URL
router.post('/config/baseurl', (req, res) => {
    try {
        const { baseUrl } = req.body;
        
        if (!baseUrl) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu tham số baseUrl'
            });
        }

        setBaseUrl(baseUrl);
        res.json({
            success: true,
            message: 'Cập nhật base URL thành công',
            data: { baseUrl }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

// === AUTO SCAN APIs ===

// Hàm quét thư mục và tự động đăng ký các API
function scanAndRegisterAPIs(directory) {
    const files = fs.readdirSync(directory);
    
    files.forEach(file => {
        const filePath = path.join(directory, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            // Nếu là thư mục, quét tiếp
            scanAndRegisterAPIs(filePath);
        } else if (file.endsWith('.js') && file !== 'index.js') {
            // Nếu là file .js và không phải index.js
            const apiName = path.basename(file, '.js');
            const apiHandler = require(filePath);
            
            // Tự động đăng ký route
            if (typeof apiHandler === 'function') {
                router.get(`/${apiName}`, apiHandler);
                console.log(`Đã đăng ký API: /${apiName}`);
            }
        }
    });
}

// Quét thư mục src để tìm và đăng ký các API
scanAndRegisterAPIs(path.join(__dirname, '../src'));

router.get('/', (req, res) => {
    const apiDocs = `
# 🔗 Kaiyo API - URL Shortener Service

## URL Shortener Endpoints:

### POST /api/shorten
Rút gọn URL với tùy chọn mã tùy chỉnh và thời gian hết hạn
Body: { "url": "https://example.com", "customCode": "optional", "expiryHours": 24 }

### GET /:shortCode
Chuyển tiếp đến URL gốc

### GET /api/stats/:shortCode
Xem thống kê của một URL cụ thể

### GET /api/stats
Xem thống kê tổng quan hệ thống

### GET /api/urls?page=1&limit=10
Xem danh sách URLs (có phân trang)

### DELETE /api/delete/:shortCode
Xóa một URL rút gọn

### POST /api/config/baseurl
Cập nhật base URL
Body: { "baseUrl": "https://yourdom.com" }

## ✨ Tính năng:
- ✅ Tự động xóa sau 24h (configurable)
- ✅ Thống kê clicks chi tiết
- ✅ Mã tùy chỉnh
- ✅ Lưu trữ MongoDB persistent
- ✅ Pagination
- ✅ Auto cleanup job

## 🎯 Ví dụ:
curl -X POST http://localhost:5000/api/shorten \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://www.google.com", "customCode": "google"}'
    `;
    
    res.send(`<pre>${apiDocs}</pre>`);
});

module.exports = router;
