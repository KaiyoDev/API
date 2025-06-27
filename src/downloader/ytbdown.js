const axios = require('axios');
const { shortenUrl } = require('../models/rutgon');

const ytbdown = async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({ success: false, error: 'Thiếu URL YouTube' });
        }

        // Trích xuất video ID từ URL YouTube
        const extractVideoId = (url) => {
            const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
            const match = url.match(regex);
            return match ? match[1] : null;
        };

        const videoId = extractVideoId(url);
        if (!videoId) {
            return res.status(400).json({ success: false, error: 'URL YouTube không hợp lệ' });
        }

        // Cấu hình API RapidAPI
        const options = {
            method: 'GET',
            url: 'https://ytstream-download-youtube-videos.p.rapidapi.com/dl',
            params: { id: videoId },
            headers: {
                'x-rapidapi-key': '235b3a5bc2mshef1427d4da7c0fbp118775jsn0aaa0d0a5355',
                'x-rapidapi-host': 'ytstream-download-youtube-videos.p.rapidapi.com'
            },
            timeout: 30000 // 30 giây timeout
        };

        // Gọi API để lấy thông tin video
        const response = await axios.request(options);
        const videoData = response.data;

        if (!videoData || !videoData.title) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy thông tin video' });
        }

        // Tìm video có chất lượng cao nhất từ adaptiveFormats
        let bestVideoFormat = null;
        if (videoData.adaptiveFormats && videoData.adaptiveFormats.length > 0) {
            // Lọc các format video MP4 only (không có audio)
            const videoFormats = videoData.adaptiveFormats.filter(format => 
                format.mimeType && 
                format.mimeType.includes('video/mp4') && 
                format.height &&
                !format.mimeType.includes('audio') // Đảm bảo chỉ lấy video
            );
            
            if (videoFormats.length > 0) {
                // Sắp xếp theo độ phân giải giảm dần để lấy chất lượng cao nhất
                videoFormats.sort((a, b) => b.height - a.height);
                bestVideoFormat = videoFormats[0];
            }
        }

        // Nếu không tìm thấy từ adaptiveFormats, thử tìm từ formats (video có audio)
        if (!bestVideoFormat && videoData.formats && videoData.formats.length > 0) {
            const videoFormats = videoData.formats.filter(format => 
                format.mimeType && 
                format.mimeType.includes('video/mp4') && 
                format.height
            );
            
            if (videoFormats.length > 0) {
                videoFormats.sort((a, b) => b.height - a.height);
                bestVideoFormat = videoFormats[0];
            }
        }

        if (!bestVideoFormat) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy định dạng video phù hợp' });
        }

        // Rút gọn URL download bằng module rút gọn URL
        let shortUrl = bestVideoFormat.url; // Fallback nếu rút gọn thất bại
        
        try {
            // Tạo mã tùy chỉnh dựa trên videoId để dễ nhận biết
            const customCode = `ytb_${videoId}_${bestVideoFormat.height}p`;
            
            // Rút gọn URL với thời gian hết hạn 2 giờ (đủ để download)
            const shortenResult = await shortenUrl(bestVideoFormat.url, customCode, 2);
            
            if (shortenResult.success) {
                shortUrl = shortenResult.data.shortUrl;
                console.log(`✅ Đã rút gọn URL YouTube: ${shortUrl}`);
            } else {
                console.log(`⚠️  Không thể rút gọn URL: ${shortenResult.message}`);
            }
        } catch (error) {
            console.error('❌ Lỗi khi rút gọn URL:', error.message);
            // Tiếp tục với URL gốc nếu rút gọn thất bại
        }

        // Tạo response data với URL đã được rút gọn
        const source = {
            id: 1,
            quality: bestVideoFormat.height + 'p',
            mimeType: bestVideoFormat.mimeType || 'video/mp4',
            size: bestVideoFormat.contentLength || 'unknown',
            url: shortUrl // URL đã được rút gọn
        };

        return res.json({
            success: true,
            data: {
                title: videoData.title,
                videoId: videoId,
                isShort: videoData.lengthSeconds < 60,
                description: videoData.description || '',
                author: {
                    name: videoData.channelTitle || 'Unknown',
                },
                source
            }
        });

    } catch (error) {
        console.error('Error in downloadYouTubeVideo:', error);
        
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            return res.status(504).json({
                success: false,
                error: 'Hết thời gian chờ khi lấy thông tin video'
            });
        }

        if (error.response && error.response.status === 404) {
            return res.status(404).json({
                success: false,
                error: 'Video không khả dụng hoặc đã bị xóa'
            });
        }

        if (error.response && error.response.status === 429) {
            return res.status(429).json({
                success: false,
                error: 'Quá nhiều request, vui lòng thử lại sau'
            });
        }

        return res.status(500).json({
            success: false,
            error: 'Lỗi server: ' + error.message
        });
    }
};

module.exports = ytbdown;
