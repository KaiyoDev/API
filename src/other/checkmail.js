const ImapSimple = require('imap-simple');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const path = require('path');

/**
 * Kiểm tra đơn giản domain đã được báo cáo trong tháng hiện tại chưa
 * Chỉ kiểm tra Gmail, không lưu trữ gì
 */
class DomainChecker {
    constructor() {
        this.imapConfig = {
            imap: {
                user: process.env.GMAIL_EMAIL || '',
                password: process.env.GMAIL_PASSWORD || '',
                host: 'imap.gmail.com',
                port: 993,
                tls: true,
                authTimeout: 10000,
                connTimeout: 10000,
                tlsOptions: { rejectUnauthorized: false }
            }
        };
        this.connection = null;
        this.cacheFile = path.join(__dirname, '../data/domain-cache.json');
        this.cache = this.loadCache();
    }

    /**
     * Load cache từ file
     */
    loadCache() {
        try {
            if (fs.existsSync(this.cacheFile)) {
                const data = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
                const now = new Date();
                const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;
                
                // Nếu là tháng mới, reset cache
                if (data.month !== currentMonth) {
                    return { month: currentMonth, domains: [], lastCheck: null };
                }
                
                return data;
            }
        } catch (error) {
            console.error('Lỗi load cache:', error.message);
        }
        
        const now = new Date();
        return { 
            month: `${now.getFullYear()}-${now.getMonth() + 1}`, 
            domains: [], 
            lastCheck: null 
        };
    }

    /**
     * Lưu cache
     */
    saveCache() {
        try {
            fs.writeFileSync(this.cacheFile, JSON.stringify(this.cache, null, 2));
        } catch (error) {
            console.error('Lỗi save cache:', error.message);
        }
    }

    /**
     * Kiểm tra trong cache trước
     */
    checkInCache(domain) {
        return this.cache.domains.includes(domain);
    }

    /**
     * Thêm domain vào cache
     */
    addToCache(domain) {
        if (!this.cache.domains.includes(domain)) {
            this.cache.domains.push(domain);
            this.saveCache();
        }
    }

    /**
     * Chuẩn hóa domain để so sánh
     */
    normalizeDomain(domain) {
        if (!domain) return '';
        
        // Loại bỏ protocol
        domain = domain.replace(/^https?:\/\//, '');
        // Loại bỏ www
        domain = domain.replace(/^www\./, '');
        // Loại bỏ path và các ký tự đặc biệt
        domain = domain.split('/')[0].split('?')[0].split('#')[0];
        // Thay thế các ký tự escape như [.] và [:]
        domain = domain.replace(/\[\.]/g, '.').replace(/\[:\]/g, ':');
        
        return domain.toLowerCase().trim();
    }

    /**
     * Kết nối Gmail
     */
    async connectGmail() {
        try {
            if (!this.imapConfig.imap.user || !this.imapConfig.imap.password) {
                throw new Error('Thiếu thông tin Gmail trong file .env');
            }

            this.connection = await ImapSimple.connect(this.imapConfig);
            return true;
        } catch (error) {
            console.error('❌ Lỗi kết nối Gmail:', error.message);
            return false;
        }
    }

    /**
     * Tìm email từ ChongLuaDao trong tháng hiện tại
     */
    async getEmailsCurrentMonth() {
        try {
            await this.connection.openBox('INBOX');
            
            // Tính ngày đầu tháng hiện tại
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            
            const searchCriteria = [
                ['FROM', 'report@chongluadao.vn'],
                ['SINCE', firstDay]
            ];
            
            const messages = await this.connection.search(searchCriteria, {
                bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'],
                markSeen: false
            });
            
            return messages;
            
        } catch (error) {
            console.error('❌ Lỗi tìm email:', error.message);
            return [];
        }
    }

    /**
     * Lấy email mới từ lần check cuối
     */
    async getNewEmails(lastCheck) {
        try {
            await this.connection.openBox('INBOX');
            
            // Nếu lần đầu tiên, lấy email từ đầu tháng
            const since = lastCheck || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
            
            const searchCriteria = [
                ['FROM', 'report@chongluadao.vn'],
                ['SINCE', since]
            ];
            
            const messages = await this.connection.search(searchCriteria, {
                bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'],
                markSeen: false
            });
            
            return messages;
            
        } catch (error) {
            console.error('❌ Lỗi tìm email mới:', error.message);
            return [];
        }
    }

    /**
     * Trích xuất domain từ nội dung email
     */
    extractDomainsFromEmail(emailText) {
        const domains = new Set();
        
        // Các pattern để tìm domain trong email
        const patterns = [
            // https[:]//domain[.]com format - ưu tiên cao nhất
            /https?\[:\]\/\/([a-zA-Z0-9-]+(?:\[?\.\]?[a-zA-Z0-9-]+)*\[?\.\]?[a-zA-Z]{2,})(?:\/|#|$)/gi,
            // https://domain.com format  
            /https?:\/\/([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,})(?:\/|#|$)/gi,
            // domain[.]com format standalone
            /(?:^|\s)([a-zA-Z0-9-]+\[?\.\]?[a-zA-Z0-9-]+\[?\.\]?[a-zA-Z]{2,})(?:\s|$)/gi,
            // Backup pattern for any domain-like string
            /([a-zA-Z0-9-]+(?:\[?\.\]?[a-zA-Z0-9-]+)+)/gi
        ];
        
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(emailText)) !== null) {
                const domain = this.normalizeDomain(match[1]);
                if (this.isValidDomain(domain)) {
                    domains.add(domain);
                }
            }
        }
        
        return Array.from(domains);
    }

