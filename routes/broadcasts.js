const express = require('express');
const router = express.Router();
const Broadcast = require('../models/Broadcast');
const auth = require('../middleware/auth');

// @route   GET /api/broadcasts
// @desc    Get all broadcasts
// @access  Public
router.get('/', async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            type, 
            urgency, 
            status = 'active',
            search,
            sort = '-createdAt'
        } = req.query;

        const query = {};

        // Filter by type
        if (type) query.type = type;
        
        // Filter by urgency
        if (urgency) query.urgency = urgency;
        
        // Filter by status
        if (status) query.status = status;

        // Search in title and message
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { message: { $regex: search, $options: 'i' } },
                { tags: { $regex: search, $options: 'i' } }
            ];
        }

        // Execute query with pagination
        const broadcasts = await Broadcast.find(query)
            .populate('createdBy', 'username email')
            .sort(sort)
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await Broadcast.countDocuments(query);

        res.json({
            success: true,
            data: broadcasts,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// @route   GET /api/broadcasts/:id
// @desc    Get single broadcast
// @access  Public
router.get('/:id', async (req, res) => {
    try {
        const broadcast = await Broadcast.findById(req.params.id)
            .populate('createdBy', 'username email');
        
        if (!broadcast) {
            return res.status(404).json({ 
                success: false, 
                message: 'Broadcast not found' 
            });
        }

        // Increment view count
        broadcast.views += 1;
        await broadcast.save();

        res.json({
            success: true,
            data: broadcast
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// @route   POST /api/broadcasts
// @desc    Create new broadcast
// @access  Private
router.post('/', auth, async (req, res) => {
    try {
        const { title, message, urgency, type, tags, expiryDate } = req.body;

        const broadcast = new Broadcast({
            title,
            message,
            urgency,
            type,
            tags,
            expiryDate,
            createdBy: req.user.id
        });

        await broadcast.save();

        // Populate creator info
        await broadcast.populate('createdBy', 'username email').execPopulate();

        res.status(201).json({
            success: true,
            data: broadcast,
            message: 'Broadcast created successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// @route   PUT /api/broadcasts/:id
// @desc    Update broadcast
// @access  Private
router.put('/:id', auth, async (req, res) => {
    try {
        let broadcast = await Broadcast.findById(req.params.id);

        if (!broadcast) {
            return res.status(404).json({ 
                success: false, 
                message: 'Broadcast not found' 
            });
        }

        // Check ownership
        if (broadcast.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                message: 'Not authorized' 
            });
        }

        // Update fields
        const updates = req.body;
        Object.keys(updates).forEach(key => {
            broadcast[key] = updates[key];
        });

        await broadcast.save();
        
        // Populate creator info
        await broadcast.populate('createdBy', 'username email').execPopulate();

        res.json({
            success: true,
            data: broadcast,
            message: 'Broadcast updated successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// @route   DELETE /api/broadcasts/:id
// @desc    Delete broadcast
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        const broadcast = await Broadcast.findById(req.params.id);

        if (!broadcast) {
            return res.status(404).json({ 
                success: false, 
                message: 'Broadcast not found' 
            });
        }

        // Check ownership or admin
        if (broadcast.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                message: 'Not authorized' 
            });
        }

        await broadcast.remove();

        res.json({
            success: true,
            message: 'Broadcast deleted successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// @route   GET /api/broadcasts/stats/summary
// @desc    Get broadcast statistics
// @access  Public
router.get('/stats/summary', async (req, res) => {
    try {
        const stats = await Broadcast.aggregate([
            {
                $facet: {
                    totalBroadcasts: [
                        { $count: 'count' }
                    ],
                    byUrgency: [
                        { $group: { _id: '$urgency', count: { $sum: 1 } } }
                    ],
                    byType: [
                        { $group: { _id: '$type', count: { $sum: 1 } } }
                    ],
                    activeBroadcasts: [
                        { $match: { status: 'active' } },
                        { $count: 'count' }
                    ],
                    recentActivity: [
                        { $sort: { createdAt: -1 } },
                        { $limit: 5 },
                        { $project: { title: 1, createdAt: 1, urgency: 1 } }
                    ]
                }
            }
        ]);

        res.json({
            success: true,
            data: stats[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

module.exports = router;
