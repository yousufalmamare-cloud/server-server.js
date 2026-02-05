const mongoose = require('mongoose');

const broadcastSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    message: {
        type: String,
        required: [true, 'Message is required'],
        trim: true,
        maxlength: [5000, 'Message cannot exceed 5000 characters']
    },
    urgency: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    type: {
        type: String,
        enum: ['announcement', 'alert', 'maintenance', 'update', 'news', 'meeting'],
        default: 'announcement'
    },
    tags: [{
        type: String,
        trim: true
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    expiryDate: {
        type: Date,
        default: null
    },
    status: {
        type: String,
        enum: ['active', 'expired', 'archived'],
        default: 'active'
    },
    views: {
        type: Number,
        default: 0
    },
    priority: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for better performance
broadcastSchema.index({ status: 1, expiryDate: 1 });
broadcastSchema.index({ createdBy: 1, createdAt: -1 });
broadcastSchema.index({ urgency: 1, createdAt: -1 });

// Virtual for checking if broadcast is expired
broadcastSchema.virtual('isExpired').get(function() {
    if (!this.expiryDate) return false;
    return this.expiryDate < new Date();
});

// Update status if expired
broadcastSchema.pre('save', function(next) {
    if (this.expiryDate && this.expiryDate < new Date()) {
        this.status = 'expired';
    }
    next();
});

const Broadcast = mongoose.model('Broadcast', broadcastSchema);
module.exports = Broadcast;
