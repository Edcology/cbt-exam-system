const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const { initDb } = require('./db');

const adminRoutes = require('./routes/admin');
const examRoutes = require('./routes/exams');
const sessionRoutes = require('./routes/sessions');
const studentRoutes = require('./routes/student');

const app = express();
const PORT = process.env.PORT || 5050;

// Enable CORS for LAN access
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Helper function to get local IP addresses
function getLocalNetworkIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push({ interface: name, ip: net.address });
      }
    }
  }
  return ips;
}

// API Route Registration
app.use('/api/admin', adminRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/student', studentRoutes);

// Endpoint to fetch network IPs for Admin Dashboard banner
app.get('/api/network-info', (req, res) => {
  const ips = getLocalNetworkIPs();
  res.json({
    port: PORT,
    interfaces: ips,
    primary_url: ips.length > 0 ? `http://${ips[0].ip}:${PORT}` : `http://localhost:${PORT}`
  });
});

// Serve Vite production build static assets if built
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Fallback to React index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      res.status(404).send('Vite build dist/index.html not found. Run "npm run build" or use Vite dev server.');
    }
  });
});

// Initialize Database and Start Local Network Server
initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    const networkIPs = getLocalNetworkIPs();
    console.log('\n==================================================');
    console.log('🚀 LOCAL NETWORK CBT EXAM SYSTEM IS RUNNING!');
    console.log('==================================================');
    console.log(`💻 Local Machine:    http://localhost:${PORT}`);
    if (networkIPs.length > 0) {
      networkIPs.forEach(net => {
        console.log(`🌐 Network (${net.interface}): http://${net.ip}:${PORT}`);
      });
      console.log('\n📢 SHARE THE NETWORK URL WITH YOUR STUDENTS ON WI-FI/LAN!');
    } else {
      console.log('⚠️  No active LAN/Wi-Fi adapter detected. Connect to Wi-Fi to serve exams over network.');
    }
    console.log('==================================================\n');
  });
}).catch(err => {
  console.error('Failed to initialize SQLite database:', err);
});
