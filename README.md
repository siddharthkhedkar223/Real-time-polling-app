# Real-Time Polling Application

A modern, real-time polling application built with React, Node.js, Socket.IO, and Tailwind CSS. Perfect for interactive classroom sessions, meetings, and surveys.

## ✨ Features

- **Real-time Polling**: Create and participate in polls with instant results
- **Dual Roles**: Student and Teacher interfaces with different capabilities  
- **Live Chat**: Real-time messaging during polling sessions
- **Participant Management**: Track active participants and their responses
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Toast Notifications**: User-friendly feedback for all actions
- **Zero-ID Polling**: No poll IDs needed - polls appear automatically for students
- **Connection Status**: Live indicator showing server connection status

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Running the Application

#### Option 1: Quick Start (Recommended)
```bash
# Install all dependencies
npm run install-all

# Start both servers with one command
npm start
```

#### Option 2: Manual Start
1. **Start Backend Server**:
   ```bash
   cd server
   npm install
   npm run dev
   ```
   Server runs on: `http://localhost:5000`

2. **Start Frontend Server** (in a new terminal):
   ```bash
   cd client
   npm install
   npm run dev
   ```
   Frontend runs on: `http://localhost:3003` (or available port)

#### Option 3: Using Shell Script (Linux/macOS/WSL)
```bash
# Make script executable (Linux/macOS only)
chmod +x start.sh

# Run the script
./start.sh
```

3. **Access the Application**:
   - Open: `http://localhost:3003` (check terminal for actual port)
   - Choose Teacher or Student role
   - That's it! No setup required.

## 📋 How It Works

### For Teachers:
1. Click "Teacher Dashboard"
2. Fill in poll question and options
3. Set duration and click "Start Live Poll"
4. Watch live results as students vote
5. End poll when ready

### For Students:
1. Click "Student Portal"
2. Wait for polls to appear automatically
3. Vote when a poll appears
4. View results after voting

## 🏗️ Project Structure

```
intervue_Assignment/
├── client/                    # React frontend
│   ├── src/
│   │   ├── main.jsx          # Main application component (single file)
│   │   └── index.css         # Global styles
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── server/                   # Node.js backend
│   ├── routes/
│   │   └── apiRoutes.js     # REST API endpoints
│   ├── sockets/
│   │   └── chatSocket.js    # Socket.IO handlers  
│   ├── utils/
│   │   └── memoryStore.js   # In-memory data storage
│   ├── server.js            # Express server with Socket.IO
│   └── package.json
└── README.md
```

## 🛠️ Technology Stack

- **Frontend**: React 18, Tailwind CSS, Socket.IO Client
- **Backend**: Node.js, Express.js, Socket.IO Server
- **Development**: Vite, Babel
- **Real-time**: WebSocket connections via Socket.IO

## 🎯 Key Design Principles

1. **Simplicity**: No complex setup or configuration
2. **Real-time**: Instant poll broadcasting and vote updates
3. **User-friendly**: Clean interface with toast notifications
4. **Responsive**: Works on all device sizes
5. **Reliable**: Graceful fallbacks for connection issues

## 📝 Features Implemented

✅ Teacher can create polls with multiple options  
✅ Students see polls automatically (no ID needed)  
✅ Real-time voting and results  
✅ Timer functionality  
✅ Beautiful, professional UI  
✅ Toast notifications (no browser alerts)  
✅ Live connection status  
✅ Responsive design  

<div style="display: flex; overflow-x: auto; gap: 10px; padding: 10px;">
  <img src="./Screenshots/Screenshot from 2025-08-06 15-56-15.png" alt="Teacher Dashboard" width="300"/>
  <img src="./Screenshots/Screenshot from 2025-08-06 15-56-24.png" alt="Student Portal" width="300"/>
  <img src="./Screenshots/Screenshot from 2025-08-06 16-02-18.png" alt="Poll Results" width="300"/>
   <img src="./Screenshots/Screenshot from 2025-08-06 16-03-37-1.png" alt="Poll Results" width="300"/>
  <img src="./Screenshots/Screenshot from 2025-08-06 16-05-46.png" alt="Poll Results" width="300"/>

</div>




