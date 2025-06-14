const dowtik = async (req, res) => {
    const { fetch } = require('undici');
    try {
        const { url } = req.query;
        if (!url) {
            return res.status(400).json({ success: false, error: 'Thiếu tham số url' });
        }

        // Gửi POST request đến tikwm.com
        const params = new URLSearchParams();
        params.append('url', url);
        params.append('count', '12');
        params.append('cursor', '0');
        params.append('web', '1');
        params.append('hd', '1');

        const response = await fetch('https://tikwm.com/api/', {
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

        // Lấy các trường cần thiết
        const d = data.data;
        const result = {
            id: d.id,
            title: d.title,
            cover: "https://tikwm.com" + d.cover,
            duration: d.duration,
            play: "https://tikwm.com/" + d.play,
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
            share_count: d.share_count
        };

        return res.json({
            success: true,
            data: result
        });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = dowtik;
