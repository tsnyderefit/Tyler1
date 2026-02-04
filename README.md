# Check-In Queue System

A real-time patron check-in queue management system with staff interface and analytics dashboard.

## Features

- **Patron Check-In Interface** - Simple web form for patrons to join the queue
- **Staff Management Dashboard** - Real-time queue view with WebSocket updates
- **Audio/Visual Notifications** - Alerts staff when new patrons check in
- **Live Wait Times** - Automatic countdown of patron wait duration
- **Analytics Dashboard** - Historical data, peak hours, and wait time statistics
- **SQLite Database** - Persistent storage with automatic schema creation
- **Responsive Design** - Mobile-friendly interface for all devices

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: SQLite3
- **Real-time**: WebSockets (ws library)
- **Frontend**: Vanilla HTML/CSS/JavaScript

## Linux Server Deployment

### 1. Prerequisites

Install Node.js and npm on your Linux server:

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# RHEL/CentOS/Fedora
curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
sudo yum install -y nodejs

# Verify installation
node --version
npm --version
```

### 2. Clone Repository

```bash
git clone https://github.com/tsnyderefit/Tyler1.git
cd Tyler1
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run the Application

**Development Mode:**
```bash
npm start
```

**Production Mode (with PM2):**
```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the application
pm2 start server.js --name checkin-queue

# Configure PM2 to start on boot
pm2 startup
pm2 save

# View logs
pm2 logs checkin-queue

# Monitor
pm2 monit
```

### 5. Configure Firewall

Open port 3000 (or your configured port):

```bash
# Ubuntu/Debian (UFW)
sudo ufw allow 3000/tcp

# RHEL/CentOS (firewalld)
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

### 6. Access the Application

- **Patron Check-In**: `http://your-server-ip:3000`
- **Staff Interface**: `http://your-server-ip:3000/staff.html`
- **Analytics**: `http://your-server-ip:3000/analytics.html`

## Configuration

### Port Configuration

Set a custom port via environment variable:

```bash
PORT=8080 npm start
```

Or create a `.env` file:

```bash
PORT=8080
```

### Reverse Proxy (Nginx)

For production deployment with domain name:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Database

- Database file: `queue.db` (created automatically on first run)
- Location: Root directory of the application
- Backup recommendation: Regularly copy `queue.db` to backup location

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/checkin` | Add patron to queue |
| GET | `/api/queue` | Get current waiting patrons |
| POST | `/api/complete/:id` | Mark patron as completed |
| GET | `/api/analytics?days=7` | Get analytics data |

## WebSocket Events

- `initial-queue` - Sent when staff connects (current queue state)
- `new-checkin` - Broadcast when patron checks in
- `queue-update` - Broadcast when queue changes (patron completed)

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 3000
sudo lsof -i :3000
# or
sudo netstat -tulpn | grep :3000

# Kill the process
kill -9 <PID>
```

### Database Locked
If you see "database is locked" errors:
```bash
# Stop the application
pm2 stop checkin-queue

# Remove lock file if it exists
rm queue.db-journal

# Restart
pm2 start checkin-queue
```

### Permission Issues
```bash
# Ensure proper ownership
sudo chown -R $USER:$USER ~/Tyler1

# Ensure database directory is writable
chmod 755 ~/Tyler1
```

## Maintenance

### View Logs
```bash
# PM2 logs
pm2 logs checkin-queue

# View last 100 lines
pm2 logs checkin-queue --lines 100
```

### Restart Application
```bash
pm2 restart checkin-queue
```

### Update Code
```bash
cd Tyler1
git pull origin main
npm install
pm2 restart checkin-queue
```

## Development

To run locally for development:

```bash
npm install
npm start
```

The server will start on `http://localhost:3000`

## Security Considerations

For production deployment:

1. Use HTTPS with SSL certificates (Let's Encrypt)
2. Set up proper firewall rules
3. Run Node.js as non-root user
4. Keep dependencies updated: `npm audit fix`
5. Consider rate limiting for API endpoints
6. Regular database backups

## License

ISC

## Author

Tyler Snyder (tsnyder@efitfinancial.com)
