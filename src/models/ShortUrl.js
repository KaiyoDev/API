const mongoose = require('mongoose');

const shortUrlSchema = new mongoose.Schema({
    shortCode: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    originalUrl: {
        type: String,
        required: true
    },
    customCode: {
        type: Boolean,
        default: false
    },
    clicks: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h từ bây giờ
        index: { expireAfterSeconds: 0 } // MongoDB TTL index - tự động xóa
    },
    lastAccessAt: {
        type: Date,
        default: Date.now
    },
    userAgent: String,
    ip: String
}, {
    timestamps: true
});

// Index cho performance
shortUrlSchema.index({ createdAt: -1 });
shortUrlSchema.index({ clicks: -1 });

// Virtual để tính thời gian còn lại
shortUrlSchema.virtual('timeLeft').get(function() {
    const now = new Date();
    const timeDiff = this.expiresAt - now;
    
    if (timeDiff <= 0) return 'Đã hết hạn';
    
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
});

// Method để tăng click count
shortUrlSchema.methods.incrementClick = async function(ip, userAgent) {
    this.clicks += 1;
    this.lastAccessAt = new Date();
    
    if (ip) this.ip = ip;
    if (userAgent) this.userAgent = userAgent;
    
    await this.save();
    return this;
};

// Static method để tìm và cleanup URLs hết hạn
shortUrlSchema.statics.cleanupExpired = async function() {
    const result = await this.deleteMany({ 
        expiresAt: { $lt: new Date() } 
    });
    
    console.log(`🗑️  Đã xóa ${result.deletedCount} URLs hết hạn`);
    return result;
};

// Static method để thống kê
shortUrlSchema.statics.getStats = async function() {
    const totalUrls = await this.countDocuments();
    const totalClicks = await this.aggregate([
        { $group: { _id: null, total: { $sum: '$clicks' } } }
    ]);
    
    const topUrls = await this.find()
        .sort({ clicks: -1 })
        .limit(5)
        .select('shortCode originalUrl clicks');
        
    return {
        totalUrls,
        totalClicks: totalClicks[0]?.total || 0,
        topUrls
    };
};

module.exports = mongoose.model('ShortUrl', shortUrlSchema); 