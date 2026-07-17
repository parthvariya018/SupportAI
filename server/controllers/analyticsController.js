const Conversation = require('../models/Conversation');
const Ticket       = require('../models/Ticket');
const Lead         = require('../models/Lead');
const Document     = require('../models/Document');
const User         = require('../models/User');
const catchAsync   = require('../utils/catchAsync');
const mongoose     = require('mongoose');

// Helper: always cast companyId to ObjectId for aggregation $match stages.
// On some MongoDB versions a string ID silently matches nothing.
const oid = (id) => new mongoose.Types.ObjectId(id);

// GET /api/analytics/overview
exports.getOverview = catchAsync(async (req, res) => {
  const cId        = oid(req.companyId);
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart  = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [
    totalConversations, thisMonthConversations,
    openTickets, resolvedTickets,
    totalLeads, thisWeekLeads,
    docAgg,
  ] = await Promise.all([
    Conversation.countDocuments({ companyId: cId }),
    Conversation.countDocuments({ companyId: cId, createdAt: { $gte: monthStart } }),
    Ticket.countDocuments({ companyId: cId, status: { $in: ['open', 'in_progress'] } }),
    Ticket.countDocuments({ companyId: cId, status: 'resolved' }),
    Lead.countDocuments({ companyId: cId }),
    Lead.countDocuments({ companyId: cId, createdAt: { $gte: weekStart } }),
    Document.aggregate([
      { $match: { companyId: cId } },
      { $group: { _id: null, totalPages: { $sum: '$pageCount' }, totalWords: { $sum: '$wordCount' }, count: { $sum: 1 } } },
    ]),
  ]);

  const dailyStats = await Conversation.aggregate([
    { $match: { companyId: cId, createdAt: { $gte: weekStart } } },
    { $group: {
      _id:           { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
      conversations: { $sum: 1 },
    }},
    { $sort: { _id: 1 } },
  ]);

  res.json({
    status: 'success',
    overview: {
      conversations: { total: totalConversations, thisMonth: thisMonthConversations },
      tickets:       { open: openTickets, resolved: resolvedTickets },
      leads:         { total: totalLeads, thisWeek: thisWeekLeads },
      documents:     docAgg[0] ?? { count: 0, totalPages: 0, totalWords: 0 },
    },
    dailyStats,
  });
});

// GET /api/analytics/conversations
exports.getConversationStats = catchAsync(async (req, res) => {
  const cId = oid(req.companyId);

  const [byStatus, recentConversations] = await Promise.all([
    Conversation.aggregate([
      { $match: { companyId: cId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Conversation.find({ companyId: cId })
      .select('sessionId title messageCount updatedAt leadCaptured')
      .sort('-updatedAt').limit(10),
  ]);

  res.json({ status: 'success', byStatus, recentConversations });
});

// GET /api/analytics/tickets
exports.getTicketStats = catchAsync(async (req, res) => {
  const cId = oid(req.companyId);

  const [byPriority, byStatus, resolutionAgg] = await Promise.all([
    Ticket.aggregate([
      { $match: { companyId: cId } },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]),
    Ticket.aggregate([
      { $match: { companyId: cId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    // Average resolution time in hours for resolved tickets
    Ticket.aggregate([
      { $match: { companyId: cId, status: 'resolved', resolvedAt: { $exists: true } } },
      { $project: {
        resolutionHours: {
          $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 3600000],
        },
      }},
      { $group: { _id: null, avgHours: { $avg: '$resolutionHours' } } },
    ]),
  ]);

  res.json({
    status: 'success',
    byPriority,
    byStatus,
    avgResolutionHours: resolutionAgg[0]?.avgHours ?? null,
  });
});

// GET /api/analytics/volume?days=30
exports.getVolumeStats = catchAsync(async (req, res) => {
  const cId  = oid(req.companyId);
  const days = Math.min(90, parseInt(req.query.days) || 30);
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [chatVolume, ticketVolume] = await Promise.all([
    Conversation.aggregate([
      { $match: { companyId: cId, createdAt: { $gte: from } } },
      { $group: {
        _id:  { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        chats: { $sum: 1 },
      }},
      { $sort: { _id: 1 } },
    ]),
    Ticket.aggregate([
      { $match: { companyId: cId, createdAt: { $gte: from } } },
      { $group: {
        _id:     { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        tickets: { $sum: 1 },
      }},
      { $sort: { _id: 1 } },
    ]),
  ]);

  // Merge into a single timeline
  const dateMap = {};
  chatVolume.forEach(d => { dateMap[d._id] = { date: d._id, chats: d.chats, tickets: 0 }; });
  ticketVolume.forEach(d => {
    if (dateMap[d._id]) dateMap[d._id].tickets = d.tickets;
    else dateMap[d._id] = { date: d._id, chats: 0, tickets: d.tickets };
  });

  res.json({
    status: 'success',
    volume: Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date)),
  });
});

// GET /api/analytics/agents
exports.getAgentStats = catchAsync(async (req, res) => {
  const cId = oid(req.companyId);

  const agentStats = await Ticket.aggregate([
    { $match: { companyId: cId, assignedTo: { $exists: true, $ne: null } } },
    { $group: {
      _id:        '$assignedTo',
      total:      { $sum: 1 },
      resolved:   { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
      open:       { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
      avgResolutionHours: {
        $avg: {
          $cond: [
            { $and: [{ $eq: ['$status', 'resolved'] }, { $ifNull: ['$resolvedAt', false] }] },
            { $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 3600000] },
            null,
          ],
        },
      },
    }},
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'agent' } },
    { $unwind: '$agent' },
    { $project: {
      agentId:  '$_id',
      name:     '$agent.name',
      email:    '$agent.email',
      avatar:   '$agent.avatar',
      total:    1, resolved: 1, open: 1, avgResolutionHours: 1,
    }},
    { $sort: { total: -1 } },
  ]);

  res.json({ status: 'success', agents: agentStats });
});

// GET /api/analytics/csat
exports.getCSAT = catchAsync(async (req, res) => {
  const cId  = oid(req.companyId);
  const days = parseInt(req.query.days) || 30;
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Satisfaction scores stored on Conversation (if you add satisfaction field)
  const stats = await Conversation.aggregate([
    { $match: { companyId: cId, 'satisfaction.score': { $exists: true }, updatedAt: { $gte: from } } },
    { $group: {
      _id:       null,
      avgScore:  { $avg: '$satisfaction.score' },
      count:     { $sum: 1 },
      dist:      { $push: '$satisfaction.score' },
    }},
  ]);

  res.json({
    status: 'success',
    csat: stats[0] ?? { avgScore: null, count: 0 },
  });
});

// GET /api/analytics/leads
exports.getLeadStats = catchAsync(async (req, res) => {
  const cId  = oid(req.companyId);
  const days = parseInt(req.query.days) || 30;
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [total, recent, byDay] = await Promise.all([
    Lead.countDocuments({ companyId: cId }),
    Lead.countDocuments({ companyId: cId, createdAt: { $gte: from } }),
    Lead.aggregate([
      { $match: { companyId: cId, createdAt: { $gte: from } } },
      { $group: {
        _id:   { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        leads: { $sum: 1 },
      }},
      { $sort: { _id: 1 } },
    ]),
  ]);

  res.json({ status: 'success', total, recentPeriod: recent, byDay });
});
