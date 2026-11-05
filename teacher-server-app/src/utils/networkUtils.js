/**
 * ============================================================================
 * EXAMSHIELD LAN - LOCAL NETWORK & IP DISCOVERY UTILITIES
 * ============================================================================
 */

const os = require('os');

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        let priority = 1;
        const lower = name.toLowerCase();
        if (lower.includes('wi-fi') || lower.includes('wifi') || lower.includes('ethernet') || lower.includes('wlan')) {
          priority = 10;
        }
        if (
          lower.includes('*') ||
          lower.includes('vethernet') ||
          lower.includes('virtual') ||
          lower.includes('wsl') ||
          iface.address === '192.168.137.1'
        ) {
          priority = 0;
        }
        candidates.push({ address: iface.address, priority, name });
      }
    }
  }

  candidates.sort((a, b) => b.priority - a.priority);
  return candidates.length > 0 ? candidates[0].address : '127.0.0.1';
}

module.exports = { getLocalIpAddress };
