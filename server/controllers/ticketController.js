const Ticket    = require('../models/Ticket');
const AppError  = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { getIO } = require('../config/socket');

// GET /api/tickets
exports.list = catchAsync(async (req, res) => {
  const { status, priority, assignedTo, page = 1, limit = 20 } = req.query;
  const filter = { companyId: req.companyId };
  if (status)     filter.status   = status;
  if (priority)   filter.priority = priority;
  if (assignedTo) filter.assignedTo = assignedTo;

  const skip = (page - 1) * limit;
  const [tickets, total] = await Promise.all([
    Ticket.find(filter)
      .populate('assignedTo', 'name avatar email')
      .sort('-createdAt').skip(skip).limit(Number(limit)),
    Ticket.countDocuments(filter),
  ]);

  res.json({ status: 'success', total, page: Number(page), tickets });
});

// POST /api/tickets
exports.create = catchAsync(async (req, res) => {
  const { title, description, priority, reportedBy, tags } = req.body;
  const ticket = await Ticket.create({
    companyId: req.companyId,
    title, description,
    priority: priority || 'medium',
    reportedBy,
    tags,
    timeline: [{ action: 'created', performedBy: req.user._id }],
  });

  try { getIO().to(`company:${req.companyId}`).emit('ticket:new', ticket); } catch {}

  res.status(201).json({ status: 'success', ticket });
});

// GET /api/tickets/:id
exports.getOne = catchAsync(async (req, res, next) => {
  const ticket = await Ticket.findOne({ _id: req.params.id, companyId: req.companyId })
    .populate('assignedTo', 'name avatar email')
    .populate('notes.author', 'name avatar')
    .populate('timeline.performedBy', 'name');
  if (!ticket) return next(new AppError('Ticket not found', 404));
  res.json({ status: 'success', ticket });
});

// PATCH /api/tickets/:id
exports.update = catchAsync(async (req, res, next) => {
  const { title, description, status, priority, assignedTo, tags, dueDate } = req.body;
  const ticket = await Ticket.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!ticket) return next(new AppError('Ticket not found', 404));

  if (title)       ticket.title       = title;
  if (description) ticket.description = description;
  if (priority)    ticket.priority    = priority;
  if (assignedTo !== undefined) ticket.assignedTo = assignedTo || null;
  if (tags)        ticket.tags        = tags;
  if (dueDate)     ticket.dueDate     = dueDate;

  if (status && status !== ticket.status) {
    ticket.status = status;
    if (status === 'resolved') ticket.resolvedAt = new Date();
    if (status === 'closed')   ticket.closedAt   = new Date();
    ticket.timeline.push({ action: `status:${status}`, performedBy: req.user._id });
  }

  await ticket.save();
  try { getIO().to(`company:${req.companyId}`).emit('ticket:updated', ticket); } catch {}

  res.json({ status: 'success', ticket });
});

// DELETE /api/tickets/:id
exports.remove = catchAsync(async (req, res, next) => {
  const ticket = await Ticket.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
  if (!ticket) return next(new AppError('Ticket not found', 404));
  res.json({ status: 'success', message: 'Ticket deleted' });
});

// POST /api/tickets/:id/notes
exports.addNote = catchAsync(async (req, res, next) => {
  const { content, isInternal = true } = req.body;
  if (!content?.trim()) return next(new AppError('Note content required', 400));

  const ticket = await Ticket.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!ticket) return next(new AppError('Ticket not found', 404));

  ticket.notes.push({ content, author: req.user._id, isInternal });
  ticket.timeline.push({ action: 'note_added', performedBy: req.user._id });
  await ticket.save();

  res.json({ status: 'success', ticket });
});
