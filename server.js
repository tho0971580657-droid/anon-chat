const express = require('express');
const http = require('http');
const helmet = require('helmet');
const { Server } = require('socket.io');
const { Matchmaker } = require('./matchmaking');
const {
  validateMessage, RateLimiter, ReportTracker,
  RATE_LIMIT_COUNT, RATE_LIMIT_WINDOW,
} = require('./moderation');

const app = express();
const server = http.createServer(app);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", 'ws:', 'wss:'],
    },
  },
}));

app.use(express.static('public'));

const io = new Server(server);
const mm = new Matchmaker();
const rateLimiter = new RateLimiter();
const reportTracker = new ReportTracker();

function broadcastOnlineCount() {
  io.emit('online-count', io.engine.clientsCount);
}

function tryMatch(socket) {
  const partner = mm.addToQueue(socket);
  if (partner) {
    socket.emit('matched', { message: 'Đã tìm được người lạ. Hãy bắt đầu trò chuyện!' });
    partner.emit('matched', { message: 'Đã tìm được người lạ. Hãy bắt đầu trò chuyện!' });
    console.log(`[♥] Ghép cặp: ${socket.id} ↔ ${partner.id}`, mm.stats());
  }
}

io.on('connection', (socket) => {
  console.log(`[+] Kết nối: ${socket.id}`, mm.stats());
  broadcastOnlineCount();
  tryMatch(socket);

  socket.on('chat-message', (msg) => {
    if (!rateLimiter.allow(socket.id)) {
      socket.emit('error-msg', {
        message: `Bạn gửi quá nhanh! Tối đa ${RATE_LIMIT_COUNT} tin / ${RATE_LIMIT_WINDOW / 1000}s.`,
      });
      return;
    }

    const result = validateMessage(msg);
    if (!result.ok) {
      socket.emit('error-msg', { message: result.error });
      return;
    }

    const partnerId = mm.getPartner(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('chat-message', result.text);
    }
  });

  socket.on('next', () => {
    const partnerId = mm.unpair(socket.id);
    if (partnerId) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      io.to(partnerId).emit('partner-left', { message: 'Người lạ đã chuyển sang cuộc trò chuyện khác.' });
      if (partnerSocket) tryMatch(partnerSocket);
    }
    socket.emit('waiting', { message: 'Đang tìm người lạ mới...' });
    tryMatch(socket);
    console.log(`[→] Next: ${socket.id}`, mm.stats());
  });

  socket.on('report', () => {
    const partnerId = mm.getPartner(socket.id);
    if (!partnerId) return;

    const count = reportTracker.addReport(partnerId, socket.id);
    socket.emit('report-ack', { message: 'Đã gửi báo cáo. Cảm ơn bạn!' });
    console.log(`[!] Báo cáo: ${socket.id} → ${partnerId} (lần ${count})`);

    if (reportTracker.shouldDisconnect(partnerId)) {
      const badSocket = io.sockets.sockets.get(partnerId);
      if (badSocket) {
        badSocket.emit('error-msg', { message: 'Bạn đã bị ngắt kết nối do bị báo cáo nhiều lần.' });
        badSocket.disconnect(true);
      }
    }
  });

  socket.on('disconnect', () => {
    const partnerId = mm.removeSocket(socket.id);
    rateLimiter.remove(socket.id);
    reportTracker.remove(socket.id);

    if (partnerId) {
      io.to(partnerId).emit('partner-left', { message: 'Người lạ đã rời đi.' });
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) tryMatch(partnerSocket);
    }
    console.log(`[-] Ngắt: ${socket.id}`, mm.stats());
    broadcastOnlineCount();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server chạy tại http://localhost:${PORT}`);
});
