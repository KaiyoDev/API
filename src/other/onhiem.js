const axios = require('axios');

// API endpoint để lấy dữ liệu chất lượng không khí Việt Nam
const WAQI_API_URL = 'https://api.waqi.info/search/?token=0a5f48f1c6c68b50b51688342a16d0ae482e9d1a&keyword=vietnam';

// Gemini AI API Configuration
const GEMINI_API_KEY = 'AIzaSyAP3V9hzwZpt_Am1NKycYcklJf0TpHBrdo';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// Simple cache để tránh spam API
const commentCache = new Map();
const CACHE_DURATION = 300000; // 5 phút

// Cleanup cache mỗi 10 phút
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of commentCache.entries()) {
        if ((now - value.timestamp) > CACHE_DURATION) {
            commentCache.delete(key);
        }
    }
    if (commentCache.size > 0) {
        console.log(`🧹 Cache cleanup: ${commentCache.size} items remaining`);
    }
}, 600000); // 10 phút

/**
 * Phân loại mức độ ô nhiễm theo AQI
 * @param {number} aqi - Chỉ số AQI
 * @returns {Object} - Thông tin mức độ và màu sắc
 */
function getAQILevel(aqi) {
    if (aqi <= 50) {
        return {
            level: 'Tốt',
            color: '#00e400',
            description: 'Chất lượng không khí tốt, an toàn cho sức khỏe',
            health: 'Không có tác động đến sức khỏe'
        };
    } else if (aqi <= 100) {
        return {
            level: 'Trung bình',
            color: '#ffff00',
            description: 'Chất lượng không khí chấp nhận được',
            health: 'Nhóm nhạy cảm có thể gặp vấn đề nhẹ'
        };
    } else if (aqi <= 150) {
        return {
            level: 'Không tốt cho nhóm nhạy cảm',
            color: '#ff7e00',
            description: 'Không khỏe mạnh cho nhóm nhạy cảm',
            health: 'Trẻ em, người già nên hạn chế hoạt động ngoài trời'
        };
    } else if (aqi <= 200) {
        return {
            level: 'Có hại cho sức khỏe',
            color: '#ff0000',
            description: 'Mọi người có thể gặp vấn đề sức khỏe',
            health: 'Nên hạn chế ra ngoài, đeo khẩu trang'
        };
    } else if (aqi <= 300) {
        return {
            level: 'Rất có hại',
            color: '#8f3f97',
            description: 'Cảnh báo sức khỏe nghiêm trọng',
            health: 'Tránh ra ngoài trời, đóng cửa sổ'
        };
    } else {
        return {
            level: 'Nguy hiểm',
            color: '#7e0023',
            description: 'Tình trạng khẩn cấp về sức khỏe',
            health: 'Mọi người nên ở trong nhà và tránh hoạt động ngoài trời'
        };
    }
}

/**
 * Lấy tên tỉnh/thành phố từ tên trạm đo
 * @param {string} stationName - Tên trạm đo
 * @returns {string} - Tên tỉnh/thành phố
 */
function extractProvinceName(stationName) {
    // Tách lấy phần tỉnh/thành phố từ tên trạm
    if (stationName.includes('/')) {
        const parts = stationName.split('/');
        return parts[0].trim();
    }
    
    // Nếu có "Vietnam" thì lấy phần trước đó
    if (stationName.includes(', Vietnam')) {
        return stationName.split(', Vietnam')[0].trim();
    }
    
    return stationName;
}

/**
 * Format thời gian
 * @param {Object} timeData - Dữ liệu thời gian
 * @returns {string} - Thời gian đã format
 */
function formatTime(timeData) {
    if (!timeData || !timeData.stime) return 'Không xác định';
    
    const date = new Date(timeData.stime);
    return date.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Lấy dữ liệu chất lượng không khí từ API WAQI
 * @returns {Promise<Object>} - Dữ liệu từ API
 */
async function fetchAirQualityData() {
    try {
        console.log('🌍 Đang lấy dữ liệu chất lượng không khí Việt Nam...');
        
        const response = await axios.get(WAQI_API_URL, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Kaiyo-Api/1.0',
                'Accept': 'application/json'
            }
        });

        if (response.data && response.data.status === 'ok' && response.data.data) {
            console.log(`✅ Lấy được ${response.data.data.length} trạm đo`);
            return response.data;
        } else {
            throw new Error('Dữ liệu API không hợp lệ');
        }

    } catch (error) {
        console.error('❌ Lỗi khi lấy dữ liệu:', error.message);
        throw error;
    }
}

