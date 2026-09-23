const { Server } = require('socket.io');

let ioInstance = null;

function initSocket(httpServer, corsOrigin) {
  ioInstance = new Server(httpServer, {
    cors: { origin: corsOrigin, methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
  });
  ioInstance.on('connection', socket => {
    console.log('🔌 Client connected:', socket.id);
    socket.on('disconnect', () => console.log('🔌 Client disconnected:', socket.id));
  });
  return ioInstance;
}

function getIO() {
  if (!ioInstance) throw new Error('Socket.io accessed before initSocket() was called');
  return ioInstance;
}

module.exports = { initSocket, getIO };
