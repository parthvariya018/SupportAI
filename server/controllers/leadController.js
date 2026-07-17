const Lead         = require('../models/Lead');
const Conversation = require('../models/Conversation');
const catchAsync   = require('../utils/catchAsync');

exports.create = catchAsync(async (req, res) => {
  const { name, email, phone, message, sessionId } = req.body;

  let conversationId;
  if (sessionId) {
    const conv = await Conversation.findOneAndUpdate(
      { companyId: req.companyId, sessionId },
      { leadCaptured: true },
      { new: true }
    );
    conversationId = conv?._id;
  }

  const lead = await Lead.create({
    companyId: req.companyId,
    conversationId,
    name,
    email,
    phone,
    message,
  });

  res.status(201).json({ status: 'success', lead });
});

exports.list = catchAsync(async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(200, parseInt(req.query.limit) || 50);
  const skip  = (page - 1) * limit;

  const [leads, total] = await Promise.all([
    Lead.find({ companyId: req.companyId }).sort('-createdAt').skip(skip).limit(limit),
    Lead.countDocuments({ companyId: req.companyId }),
  ]);

  res.json({
    status: 'success',
    total,
    page,
    pages: Math.ceil(total / limit),
    leads,
  });
});
