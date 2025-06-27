// Test module rút gọn link
const { shortenUrl, redirect, getStats, getAllUrls, setBaseUrl } = require('./src/models/rutgon');

console.log('🧪 Test module rút gọn link\n');

// 1. Cập nhật base URL cho local
setBaseUrl('http://localhost:5000');
console.log('✅ Đã cập nhật base URL: http://localhost:5000\n');

// 2. Test rút gọn URL
console.log('📝 Test rút gọn URL:');
const result1 = shortenUrl('https://www.google.com/search?q=nodejs+express');
console.log('URL gốc:', 'https://www.google.com/search?q=nodejs+express');
console.log('Kết quả:', result1);
console.log('Link rút gọn:', result1.data?.shortUrl);
console.log('');

// 3. Test với mã tùy chỉnh
console.log('📝 Test với mã tùy chỉnh:');
const result2 = shortenUrl('https://github.com/nodejs/node', 'github');
console.log('URL gốc:', 'https://github.com/nodejs/node');
console.log('Mã tùy chỉnh:', 'github');
console.log('Kết quả:', result2);
console.log('');

// 4. Test chuyển tiếp
console.log('📝 Test chuyển tiếp:');
if (result1.success) {
    const redirectResult = redirect(result1.data.shortCode);
    console.log('Mã rút gọn:', result1.data.shortCode);
    console.log('Kết quả chuyển tiếp:', redirectResult);
    console.log('');
}

// 5. Test thống kê
console.log('📝 Test thống kê:');
if (result1.success) {
    const stats = getStats(result1.data.shortCode);
    console.log('Thống kê:', stats);
    console.log('');
}

// 6. Xem tất cả URLs
console.log('📝 Danh sách tất cả URLs:');
const allUrls = getAllUrls();
console.log('Tổng số URLs:', allUrls.data?.totalUrls);
console.log('Danh sách:', allUrls.data?.urls);
console.log('');

console.log('🎉 Test hoàn tất! Bây giờ bạn có thể:');
console.log('1. Chạy server: npm start');
console.log('2. Test API qua Postman hoặc curl');
console.log('3. Truy cập link rút gọn trực tiếp'); 