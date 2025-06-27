const express = require("express");
var app = express();
const indexApi = require('./routes/api')

// Import module rút gọn link cho chuyển tiếp
const { redirect, setBaseUrl } = require('./src/models/rutgon');

process.on('uncaughtException', console.log)

const PORT = process.env.PORT || 5000;
const DOMAIN = process.env.DOMAIN || 'localhost';

// Cấu hình base URL theo môi trường
if (process.env.NODE_ENV === 'production') {
    setBaseUrl(`https://${DOMAIN}`);
} else {
    setBaseUrl(`http://${DOMAIN}:${PORT}`);
}

app.use(express.json());
app.set("json spaces",2)

// Middleware để lấy IP address
app.use((req, res, next) => {
    req.clientIP = req.headers['x-forwarded-for'] || 
                   req.headers['x-real-ip'] || 
                   req.connection.remoteAddress || 
                   req.socket.remoteAddress ||
                   (req.connection.socket ? req.connection.socket.remoteAddress : null);
    next();
});

app.use('/api', indexApi);

app.get('/', (req, res) => {
	res.sendFile(__dirname + '/public/index.html')
})

app.get('/js/main.js', (req, res) => {
	res.sendFile(__dirname + '/public/js/main.js')
})

app.get('/css/style.css', (req, res) => {
	res.sendFile(__dirname + '/public/css/style.css')
})

// Route chuyển tiếp cho link rút gọn với tracking
app.get('/:shortCode', async (req, res) => {
    const { shortCode } = req.params;
    
    // Bỏ qua các route static
    if (['js', 'css', 'api', 'favicon.ico', 'robots.txt'].includes(shortCode)) {
        return res.status(404).send('Not Found');
    }
    
    try {
        const result = await redirect(shortCode, req.clientIP, req.get('User-Agent'));
        
        if (result.success) {
            // Chuyển tiếp đến URL gốc với 301 redirect
            res.redirect(301, result.data.originalUrl);
        } else {
            // Nếu không tìm thấy, hiển thị trang lỗi 404 đẹp
            res.status(404).json({
                success: false,
                message: '🔗 Link rút gọn không tồn tại hoặc đã hết hạn',
                error: result.error,
                shortCode: shortCode,
                suggestion: 'Kiểm tra lại link hoặc liên hệ người tạo link'
            });
        }
    } catch (error) {
        console.error('❌ Lỗi redirect:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi xử lý redirect',
            error: error.message
        });
    }
});

// Khởi động server
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại: ${process.env.NODE_ENV === 'production' ? 'https' : 'http'}://${DOMAIN}${process.env.NODE_ENV === 'production' ? '' : ':' + PORT}`)
    console.log(`🔗 URL Shortener Service đã sẵn sàng!`)
});
