// DOM elements
const queueList = document.getElementById('queue-list');
const emptyState = document.getElementById('empty-state');
const queueCount = document.getElementById('queue-count');
const connectionStatus = document.getElementById('connection-status');
const notificationDiv = document.getElementById('notification');
const notificationSound = document.getElementById('notification-sound');

// WebSocket connection
let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 2000;

// Store for wait time updates
let waitTimeIntervals = new Map();

function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('Connected to server');
    reconnectAttempts = 0;
    updateConnectionStatus('connected');
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };

  ws.onclose = () => {
    console.log('Disconnected from server');
    updateConnectionStatus('disconnected');
    attemptReconnect();
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    updateConnectionStatus('error');
  };
}

function attemptReconnect() {
  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts++;
    updateConnectionStatus('reconnecting');
    setTimeout(connectWebSocket, RECONNECT_DELAY);
  } else {
    updateConnectionStatus('failed');
  }
}

function updateConnectionStatus(status) {
  const statusText = connectionStatus.querySelector('.status-text');
  const statusDot = connectionStatus.querySelector('.status-dot');

  connectionStatus.className = `status-indicator status-${status}`;

  switch (status) {
    case 'connected':
      statusText.textContent = 'Connected';
      break;
    case 'disconnected':
      statusText.textContent = 'Disconnected';
      break;
    case 'reconnecting':
      statusText.textContent = `Reconnecting... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`;
      break;
    case 'error':
      statusText.textContent = 'Connection Error';
      break;
    case 'failed':
      statusText.textContent = 'Connection Failed';
      break;
  }
}

function handleWebSocketMessage(message) {
  switch (message.type) {
    case 'initial-queue':
      renderQueue(message.data);
      break;
    case 'new-checkin':
      handleNewCheckIn(message.data);
      break;
    case 'queue-update':
      renderQueue(message.data);
      break;
  }
}

function handleNewCheckIn(patron) {
  // Play notification sound
  notificationSound.play().catch(err => console.log('Audio play failed:', err));

  // Show notification banner
  showNotification(`New check-in: ${patron.patronName}`);

  // Fetch updated queue
  fetchQueue();
}

function showNotification(text) {
  const notificationText = notificationDiv.querySelector('.notification-text');
  notificationText.textContent = text;

  notificationDiv.classList.remove('hidden');
  notificationDiv.classList.add('show');

  setTimeout(() => {
    notificationDiv.classList.remove('show');
    setTimeout(() => {
      notificationDiv.classList.add('hidden');
    }, 300);
  }, 3000);
}

async function fetchQueue() {
  try {
    const response = await fetch('/api/queue');
    const queue = await response.json();
    renderQueue(queue);
  } catch (error) {
    console.error('Error fetching queue:', error);
  }
}

function renderQueue(queue) {
  // Clear existing intervals
  waitTimeIntervals.forEach(interval => clearInterval(interval));
  waitTimeIntervals.clear();

  if (queue.length === 0) {
    queueList.classList.add('hidden');
    emptyState.classList.remove('hidden');
    queueCount.textContent = '0 in queue';
    return;
  }

  emptyState.classList.add('hidden');
  queueList.classList.remove('hidden');
  queueCount.textContent = `${queue.length} in queue`;

  queueList.innerHTML = queue.map((patron, index) => {
    const waitMinutes = Math.floor(patron.waitTime / 60);
    const waitSeconds = patron.waitTime % 60;
    const pastDueButton = patron.pastDue
      ? `<button class="btn btn-past-due" onclick="clearPastDue(${patron.id}); event.stopPropagation();">Past Due</button>`
      : '';

    return `
      <div class="queue-item" data-id="${patron.id}">
        <div class="queue-item-header">
          <span class="queue-position">#${index + 1}</span>
          <span class="patron-name">${escapeHtml(patron.patronName)}</span>
          ${pastDueButton}
        </div>
        <div class="queue-item-info">
          <span class="check-in-time">${formatTime(patron.checkInTime)}</span>
          <span class="wait-time" id="wait-time-${patron.id}">
            ${waitMinutes}m ${waitSeconds}s
          </span>
        </div>
        <button class="btn btn-complete" onclick="completeCheckIn(${patron.id})">
          ✓ Complete
        </button>
      </div>
    `;
  }).join('');

  // Start wait time counters
  queue.forEach(patron => {
    const interval = setInterval(() => {
      updateWaitTime(patron.id, patron.checkInTime);
    }, 1000);
    waitTimeIntervals.set(patron.id, interval);
  });
}

function updateWaitTime(patronId, checkInTime) {
  const waitTimeElement = document.getElementById(`wait-time-${patronId}`);
  if (!waitTimeElement) {
    const interval = waitTimeIntervals.get(patronId);
    if (interval) clearInterval(interval);
    return;
  }

  const waitSeconds = Math.floor((Date.now() - checkInTime) / 1000);
  const minutes = Math.floor(waitSeconds / 60);
  const seconds = waitSeconds % 60;

  waitTimeElement.textContent = `${minutes}m ${seconds}s`;
}

async function completeCheckIn(id) {
  try {
    const response = await fetch(`/api/complete/${id}`, {
      method: 'POST'
    });

    if (!response.ok) {
      const error = await response.json();
      alert(`Error: ${error.error || 'Failed to complete check-in'}`);
    }
    // Queue update will come via WebSocket
  } catch (error) {
    console.error('Error completing check-in:', error);
    alert('Network error. Please try again.');
  }
}

async function clearPastDue(id) {
  try {
    const response = await fetch(`/api/clear-pastdue/${id}`, {
      method: 'POST'
    });

    if (!response.ok) {
      const error = await response.json();
      alert(`Error: ${error.error || 'Failed to clear past due'}`);
    }
    // Queue update will come via WebSocket
  } catch (error) {
    console.error('Error clearing past due:', error);
    alert('Network error. Please try again.');
  }
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize
connectWebSocket();
fetchQueue();
