const seachtik = async (req, res) => {
    const { fetch } = require('undici');
    try {
        
        // Gửi POST request đến tikwm.com
        const params = new URLSearchParams();
        params.append('region', 'VN');
        params.append('count', '12');
        params.append('cursor', '0');
        params.append('web', '1');
        params.append('hd', '1');
        

        const response = await fetch('https://tikwm.com/api/feed/list', {
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

        // Xử lý mảng video
        const videos = data.data.map((d, index) => {
            const result = {
                id: index + 1,
                title: d.title, 
                music: d.music_info ? d.music_info.play : d.music,
                author: d.author ? {
                    id: d.author.id,
                    unique_id: d.author.unique_id,
                    nickname: d.author.nickname,
                    avatar: "https://tikwm.com" + d.author.avatar
                } : null,
                play_count: d.play_count,
                digg_count: d.digg_count,
                comment_count: d.comment_count,
                share_count: d.share_count,
                images: d.images || []
            };

            // Thêm play URL nếu không có ảnh
            if (!d.images || d.images.length === 0) {
                result.play = "https://tikwm.com/" + d.play;
            }

            return result;
        });

        return res.json({
            success: true,
            data: videos
        });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = seachtik;
