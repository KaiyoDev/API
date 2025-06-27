const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class URLShortener {
    constructor() {
        this.baseUrl = 'https://kaiyobot.gis-humg.com';
        this.dataFile = path.join(__dirname, '../data/short-urls.json');
        this.statsFile = path.join(__dirname, '../data/url-stats.json');
        
        // Đảm bảo thư mục data tồn tại
        this.ensureDataDirectory();
        
        // Load dữ liệu từ file
        this.loadData();
        
        // Setup cleanup job
        this.setupCleanupJob();
    }

    /**
     * Đảm bảo thư mục data tồn tại
     */
    ensureDataDirectory() {
        const dataDir = path.dirname(this.dataFile);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log('📁 Đã tạo thư mục data');
        }
    }

    /**
     * Load dữ liệu từ file
     */
    loadData() {
        try {
            // Load URLs
            if (fs.existsSync(this.dataFile)) {
                const data = fs.readFileSync(this.dataFile, 'utf8');
                this.urls = JSON.parse(data);
            } else {
                this.urls = {};
            }

            // Load stats
            if (fs.existsSync(this.statsFile)) {
                const statsData = fs.readFileSync(this.statsFile, 'utf8');
                this.stats = JSON.parse(statsData);
            } else {
                this.stats = {};
            }

            console.log(`📚 Đã load ${Object.keys(this.urls).length} URLs từ file`);
        } catch (error) {
            console.error('❌ Lỗi load data:', error.message);
            this.urls = {};
            this.stats = {};
        }
    }

    /**
     * Lưu dữ liệu vào file
     */
    saveData() {
        try {
            // Lưu URLs
            fs.writeFileSync(this.dataFile, JSON.stringify(this.urls, null, 2));
            
            // Lưu stats  
            fs.writeFileSync(this.statsFile, JSON.stringify(this.stats, null, 2));
        } catch (error) {
            console.error('❌ Lỗi save data:', error.message);
        }
    }

    /**
     * Thiết lập job cleanup tự động
     */
    setupCleanupJob() {
        // Cleanup ngay khi khởi động
        setTimeout(() => this.cleanupExpiredUrls(), 5000);
        
        // Cleanup mỗi giờ
        setInterval(() => this.cleanupExpiredUrls(), 60 * 60 * 1000);
        
        console.log('🕐 Đã thiết lập cleanup job - tự động xóa URLs hết hạn mỗi giờ');
    }

    /**
     * Cleanup URLs hết hạn
     */
    cleanupExpiredUrls() {
        try {
            const now = new Date();
            let deletedCount = 0;
            
            Object.keys(this.urls).forEach(shortCode => {
                const url = this.urls[shortCode];
                if (new Date(url.expiresAt) < now) {
                    delete this.urls[shortCode];
                    delete this.stats[shortCode];
                    deletedCount++;
                }
            });
            
            if (deletedCount > 0) {
                this.saveData();
                console.log(`🗑️  Đã xóa ${deletedCount} URLs hết hạn`);
            }
        } catch (error) {
            console.error('❌ Lỗi cleanup:', error.message);
        }
    }

    /**
     * Tạo mã hash ngắn từ URL
     */
    generateShortCode(url, length = 6) {
        const hash = crypto.createHash('md5').update(url + Date.now() + Math.random()).digest('hex');
        return hash.substring(0, length);
    }

    /**
     * Kiểm tra URL có hợp lệ không
     */
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Tính thời gian còn lại
     */
    getTimeLeft(expiresAt) {
        const now = new Date();
        const timeDiff = new Date(expiresAt) - now;
        
        if (timeDiff <= 0) return 'Đã hết hạn';
        
        const hours = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        
        return `${hours}h ${minutes}m`;
    }

    /**
     * Rút gọn URL
     */
    async shortenUrl(originalUrl, customCode = null, expiryHours = 24) {
        try {
            // Kiểm tra URL hợp lệ
            if (!this.isValidUrl(originalUrl)) {
                return {
                    success: false,
                    message: 'URL không hợp lệ',
                    error: 'INVALID_URL'
                };
            }

            // Kiểm tra URL đã tồn tại và chưa hết hạn
            for (const [code, urlData] of Object.entries(this.urls)) {
                if (urlData.originalUrl === originalUrl && new Date(urlData.expiresAt) > new Date()) {
                    return {
                        success: true,
                        message: 'URL đã tồn tại',
                        data: {
                            originalUrl: urlData.originalUrl,
                            shortUrl: `${this.baseUrl}/${code}`,
                            shortCode: code,
                            clicks: this.stats[code]?.clicks || 0,
                            createdAt: urlData.createdAt,
                            expiresAt: urlData.expiresAt,
                            timeLeft: this.getTimeLeft(urlData.expiresAt)
                        }
                    };
                }
            }

            let shortCode;

            // Sử dụng mã tùy chỉnh nếu có
            if (customCode) {
                if (this.urls[customCode]) {
                    return {
                        success: false,
                        message: 'Mã tùy chỉnh đã tồn tại',
                        error: 'CUSTOM_CODE_EXISTS'
                    };
                }
                shortCode = customCode;
            } else {
                // Tạo mã ngẫu nhiên
                do {
                    shortCode = this.generateShortCode(originalUrl);
                } while (this.urls[shortCode]);
            }

            // Tạo thời gian hết hạn
            const now = new Date();
            const expiresAt = new Date(now.getTime() + expiryHours * 60 * 60 * 1000);

            // Lưu vào memory
            this.urls[shortCode] = {
                originalUrl,
                customCode: !!customCode,
                createdAt: now.toISOString(),
                expiresAt: expiresAt.toISOString()
            };

            this.stats[shortCode] = {
                clicks: 0,
                lastAccessAt: null,
                ips: [],
                userAgents: []
            };

            // Lưu vào file
            this.saveData();

            return {
                success: true,
                message: 'Rút gọn URL thành công',
                data: {
                    originalUrl,
                    shortUrl: `${this.baseUrl}/${shortCode}`,
                    shortCode,
                    clicks: 0,
                    createdAt: this.urls[shortCode].createdAt,
                    expiresAt: this.urls[shortCode].expiresAt,
                    timeLeft: this.getTimeLeft(this.urls[shortCode].expiresAt)
                }
            };

        } catch (error) {
            return {
                success: false,
                message: 'Lỗi khi rút gọn URL',
                error: error.message
            };
        }
    }

    /**
     * Chuyển tiếp từ mã rút gọn về URL gốc
     */
    async redirect(shortCode, ip = null, userAgent = null) {
        try {
            const urlData = this.urls[shortCode];

            if (!urlData) {
                return {
                    success: false,
                    message: 'Mã rút gọn không tồn tại',
                    error: 'SHORT_CODE_NOT_FOUND'
                };
            }

            // Kiểm tra hết hạn
            if (new Date(urlData.expiresAt) < new Date()) {
                return {
                    success: false,
                    message: 'Mã rút gọn đã hết hạn',
                    error: 'SHORT_CODE_EXPIRED'
                };
            }

            // Cập nhật thống kê
            if (!this.stats[shortCode]) {
                this.stats[shortCode] = { clicks: 0, ips: [], userAgents: [] };
            }

            this.stats[shortCode].clicks++;
            this.stats[shortCode].lastAccessAt = new Date().toISOString();

            if (ip && !this.stats[shortCode].ips.includes(ip)) {
                this.stats[shortCode].ips.push(ip);
            }

            if (userAgent && !this.stats[shortCode].userAgents.includes(userAgent)) {
                this.stats[shortCode].userAgents.push(userAgent);
            }

            // Lưu stats
            this.saveData();

            return {
                success: true,
                message: 'Chuyển tiếp thành công',
                data: {
                    originalUrl: urlData.originalUrl,
                    shortCode,
                    clicks: this.stats[shortCode].clicks,
                    redirectAt: new Date().toISOString(),
                    timeLeft: this.getTimeLeft(urlData.expiresAt)
                }
            };

        } catch (error) {
            return {
                success: false,
                message: 'Lỗi khi chuyển tiếp',
                error: error.message
            };
        }
    }

    /**
     * Lấy thông tin thống kê
     */
    async getStats(shortCode) {
        try {
            const urlData = this.urls[shortCode];
            const statsData = this.stats[shortCode];

            if (!urlData) {
                return {
                    success: false,
                    message: 'Mã rút gọn không tồn tại',
                    error: 'SHORT_CODE_NOT_FOUND'
                };
            }

            return {
                success: true,
                data: {
                    shortCode,
                    originalUrl: urlData.originalUrl,
                    shortUrl: `${this.baseUrl}/${shortCode}`,
                    clicks: statsData?.clicks || 0,
                    createdAt: urlData.createdAt,
                    expiresAt: urlData.expiresAt,
                    timeLeft: this.getTimeLeft(urlData.expiresAt),
                    lastAccessAt: statsData?.lastAccessAt,
                    isExpired: new Date(urlData.expiresAt) < new Date(),
                    uniqueIps: statsData?.ips?.length || 0,
                    uniqueUserAgents: statsData?.userAgents?.length || 0
                }
            };
        } catch (error) {
            return {
                success: false,
                message: 'Lỗi khi lấy thống kê',
                error: error.message
            };
        }
    }

    /**
     * Lấy danh sách URLs với phân trang
     */
    async getAllUrls(page = 1, limit = 10) {
        try {
            // Lọc URLs chưa hết hạn
            const activeUrls = Object.entries(this.urls)
                .filter(([code, data]) => new Date(data.expiresAt) > new Date())
                .map(([code, data]) => ({
                    shortCode: code,
                    originalUrl: data.originalUrl,
                    shortUrl: `${this.baseUrl}/${code}`,
                    clicks: this.stats[code]?.clicks || 0,
                    createdAt: data.createdAt,
                    expiresAt: data.expiresAt,
                    timeLeft: this.getTimeLeft(data.expiresAt)
                }))
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            // Phân trang
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedUrls = activeUrls.slice(startIndex, endIndex);

            return {
                success: true,
                data: {
                    urls: paginatedUrls,
                    pagination: {
                        currentPage: page,
                        totalPages: Math.ceil(activeUrls.length / limit),
                        totalUrls: activeUrls.length,
                        hasNext: endIndex < activeUrls.length,
                        hasPrev: page > 1
                    }
                }
            };
        } catch (error) {
            return {
                success: false,
                message: 'Lỗi khi lấy danh sách URLs',
                error: error.message
            };
        }
    }

    /**
     * Xóa URL
     */
    async deleteUrl(shortCode) {
        try {
            if (!this.urls[shortCode]) {
                return {
                    success: false,
                    message: 'Mã rút gọn không tồn tại',
                    error: 'SHORT_CODE_NOT_FOUND'
                };
            }

            const deletedUrl = this.urls[shortCode].originalUrl;
            delete this.urls[shortCode];
            delete this.stats[shortCode];

            this.saveData();

            return {
                success: true,
                message: 'Xóa URL thành công',
                data: {
                    deletedShortCode: shortCode,
                    deletedUrl: deletedUrl
                }
            };
        } catch (error) {
            return {
                success: false,
                message: 'Lỗi khi xóa URL',
                error: error.message
            };
        }
    }

    /**
     * Thống kê tổng quan
     */
    async getOverallStats() {
        try {
            const activeUrls = Object.entries(this.urls)
                .filter(([code, data]) => new Date(data.expiresAt) > new Date());

            const totalClicks = Object.values(this.stats)
                .reduce((sum, stat) => sum + (stat.clicks || 0), 0);

            const topUrls = activeUrls
                .map(([code, data]) => ({
                    shortCode: code,
                    originalUrl: data.originalUrl,
                    clicks: this.stats[code]?.clicks || 0
                }))
                .sort((a, b) => b.clicks - a.clicks)
                .slice(0, 5);

            return {
                success: true,
                data: {
                    totalUrls: activeUrls.length,
                    totalClicks,
                    topUrls
                }
            };
        } catch (error) {
            return {
                success: false,
                message: 'Lỗi khi lấy thống kê',
                error: error.message
            };
        }
    }

    /**
     * Cập nhật base URL
     */
    setBaseUrl(newBaseUrl) {
        this.baseUrl = newBaseUrl;
    }
}

// Tạo instance duy nhất
const urlShortener = new URLShortener();

// Export các hàm tiện ích
module.exports = {
    urlShortener,
    shortenUrl: (url, customCode, expiryHours) => urlShortener.shortenUrl(url, customCode, expiryHours),
    redirect: (shortCode, ip, userAgent) => urlShortener.redirect(shortCode, ip, userAgent),
    getStats: (shortCode) => urlShortener.getStats(shortCode),
    getAllUrls: (page, limit) => urlShortener.getAllUrls(page, limit),
    deleteUrl: (shortCode) => urlShortener.deleteUrl(shortCode),
    getOverallStats: () => urlShortener.getOverallStats(),
    setBaseUrl: (baseUrl) => urlShortener.setBaseUrl(baseUrl),
    URLShortener
};
