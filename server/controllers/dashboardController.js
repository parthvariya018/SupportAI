const Conversation = require('../models/Conversation');
const Lead         = require('../models/Lead');
const Document     = require('../models/Document');
const Ticket       = require('../models/Ticket');
const catchAsync   = require('../utils/catchAsync');

exports.getStats = catchAsync(async (req, res) => {
  const cId = req.companyId;

  const [conversations, leads, docCount, docAgg, ticketAgg, recentTickets, recentLeads] = await Promise.all([
    Conversation.countDocuments({ companyId: cId }),
    Lead.countDocuments({ companyId: cId }),
    Document.countDocuments({ companyId: cId }),
    Document.aggregate([
      { $match: { companyId: cId } },
      { $group: { _id: null, totalPages: { $sum: '$pageCount' }, totalWords: { $sum: '$wordCount' } } },
    ]),
    Ticket.aggregate([
      { $match: { companyId: cId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Ticket.find({ companyId: cId })
      .select('title status priority reportedBy createdAt')
      .populate('reportedBy', 'name')
      .sort('-createdAt')
      .limit(5)
      .lean(),
    Lead.find({ companyId: cId })
      .select('name email createdAt')
      .sort('-createdAt')
      .limit(5)
      .lean(),
  ]);

  const { totalPages = 0, totalWords = 0 } = docAgg[0] ?? {};

  // Daily conversation counts for the last 7 days
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const dailyStats = await Conversation.aggregate([
    { $match: { companyId: cId, createdAt: { $gte: weekAgo } } },
    { $group: {
      _id:           { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
      conversations: { $sum: 1 },
    }},
    { $sort: { _id: 1 } },
  ]);

  const byStatus = ticketAgg.reduce((acc, t) => ({ ...acc, [t._id]: t.count }), {});

  res.json({
    status: 'success',
    overview: {
      conversations: { total: conversations },
      tickets:       { open: byStatus.open || 0, in_progress: byStatus.in_progress || 0, resolved: byStatus.resolved || 0 },
      leads:         { total: leads },
      documents:     { count: docCount, totalPages, totalWords },
    },
    dailyStats,
    recentTickets,
    recentLeads,
  });
});
