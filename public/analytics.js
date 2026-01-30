// DOM elements
const daysSelect = document.getElementById('days-select');
const refreshBtn = document.getElementById('refresh-btn');
const loading = document.getElementById('loading');
const analyticsContent = document.getElementById('analytics-content');
const totalCheckinsEl = document.getElementById('total-checkins');
const avgWaitTimeEl = document.getElementById('avg-wait-time');
const peakHoursEl = document.getElementById('peak-hours');
const dailyStatsEl = document.getElementById('daily-stats');

// Event listeners
daysSelect.addEventListener('change', loadAnalytics);
refreshBtn.addEventListener('click', loadAnalytics);

async function loadAnalytics() {
  const days = parseInt(daysSelect.value);

  // Show loading state
  loading.classList.remove('hidden');
  analyticsContent.classList.add('hidden');

  try {
    const response = await fetch(`/api/analytics?days=${days}`);

    if (!response.ok) {
      throw new Error('Failed to fetch analytics');
    }

    const data = await response.json();
    renderAnalytics(data);
  } catch (error) {
    console.error('Error loading analytics:', error);
    alert('Failed to load analytics. Please try again.');
  } finally {
    loading.classList.add('hidden');
    analyticsContent.classList.remove('hidden');
  }
}

function renderAnalytics(data) {
  // Render key metrics
  totalCheckinsEl.textContent = data.totalCheckins.toLocaleString();
  avgWaitTimeEl.textContent = formatSeconds(data.avgWaitTime);

  // Render peak hours
  renderPeakHours(data.peakHours);

  // Render daily stats
  renderDailyStats(data.dailyStats);
}

function renderPeakHours(peakHours) {
  if (peakHours.length === 0) {
    peakHoursEl.innerHTML = '<p class="empty-message">No data available</p>';
    return;
  }

  peakHoursEl.innerHTML = peakHours.map((item, index) => {
    const timeRange = formatHourRange(item.hour);
    const barWidth = (item.count / peakHours[0].count) * 100;

    return `
      <div class="peak-hour-item">
        <div class="peak-hour-info">
          <span class="peak-hour-rank">#${index + 1}</span>
          <span class="peak-hour-time">${timeRange}</span>
          <span class="peak-hour-count">${item.count} check-ins</span>
        </div>
        <div class="peak-hour-bar-container">
          <div class="peak-hour-bar" style="width: ${barWidth}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderDailyStats(dailyStats) {
  if (dailyStats.length === 0) {
    dailyStatsEl.innerHTML = '<p class="empty-message">No data available</p>';
    return;
  }

  dailyStatsEl.innerHTML = `
    <table class="stats-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Check-Ins</th>
          <th>Avg Wait Time</th>
        </tr>
      </thead>
      <tbody>
        ${dailyStats.map(stat => `
          <tr>
            <td>${formatDate(stat.date)}</td>
            <td>${stat.count}</td>
            <td>${formatSeconds(Math.round(stat.avgWait))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function formatSeconds(seconds) {
  if (seconds === 0) return '0s';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

function formatHourRange(hour) {
  const nextHour = (hour + 1) % 24;
  return `${formatHour(hour)} - ${formatHour(nextHour)}`;
}

function formatHour(hour) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}${period}`;
}

function formatDate(dateString) {
  const date = new Date(dateString + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.getTime() === today.getTime()) {
    return 'Today';
  } else if (date.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  } else {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString(undefined, options);
  }
}

// Initialize
loadAnalytics();