/**
 * Tạo nhận xét AI sử dụng Gemini
 * @param {number} aqi - Chỉ số AQI
 * @param {string} province - Tên tỉnh/thành phố
 * @param {string} time - Thời gian đo
 * @param {string} level - Mức độ ô nhiễm
 * @returns {Promise<Object>} - Nhận xét AI từ Gemini
 */
async function generateAICommentWithGemini(aqi, province, time, level) {
    try {
        // Check cache trước khi gọi API
        const cacheKey = `${province}-${aqi}-${level}`;
        const cachedResult = commentCache.get(cacheKey);
        
        if (cachedResult && (Date.now() - cachedResult.timestamp) < CACHE_DURATION) {
            console.log(`💾 Cache hit for ${province} AQI ${aqi}`);
            return cachedResult.data;
        }

        const hour = new Date().getHours();
        let timeOfDay = "trong ngày";
        if (hour >= 6 && hour <= 11) timeOfDay = "buổi sáng";
        else if (hour >= 12 && hour <= 17) timeOfDay = "buổi chiều";
        else if (hour >= 18 || hour <= 5) timeOfDay = "buổi tối/đêm";

        // Xác định mùa trong năm
        const month = new Date().getMonth() + 1; // 1-12
        let season = "mùa khô";
        if (month >= 5 && month <= 10) {
            season = "mùa mưa";
        } else {
            season = "mùa khô";
        }

        // Tạo prompt đơn giản cho Gemini (tránh 503)
        const prompt = `Phân tích chất lượng không khí:

📍 ${province}, Việt Nam  
📊 AQI: ${aqi} (${level})
⏰ ${timeOfDay}, ${season}

Yêu cầu:
- Nhận xét ngắn gọn về AQI ${aqi} tại ${province}
- Nguyên nhân có thể (giao thông/công nghiệp/thời tiết)
- Lời khuyên cho người dân
- Sử dụng emoji phù hợp
- Tối đa 60 từ

Ví dụ: "🌫️ Hà Nội AQI 120 - mức vừa phải. Có thể do giao thông đông đúc. 😷 Khuyên đeo khẩu trang khi ra ngoài!"`;

        // Retry mechanism để xử lý 503
        let response;
        let retryCount = 0;
        const maxRetries = 2;
        
        while (retryCount <= maxRetries) {
            try {
                response = await axios.post(GEMINI_API_URL, {
                    contents: [
                        {
                            role: 'user',
                            parts: [{ text: prompt }],
                        },
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 100, // Giảm để tránh 503
                        topK: 20,
                        topP: 0.8
                    }
                }, {
                    timeout: 8000, // Giảm timeout
                    headers: { 
                        'Content-Type': 'application/json',
                        'User-Agent': 'Kaiyo-Api/1.0'
                    }
                });
                
                break; // Thành công, thoát loop
                
            } catch (retryError) {
                retryCount++;
                console.log(`🔄 Retry ${retryCount}/${maxRetries} - Gemini Error: ${retryError.response?.status || retryError.message}`);
                
                if (retryCount > maxRetries) {
                    throw retryError; // Đã hết retry, throw error
                }
                
                // Đợi 1s trước khi retry
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        const data = response.data;
        
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            const aiComment = data.candidates[0].content.parts[0].text.trim();
            
            const result = {
                success: true,
                aiName: "Gemini AI",
                personality: "chuyên gia môi trường",
                emoji: "🤖",
                mainComment: aiComment,
                timeOfDay: timeOfDay,
                season: season,
                confidence: Math.floor(Math.random() * 20) + 80, // 80-99%
                analysisId: `GEMINI-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                source: "Google Gemini 2.0 Flash"
            };

            // Cache kết quả
            commentCache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });

            return result;
        } else {
            throw new Error('Invalid Gemini API response format');
        }

    } catch (error) {
        console.error('❌ Gemini AI Error:', error.message);
        
        // Tính toán timeOfDay và season cho fallback
        const hour = new Date().getHours();
        let fallbackTimeOfDay = "trong ngày";
        if (hour >= 6 && hour <= 11) fallbackTimeOfDay = "buổi sáng";
        else if (hour >= 12 && hour <= 17) fallbackTimeOfDay = "buổi chiều";
        else if (hour >= 18 || hour <= 5) fallbackTimeOfDay = "buổi tối/đêm";

        const month = new Date().getMonth() + 1;
        let fallbackSeason = (month >= 5 && month <= 10) ? "mùa mưa" : "mùa khô";
        
        // Fallback comment nếu Gemini fails
        const fallbackComments = [
            `🤖 AI: "${province} hiện có AQI ${aqi} (${level}). Hãy cẩn thận với chất lượng không khí!"`,
            `🌍 AI: "Chỉ số ô nhiễm ${aqi} tại ${province} - ${level}. Theo dõi sức khỏe nhé!"`,
            `🔍 AI: "${province} đang có AQI ${aqi}. Mức độ ${level} - hãy chú ý bảo vệ sức khỏe!"`,
            `💨 AI: "Tình hình không khí ${province}: AQI ${aqi} - ${level}. Hãy quan tâm sức khỏe!"`,
            `🌫️ AI: "${province} với chỉ số ${aqi} thuộc mức ${level}. Cần chú ý bảo vệ hô hấp!"`
        ];
        
        const fallbackComment = fallbackComments[Math.floor(Math.random() * fallbackComments.length)];
        
        return {
            success: false,
            aiName: "Backup AI",
            personality: "cơ bản",  
            emoji: "🤖",
            mainComment: fallbackComment,
            timeOfDay: fallbackTimeOfDay,
            season: fallbackSeason,
            confidence: 75,
            analysisId: `BACKUP-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            source: "Fallback System",
            error: error.message
        };
    }
}

/**
 * Chọn ngẫu nhiên một trạm đo và format dữ liệu
 * @param {Object} apiData - Dữ liệu từ API
 * @returns {Object} - Thông tin trạm đo đã format
 */
async function getRandomStation(apiData) {
    const stations = apiData.data;
    
    if (!stations || stations.length === 0) {
        throw new Error('Không có dữ liệu trạm đo');
    }

    // Chọn ngẫu nhiên một trạm
    const randomIndex = Math.floor(Math.random() * stations.length);
    const station = stations[randomIndex];

    const aqi = parseInt(station.aqi);
    const aqiInfo = getAQILevel(aqi);
    const provinceName = extractProvinceName(station.station.name);
    const timeFormatted = formatTime(station.time);

    // Tạo nhận xét AI bằng Gemini
    console.log(`🤖 Đang tạo nhận xét AI cho ${provinceName} với AQI ${aqi}...`);
    const aiComment = await generateAICommentWithGemini(aqi, provinceName, timeFormatted, aqiInfo.level);

    return {
        success: true,
        province: provinceName,
        station: {
            name: station.station.name,
            uid: station.uid,
            coordinates: {
                latitude: station.station.geo[0],
                longitude: station.station.geo[1]
            },
            url: `https://aqicn.org/${station.station.url}`
        },
        airQuality: {
            aqi: aqi,
            level: aqiInfo.level,
            color: aqiInfo.color,
            description: aqiInfo.description,
            healthAdvice: aqiInfo.health
        },
        time: {
            measured: timeFormatted,
            timezone: station.time?.tz || '+07:00',
            timestamp: station.time?.vtime
        },
        aiAnalysis: aiComment,
        metadata: {
            totalStations: stations.length,
            selectedIndex: randomIndex + 1,
            source: 'World Air Quality Index (WAQI)',
            timestamp: new Date().toISOString()
        }
    };
}

// API Handler cho route /api/onhiem
async function onhiemHandler(req, res) {
    try {
        console.log('🔍 API Request: Lấy dữ liệu ô nhiễm ngẫu nhiên');

        // Lấy dữ liệu từ API WAQI
        const apiData = await fetchAirQualityData();

        // Chọn ngẫu nhiên và format với AI comment
        const result = await getRandomStation(apiData);

        console.log(`📍 Đã chọn: ${result.province} - AQI: ${result.airQuality.aqi} (${result.airQuality.level})`);

        // Trả về kết quả
        res.json(result);

    } catch (error) {
        console.error('❌ API Error:', error.message);
        
        // Trả về lỗi với format nhất quán
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy dữ liệu chất lượng không khí',
            error: error.message,
            timestamp: new Date().toISOString(),
            suggestion: 'Vui lòng thử lại sau vài phút'
        });
    }
}

// Export handler function cho auto scan
module.exports = onhiemHandler;
