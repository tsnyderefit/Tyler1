const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'queue.db');
const db = new sqlite3.Database(dbPath);

// Initialize database schema
// Helper function to generate account number (19XXXXX)
function generateAccountNumber() {
  const randomDigits = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `19${randomDigits}`;
}

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS check_ins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patron_name TEXT NOT NULL,
      check_in_time INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('waiting', 'completed')),
      completed_time INTEGER,
      wait_time_seconds INTEGER,
      past_due INTEGER DEFAULT 0,
      account_number TEXT
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_status ON check_ins(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_check_in_time ON check_ins(check_in_time)`);

  // Add past_due column to existing tables (migration)
  db.run(`ALTER TABLE check_ins ADD COLUMN past_due INTEGER DEFAULT 0`, (err) => {
    // Ignore error if column already exists
  });

  // Add account_number column to existing tables (migration)
  db.run(`ALTER TABLE check_ins ADD COLUMN account_number TEXT`, (err) => {
    // Ignore error if column already exists
    if (!err) {
      // Generate account numbers for existing records without one
      db.all('SELECT id FROM check_ins WHERE account_number IS NULL', [], (err, rows) => {
        if (!err && rows) {
          rows.forEach(row => {
            db.run('UPDATE check_ins SET account_number = ? WHERE id = ?', [generateAccountNumber(), row.id]);
          });
        }
      });
    }
  });
});

// Add a new patron to the queue
function addCheckIn(patronName) {
  return new Promise((resolve, reject) => {
    const checkInTime = Date.now();
    // Randomly assign past_due status (50% chance)
    const pastDue = Math.random() < 0.5 ? 1 : 0;
    // Generate account number
    const accountNumber = generateAccountNumber();

    db.run(
      'INSERT INTO check_ins (patron_name, check_in_time, status, past_due, account_number) VALUES (?, ?, ?, ?, ?)',
      [patronName, checkInTime, 'waiting', pastDue, accountNumber],
      function(err) {
        if (err) {
          reject(err);
        } else {
          // Get queue position
          db.get(
            'SELECT COUNT(*) as position FROM check_ins WHERE status = ? AND check_in_time <= ?',
            ['waiting', checkInTime],
            (err, row) => {
              if (err) reject(err);
              else resolve({ id: this.lastID, position: row.position, pastDue: pastDue === 1, accountNumber });
            }
          );
        }
      }
    );
  });
}

// Get all waiting patrons in queue order
function getQueue() {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT id, patron_name, check_in_time, past_due, account_number FROM check_ins WHERE status = ? ORDER BY check_in_time ASC',
      ['waiting'],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // Calculate wait time for each patron
          const now = Date.now();
          const queue = rows.map(row => ({
            id: row.id,
            patronName: row.patron_name,
            checkInTime: row.check_in_time,
            waitTime: Math.floor((now - row.check_in_time) / 1000), // in seconds
            pastDue: row.past_due === 1,
            accountNumber: row.account_number
          }));
          resolve(queue);
        }
      }
    );
  });
}

// Mark a patron as completed
function completeCheckIn(id) {
  return new Promise((resolve, reject) => {
    const completedTime = Date.now();

    // First get the check-in time to calculate wait time
    db.get('SELECT check_in_time FROM check_ins WHERE id = ?', [id], (err, row) => {
      if (err) {
        reject(err);
      } else if (!row) {
        reject(new Error('Check-in not found'));
      } else {
        const waitTimeSeconds = Math.floor((completedTime - row.check_in_time) / 1000);

        db.run(
          'UPDATE check_ins SET status = ?, completed_time = ?, wait_time_seconds = ? WHERE id = ?',
          ['completed', completedTime, waitTimeSeconds, id],
          function(err) {
            if (err) {
              reject(err);
            } else {
              resolve({ success: true, changes: this.changes });
            }
          }
        );
      }
    });
  });
}

// Get analytics data
function getAnalytics(days = 7) {
  return new Promise((resolve, reject) => {
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);

    // Get overall statistics
    db.get(
      `SELECT
        COUNT(*) as totalCheckins,
        AVG(wait_time_seconds) as avgWaitTime
      FROM check_ins
      WHERE status = 'completed' AND check_in_time >= ?`,
      [cutoffTime],
      (err, stats) => {
        if (err) {
          reject(err);
          return;
        }

        // Get daily breakdown
        db.all(
          `SELECT
            DATE(check_in_time / 1000, 'unixepoch', 'localtime') as date,
            COUNT(*) as count,
            AVG(wait_time_seconds) as avgWait
          FROM check_ins
          WHERE status = 'completed' AND check_in_time >= ?
          GROUP BY date
          ORDER BY date DESC`,
          [cutoffTime],
          (err, dailyStats) => {
            if (err) {
              reject(err);
              return;
            }

            // Get peak hours (0-23)
            db.all(
              `SELECT
                CAST(strftime('%H', check_in_time / 1000, 'unixepoch', 'localtime') AS INTEGER) as hour,
                COUNT(*) as count
              FROM check_ins
              WHERE status = 'completed' AND check_in_time >= ?
              GROUP BY hour
              ORDER BY count DESC
              LIMIT 5`,
              [cutoffTime],
              (err, peakHours) => {
                if (err) {
                  reject(err);
                } else {
                  resolve({
                    totalCheckins: stats.totalCheckins || 0,
                    avgWaitTime: Math.round(stats.avgWaitTime || 0),
                    dailyStats: dailyStats || [],
                    peakHours: peakHours || []
                  });
                }
              }
            );
          }
        );
      }
    );
  });
}

// Clear past due status
function clearPastDue(id) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE check_ins SET past_due = 0 WHERE id = ?',
      [id],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ success: true, changes: this.changes });
        }
      }
    );
  });
}

module.exports = {
  addCheckIn,
  getQueue,
  completeCheckIn,
  getAnalytics,
  clearPastDue
};
