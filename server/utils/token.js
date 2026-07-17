const jwt = require('jsonwebtoken');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    algorithm: 'HS256', // explicitly pin — prevents downgrade to alg:none
  });

// formatUser — NEVER include apiKey here.
// The API key is a secret credential that should only be fetched explicitly
// from GET /api/settings/api-key by owners/admins, never baked into every auth response.
const formatUser = (user, company) => ({
  id:      user._id,
  name:    user.name,
  email:   user.email,
  role:    user.role,
  company: {
    id:   company._id,
    name: company.name,
    plan: company.plan,
    // apiKey intentionally omitted — fetch it from /api/settings/api-key
  },
});

module.exports = { signToken, formatUser };
