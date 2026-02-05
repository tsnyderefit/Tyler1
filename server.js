const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store connected WebSocket clients (staff)
const staffClients = new Set();

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('Staff client connected');
  staffClients.add(ws);

  // Send current queue state on connection
  db.getQueue()
    .then(queue => {
      ws.send(JSON.stringify({
        type: 'initial-queue',
        data: queue
      }));
    })
    .catch(err => {
      console.error('Error fetching initial queue:', err);
    });

  ws.on('close', () => {
    console.log('Staff client disconnected');
    staffClients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    staffClients.delete(ws);
  });
});

// Broadcast to all connected staff clients
function broadcastToStaff(message) {
  const messageStr = JSON.stringify(message);
  staffClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

// API Routes

// POST /api/checkin - Add patron to queue
app.post('/api/checkin', async (req, res) => {
  try {
    const { patronName } = req.body;

    if (!patronName || patronName.trim() === '') {
      return res.status(400).json({ error: 'Patron name is required' });
    }

    const result = await db.addCheckIn(patronName.trim());

    // Broadcast to staff
    broadcastToStaff({
      type: 'new-checkin',
      data: {
        id: result.id,
        patronName: patronName.trim(),
        checkInTime: Date.now(),
        waitTime: 0,
        pastDue: result.pastDue
      }
    });

    res.json({
      success: true,
      id: result.id,
      position: result.position
    });
  } catch (error) {
    console.error('Error adding check-in:', error);
    res.status(500).json({ error: 'Failed to add check-in' });
  }
});

// GET /api/queue - Get current queue
app.get('/api/queue', async (req, res) => {
  try {
    const queue = await db.getQueue();
    res.json(queue);
  } catch (error) {
    console.error('Error fetching queue:', error);
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
});

// POST /api/complete/:id - Mark patron as completed
app.post('/api/complete/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const result = await db.completeCheckIn(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Check-in not found' });
    }

    // Get updated queue and broadcast
    const queue = await db.getQueue();
    broadcastToStaff({
      type: 'queue-update',
      data: queue
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error completing check-in:', error);
    res.status(500).json({ error: 'Failed to complete check-in' });
  }
});

// POST /api/clear-pastdue/:id - Clear past due status
app.post('/api/clear-pastdue/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const result = await db.clearPastDue(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Check-in not found' });
    }

    // Get updated queue and broadcast
    const queue = await db.getQueue();
    broadcastToStaff({
      type: 'queue-update',
      data: queue
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing past due:', error);
    res.status(500).json({ error: 'Failed to clear past due' });
  }
});

// GET /api/analytics - Get analytics data
app.get('/api/analytics', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;

    if (days < 1 || days > 365) {
      return res.status(400).json({ error: 'Days must be between 1 and 365' });
    }

    const analytics = await db.getAnalytics(days);
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`Check-in Queue System running on http://localhost:${PORT}`);
  console.log(`Patron Interface: http://localhost:${PORT}`);
  console.log(`Staff Interface: http://localhost:${PORT}/staff.html`);
  console.log(`Analytics: http://localhost:${PORT}/analytics.html`);
});
