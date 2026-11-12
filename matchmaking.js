class Matchmaker {
  constructor() {
    this.queue = [];
    this.pairs = new Map();
  }

  addToQueue(socket, topic = null) {
    if (this.queue.some((e) => e.socket.id === socket.id)) return null;
    if (this.pairs.has(socket.id)) return null;

    let idx = -1;
    if (topic) {
      idx = this.queue.findIndex((e) => e.topic === topic);
    }
    if (idx === -1 && this.queue.length > 0) {
      idx = 0;
    }

    if (idx !== -1) {
      const entry = this.queue.splice(idx, 1)[0];
      this.pairs.set(socket.id, entry.socket.id);
      this.pairs.set(entry.socket.id, socket.id);
      return entry.socket;
    }

    this.queue.push({ socket, topic });
    return null;
  }

  getPartner(socketId) {
    return this.pairs.get(socketId) || null;
  }

  unpair(socketId) {
    const partnerId = this.pairs.get(socketId);
    if (!partnerId) return null;
    this.pairs.delete(socketId);
    this.pairs.delete(partnerId);
    return partnerId;
  }

  removeSocket(socketId) {
    this.queue = this.queue.filter((e) => e.socket.id !== socketId);
    return this.unpair(socketId);
  }

  stats() {
    return { queue: this.queue.length, pairs: this.pairs.size / 2 };
  }
}

module.exports = { Matchmaker };
