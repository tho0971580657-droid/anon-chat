const fs = require('fs');
const path = require('path');

const BANNED_WORDS = [
  'đụ', 'địt', 'dmm', 'đmm', 'vcl', 'vkl', 'clgt', 'cặc', 'buồi',
  'lồn', 'đĩ', 'cave', 'nigger', 'fuck', 'shit', 'bitch', 'asshole',
];

const MAX_MSG_LENGTH = 500;
const RATE_LIMIT_COUNT = 5;
const RATE_LIMIT_WINDOW = 10000;
const MAX_REPORTS = 3;
const REPORT_LOG_FILE = path.join(__dirname, 'reports.log');

function filterBannedWords(text) {
  let filtered = text;
  for (const word of BANNED_WORDS) {
    const regex = new RegExp(word, 'gi');
    filtered = filtered.replace(regex, '***');
  }
  return filtered;
}

function validateMessage(text) {
  if (!text || typeof text !== 'string') {
    return { ok: false, error: 'Tin nhắn không hợp lệ.' };
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'Tin nhắn không được để trống.' };
  }
  if (trimmed.length > MAX_MSG_LENGTH) {
    return { ok: false, error: `Tin nhắn tối đa ${MAX_MSG_LENGTH} ký tự.` };
  }
  return { ok: true, text: filterBannedWords(trimmed) };
}

class RateLimiter {
  constructor() {
    this.records = new Map();
  }

  allow(socketId) {
    const now = Date.now();
    let timestamps = this.records.get(socketId) || [];
    timestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
    if (timestamps.length >= RATE_LIMIT_COUNT) {
      this.records.set(socketId, timestamps);
      return false;
    }
    timestamps.push(now);
    this.records.set(socketId, timestamps);
    return true;
  }

  remove(socketId) {
    this.records.delete(socketId);
  }
}

class ReportTracker {
  constructor() {
    this.counts = new Map();
  }

  addReport(socketId, reporterSocketId) {
    const count = (this.counts.get(socketId) || 0) + 1;
    this.counts.set(socketId, count);
    const line = `[${new Date().toISOString()}] ${reporterSocketId} → báo cáo → ${socketId} (lần ${count})\n`;
    fs.appendFile(REPORT_LOG_FILE, line, () => {});
    return count;
  }

  shouldDisconnect(socketId) {
    return (this.counts.get(socketId) || 0) >= MAX_REPORTS;
  }

  remove(socketId) {
    this.counts.delete(socketId);
  }
}

module.exports = {
  validateMessage,
  filterBannedWords,
  RateLimiter,
  ReportTracker,
  MAX_MSG_LENGTH,
  RATE_LIMIT_COUNT,
  RATE_LIMIT_WINDOW,
  MAX_REPORTS,
};
