const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

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
    const apiDocs = fs.readFileSync(path.join(__dirname, '../routes/api.txt'), 'utf8');
    res.send(`<pre>${apiDocs}</pre>`);
});

module.exports = router;