    /**
     * Kiểm tra domain hợp lệ
     */
    isValidDomain(domain) {
        if (!domain || domain.length < 4) return false;
        if (!domain.includes('.')) return false;
        if (!/^[a-zA-Z0-9.-]+$/.test(domain)) return false;
        
        // Loại bỏ domain của ChongLuaDao và các site phổ biến
        const excludes = ['chongluadao.vn', 'gmail.com', 'google.com', 'facebook.com'];
        return !excludes.some(ex => domain.includes(ex));
    }

    /**
     * Kiểm tra domain cụ thể đã được báo cáo chưa
     */
    async checkDomainReported(targetDomain) {
        try {
            const normalizedTarget = this.normalizeDomain(targetDomain);
            if (!normalizedTarget) {
                return { found: false, error: 'Domain không hợp lệ' };
            }

            // 🚀 Kiểm tra cache trước
            if (this.checkInCache(normalizedTarget)) {
                return { 
                    found: true, 
                    message: 'Domain đã được báo cáo trong tháng này (cached)',
                    cached: true
                };
            }

            // Kiểm tra xem có cần update cache không (mỗi 10 phút check 1 lần)
            const now = new Date();
            const lastCheck = this.cache.lastCheck ? new Date(this.cache.lastCheck) : null;
            const needUpdate = !lastCheck || (now - lastCheck) > 10 * 60 * 1000; // 10 phút

            if (!needUpdate) {
                // Cache còn fresh, domain không có trong cache = chưa báo cáo
                return { found: false, message: 'Domain chưa được báo cáo trong tháng này (cached)' };
            }

            // 🔄 Cần update cache - kết nối Gmail
            if (!await this.connectGmail()) {
                return { found: false, error: 'Không thể kết nối Gmail' };
            }

            // Lấy email mới từ lần check cuối
            const messages = await this.getNewEmails(lastCheck);
            
            if (messages.length === 0) {
                // Không có email mới, update lastCheck
                this.cache.lastCheck = now.toISOString();
                this.saveCache();
                await this.disconnect();
                return { found: false, message: 'Domain chưa được báo cáo trong tháng này' };
            }

            console.log(`📧 Processing ${messages.length} new emails...`);

            // Xử lý email mới và update cache
            for (const message of messages) {
                try {
                    // Lấy nội dung email
                    let emailText = '';
                    const textPart = message.parts.find(part => part.which === 'TEXT');
                    if (textPart && textPart.body) {
                        emailText = textPart.body;
                    }
                    
                    if (!emailText) {
                        const fullMessage = await this.connection.getPartData(message, 'TEXT');
                        if (fullMessage) {
                            emailText = fullMessage.toString();
                        }
                    }
                    
                    if (!emailText) continue;
                    
                    // Trích xuất domain và thêm vào cache
                    const domains = this.extractDomainsFromEmail(emailText);
                    domains.forEach(domain => this.addToCache(domain));
                    
                } catch (emailError) {
                    console.error('Lỗi xử lý email:', emailError.message);
                    continue;
                }
            }

            // Update lastCheck
            this.cache.lastCheck = now.toISOString();
            this.saveCache();
            await this.disconnect();

            // Kiểm tra lại trong cache sau khi update
            if (this.checkInCache(normalizedTarget)) {
                return { 
                    found: true, 
                    message: 'Domain đã được báo cáo trong tháng này',
                    date: new Date().toISOString()
                };
            }

            return { found: false, message: 'Domain chưa được báo cáo trong tháng này' };
            
        } catch (error) {
            await this.disconnect();
            return { found: false, error: error.message };
        }
    }

    /**
     * Ngắt kết nối
     */
    async disconnect() {
        if (this.connection) {
            try {
                this.connection.end();
            } catch (error) {
                console.error('Lỗi ngắt kết nối:', error.message);
            }
        }
    }
}

/**
 * API Handler cho route /api/checkmail?domain=
 */
async function checkmailHandler(req, res) {
    try {
        // Lấy domain từ query parameter
        const { domain } = req.query;
        
        // Kiểm tra tham số bắt buộc
        if (!domain) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu tham số domain',
                error: 'MISSING_DOMAIN_PARAMETER',
                usage: 'Sử dụng: /api/checkmail?domain=example.com'
            });
        }

        console.log(`🔍 API Request: Kiểm tra domain ${domain}`);

        // Tạo checker và kiểm tra
        const checker = new DomainChecker();
        const result = await checker.checkDomainReported(domain);
        
        // Trả về kết quả
        if (result.error) {
            return res.status(400).json({
                success: false,
                message: result.error,
                domain: domain,
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({
            success: true,
            domain: domain,
            reported: result.found,
            message: result.message,
            ...(result.date && { reportDate: result.date }),
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ API Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi kiểm tra domain',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

// Export both class and handler
module.exports = checkmailHandler;
module.exports.DomainChecker = DomainChecker;