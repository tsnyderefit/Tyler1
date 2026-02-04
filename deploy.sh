#!/bin/bash

# Check-In Queue System - Linux Deployment Script

set -e  # Exit on error

echo "======================================"
echo "Check-In Queue System - Deployment"
echo "======================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js first:"
    echo "  Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs"
    echo "  RHEL/CentOS:   curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash - && sudo yum install -y nodejs"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo ""
echo "✅ Dependencies installed successfully!"
echo ""

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "⚠️  PM2 is not installed (recommended for production)"
    echo "Install with: sudo npm install -g pm2"
    echo ""
    read -p "Would you like to start in development mode? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🚀 Starting server in development mode..."
        npm start
    else
        echo "Deployment complete. Run 'npm start' to start the server."
    fi
else
    echo "✅ PM2 is installed"
    echo ""
    read -p "Start application with PM2? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Stop existing instance if running
        pm2 delete checkin-queue 2>/dev/null || true

        echo "🚀 Starting application with PM2..."
        pm2 start server.js --name checkin-queue

        echo ""
        echo "✅ Application started successfully!"
        echo ""
        echo "Useful PM2 commands:"
        echo "  pm2 logs checkin-queue    - View logs"
        echo "  pm2 monit                 - Monitor resources"
        echo "  pm2 restart checkin-queue - Restart application"
        echo "  pm2 stop checkin-queue    - Stop application"
        echo ""

        read -p "Configure PM2 to start on system boot? (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            pm2 startup
            pm2 save
            echo "✅ PM2 configured to start on boot"
        fi
    fi
fi

echo ""
echo "======================================"
echo "Deployment Complete!"
echo "======================================"
echo ""
echo "Access the application:"
echo "  Patron Check-In: http://$(hostname -I | awk '{print $1}'):3000"
echo "  Staff Interface: http://$(hostname -I | awk '{print $1}'):3000/staff.html"
echo "  Analytics:       http://$(hostname -I | awk '{print $1}'):3000/analytics.html"
echo ""
echo "Note: Make sure port 3000 is open in your firewall"
echo "  Ubuntu/Debian: sudo ufw allow 3000/tcp"
echo "  RHEL/CentOS:   sudo firewall-cmd --permanent --add-port=3000/tcp && sudo firewall-cmd --reload"
echo ""
