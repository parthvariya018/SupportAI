const { Server } = require('socket.io');
const jwt        = require('jsonwebtoken');
const User       = require('../models/User');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin:      process.env.CLIENT_URL || '*',
      methods:     ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout:  60000,
    pingInterval: 25000,
  });

  // ── JWT auth handshake ────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        // Allow unauthenticated connections (widget users)
        socket.isWidget = true;
        return next();
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user    = await User.findById(decoded.id).select('name role companyId isActive').lean();
      if (!user || !user.isActive) return next(new Error('Unauthorized'));

      socket.user      = user;
      socket.companyId = String(user.companyId);
      socket.isWidget  = false;
      next();
    } catch {
      // Invalid token — allow as widget user
      socket.isWidget = true;
      next();
    }
  });

  // ── Connection handler ────────────────────────────────────────────────────
  io.on('connection', (socket) => {

    // Authenticated agents: auto-join company room
    if (!socket.isWidget && socket.companyId) {
      socket.join(`company:${socket.companyId}`);
      socket.to(`company:${socket.companyId}`).emit('agent:online', {
        userId: socket.user._id,
        name:   socket.user.name,
      });
    }

    // Widget users join by API-key-resolved companyId
    socket.on('join:company', (companyId) => {
      socket.join(`company:${companyId}`);
    });

    // Join a specific conversation room (agents + widget user both call this)
    socket.on('join:conversation', (conversationId) => {
      socket.join(`conv:${conversationId}`);
    });

    socket.on('leave:conversation', (conversationId) => {
      socket.leave(`conv:${conversationId}`);
    });

    // Typing indicators
    socket.on('typing:start', ({ conversationId }) => {
      socket.to(`conv:${conversationId}`).emit('typing:start', {
        userId: socket.user?._id,
        name:   socket.user?.name || 'Visitor',
      });
    });

    socket.on('typing:stop', ({ conversationId }) => {
      socket.to(`conv:${conversationId}`).emit('typing:stop', {
        userId: socket.user?._id,
      });
    });

    // Agent sends a real-time reply into a conversation room
    socket.on('chat:reply', ({ conversationId, message }) => {
      io.to(`conv:${conversationId}`).emit('chat:message', {
        role:      'agent',
        content:   message,
        agentName: socket.user?.name,
        timestamp: new Date(),
      });
    });

    // Ticket room for real-time collaboration
    socket.on('join:ticket', (ticketId) => {
      socket.join(`ticket:${ticketId}`);
    });

    socket.on('disconnect', () => {
      if (!socket.isWidget && socket.companyId) {
        socket.to(`company:${socket.companyId}`).emit('agent:offline', {
          userId: socket.user?._id,
        });
      }
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};

module.exports = { initSocket, getIO };
