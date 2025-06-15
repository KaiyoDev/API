const seachvidtik = async (req, res) => {
    const { fetch } = require('undici');
    try {
        const { keyword } = req.query;
        if (!keyword) {
            return res.status(400).json({ success: false, error: 'Thiếu tham số keyword' });
        }

        const params = new URLSearchParams();
        params.append('keywords', keyword);
        params.append('count', '12');
        params.append('cursor', '0');
        params.append('web', '1');
        params.append('hd', '1');

        const response = await fetch('https://tikwm.com/api/feed/search', {
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

        // Kiểm tra cấu trúc dữ liệu
        if (!data.data || !data.data.videos || !Array.isArray(data.data.videos)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Cấu trúc dữ liệu không hợp lệ' 
            });
        }

        // Xử lý mảng video
        const videos = data.data.videos.map((d, index) => {
            return {
                id: index + 1,
                video_id: d.video_id,
                title: d.title || '',
                region: d.region || '',
                play: "https://tikwm.com/" + d.play,
                duration: d.duration || 0,
                music: d.music_info ? {
                    id: d.music_info.id,
                    title: d.music_info.title,
                    play: d.music_info.play,
                    author: d.music_info.author,
                    duration: d.music_info.duration
                } : null,
                play_count: parseInt(d.play_count) || 0,
                digg_count: parseInt(d.digg_count) || 0,
                comment_count: parseInt(d.comment_count) || 0,
                share_count: parseInt(d.share_count) || 0,
                download_count: parseInt(d.download_count) || 0,
                create_time: d.create_time,
                author: d.author ? {
                    id: d.author.id,
                    unique_id: d.author.unique_id,
                    nickname: d.author.nickname,
                    avatar: d.author.avatar.startsWith('http') ? d.author.avatar : ("https://tikwm.com" + d.author.avatar)
                } : null
            };
        });

        return res.json({
            success: true,
            data: videos
        });

    } catch (error) {
        console.error('Error in seachtikv2:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Lỗi server: ' + error.message 
        });
    }
};

module.exports = seachvidtik;
