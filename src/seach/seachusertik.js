const seachusertik = async (req, res) => {
    const { fetch } = require('undici');
    try {
        const { user } = req.query;
        if (!user) {
            return res.status(400).json({ success: false, error: 'Thiếu tham số user' });
        }

        const params = new URLSearchParams();
        params.append('unique_id', '@' + user);
        params.append('count', '12');
        params.append('cursor', '0');
        params.append('web', '1');
        params.append('hd', '1');

        const response = await fetch('https://tikwm.com/api/user/posts', {
            method: 'POST',
            headers: {
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.0.0.0',
                'accept': 'application/json, text/javascript, */*; q=0.01',
                'referer': 'https://tikwm.com/',
                'origin': 'https://tikwm.com'
            },
            body: params
        });

        const data = await response.json();

        if (data.code !== 0) {
            return res.status(400).json({ success: false, error: data.msg || 'Lỗi không xác định' });
        }

        // Kiểm tra xem data.data.videos có tồn tại và là mảng không
        if (!data.data || !Array.isArray(data.data.videos)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Dữ liệu không hợp lệ' 
            });
        }

        const videosArr = data.data.videos;

        // Tính toán thống kê
        let totalLikes = 0;
        let totalShares = 0;
        let totalComments = 0;
        let totalViews = 0;
        let userInfo = null;

        // Xử lý mảng video
        const videos = videosArr.map((d, index) => {
            // Cập nhật thống kê
            totalLikes += parseInt(d.digg_count) || 0;
            totalShares += parseInt(d.share_count) || 0;
            totalComments += parseInt(d.comment_count) || 0;
            totalViews += parseInt(d.play_count) || 0;

            // Lưu thông tin người dùng từ video đầu tiên
            if (index === 0 && d.author) {
                userInfo = {
                    id: d.author.id,
                    unique_id: d.author.unique_id,
                    nickname: d.author.nickname,
                    avatar: d.author.avatar.startsWith('http') ? d.author.avatar : ("https://tikwm.com" + d.author.avatar)
                };
            }

            return
        });

        return res.json({
            success: true,
            statistics: {
                total_videos: videos.length,
                total_likes: totalLikes,
                total_shares: totalShares,
                total_comments: totalComments,
                total_views: totalViews
            }, userInfo
        });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Lỗi server: ' + error.message 
        });
    }
};

module.exports = seachusertik;
