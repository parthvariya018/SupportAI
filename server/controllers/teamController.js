const User       = require('../models/User');
const Team       = require('../models/Team');
const Company    = require('../models/Company');
const AppError   = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const crypto     = require('crypto');
const { getPlanLimits } = require('../middleware/planGuard');
const { sendInvite }    = require('../services/emailService');

// ── Members ───────────────────────────────────────────────────────────────────

// GET /api/team
exports.listMembers = catchAsync(async (req, res) => {
  const members = await User.find({ companyId: req.companyId }).select('-password');
  res.json({ status: 'success', count: members.length, members });
});

// POST /api/team/invite
exports.invite = catchAsync(async (req, res, next) => {
  const { email, role = 'agent' } = req.body;
  if (!email) return next(new AppError('Email required', 400));

  if (!['admin', 'agent', 'viewer'].includes(role))
    return next(new AppError('Invalid role', 400));

  // ── Enforce agent limit ───────────────────────────────────────────────────
  const company = await Company.findById(req.companyId).select('plan').lean();
  if (!company) return next(new AppError('Company not found', 404));

  const { agents: agentLimit } = getPlanLimits(company.plan);
  if (agentLimit !== Infinity) {
    // Count all users (active + pending invites) to prevent slot gaming
    const currentCount = await User.countDocuments({ companyId: req.companyId });
    if (currentCount >= agentLimit) {
      return res.status(403).json({
        success: false,
        code:    'PLAN_LIMIT_REACHED',
        message: 'Agent limit reached. Upgrade your plan.',
      });
    }
  }
  // ────────────────────────────────────────────────────────────────

  const existing = await User.findOne({ email, companyId: req.companyId });
  if (existing) return next(new AppError('User already in team', 409));

  const inviteToken   = crypto.randomBytes(32).toString('hex');
  const inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

  await User.create({
    companyId: req.companyId,
    email,
    name:     email.split('@')[0],
    password: crypto.randomBytes(16).toString('hex'),
    role,
    isActive: false,
    inviteToken,
    inviteExpires,
  });

  const inviteUrl     = `${process.env.CLIENT_URL}/invite/${inviteToken}`;
  const inviterName   = req.user.name || req.user.email;
  const companyRecord = await Company.findById(req.companyId).select('name').lean();
  sendInvite(email, inviterName, companyRecord?.name || 'your team', inviteUrl);

  res.status(201).json({ status: 'success', message: 'Invite sent', inviteToken });
});

// POST /api/team/invite/accept/:token
exports.acceptInvite = catchAsync(async (req, res, next) => {
  const { name, password } = req.body;
  if (!name || !password) return next(new AppError('Name and password required', 400));

  // ── Step 1: produce clear errors before touching the DB ──────────────────
  // Read-only lookup to give specific error messages for each failure case.
  // We only look at fields that cannot change between this read and the atomic
  // write below (inviteToken is immutable once set; only we clear it).
  const pending = await User.findOne({ inviteToken: req.params.token })
    .select('+inviteToken +inviteExpires');

  if (!pending)           return next(new AppError('Invite link is invalid or has already been used.', 400));
  if (pending.isActive)   return next(new AppError('This invite has already been accepted.', 400));
  if (!pending.inviteExpires || pending.inviteExpires < Date.now())
    return next(new AppError('Invite link has expired. Ask your admin to send a new invite.', 400));

  // ── Step 2: re-check plan limit at acceptance time ────────────────────────
  // The company may have downgraded after the invite was sent.
  const company = await Company.findById(pending.companyId).select('plan').lean();
  if (!company) return next(new AppError('Company not found.', 404));

  const { agents: agentLimit } = getPlanLimits(company.plan);
  if (agentLimit !== Infinity) {
    const currentCount = await User.countDocuments({ companyId: pending.companyId });
    if (currentCount >= agentLimit) {
      return res.status(403).json({
        success: false,
        code:    'PLAN_LIMIT_REACHED',
        message: 'Agent limit reached. Upgrade your plan.',
      });
    }
  }

  // ── Step 3: atomically consume the token ─────────────────────────────────
  // findOneAndUpdate with the full conditions as the filter — if a concurrent
  // request already cleared inviteToken, this returns null and we reject.
  // { new: true } returns the updated doc so we can call save() on it next.
  const user = await User.findOneAndUpdate(
    {
      inviteToken:   req.params.token,
      isActive:      false,
      inviteExpires: { $gt: new Date() },
    },
    { $unset: { inviteToken: '', inviteExpires: '' } },
    { new: true, select: '+password' }
  );

  // Another concurrent request won the race — token is already gone.
  if (!user) return next(new AppError('Invite link is invalid or has already been used.', 400));

  // ── Step 4: set credentials via save() so the bcrypt pre-save hook runs ──
  user.name     = name;
  user.password = password;
  user.isActive = true;
  await user.save();

  res.json({ status: 'success', message: 'Account activated successfully.' });
});

// PATCH /api/team/:id/role
exports.updateRole = catchAsync(async (req, res, next) => {
  const { role } = req.body;
  if (!role) return next(new AppError('Role required', 400));

  // Prevent demoting the owner
  const target = await User.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!target) return next(new AppError('Team member not found', 404));
  if (target.role === 'owner') return next(new AppError('Cannot change owner role', 403));

  target.role = role;
  await target.save();
  res.json({ status: 'success', user: target });
});

// DELETE /api/team/:id
exports.removeMember = catchAsync(async (req, res, next) => {
  if (String(req.params.id) === String(req.user._id))
    return next(new AppError('Cannot remove yourself', 400));

  const user = await User.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!user) return next(new AppError('Team member not found', 404));
  if (user.role === 'owner') return next(new AppError('Cannot remove the owner', 403));

  await user.deleteOne();
  res.json({ status: 'success', message: 'Member removed' });
});

// ── Teams (Groups) ────────────────────────────────────────────────────────────

// GET /api/team/groups
exports.listGroups = catchAsync(async (req, res) => {
  const teams = await Team.find({ companyId: req.companyId })
    .populate('members', 'name avatar email role');
  res.json({ status: 'success', count: teams.length, teams });
});

// POST /api/team/groups
exports.createGroup = catchAsync(async (req, res, next) => {
  const { name, description, members = [], autoAssign } = req.body;
  if (!name) return next(new AppError('Team name required', 400));

  const team = await Team.create({
    companyId:   req.companyId,
    name, description,
    members,
    autoAssign,
    createdBy: req.user._id,
  });

  res.status(201).json({ status: 'success', team });
});

// PATCH /api/team/groups/:id
exports.updateGroup = catchAsync(async (req, res, next) => {
  const { name, description, members, autoAssign } = req.body;
  const team = await Team.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!team) return next(new AppError('Team not found', 404));

  if (name        !== undefined) team.name        = name;
  if (description !== undefined) team.description = description;
  if (members     !== undefined) team.members     = members;
  if (autoAssign  !== undefined) team.autoAssign  = autoAssign;

  await team.save();
  res.json({ status: 'success', team });
});

// DELETE /api/team/groups/:id
exports.deleteGroup = catchAsync(async (req, res, next) => {
  const team = await Team.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
  if (!team) return next(new AppError('Team not found', 404));
  res.json({ status: 'success', message: 'Team deleted' });
});
