const express = require('express')
const http = require('http')
const socketIo = require('socket.io')
const cors = require('cors')
const path = require('path')
require('dotenv').config()

const app = express()
const server = http.createServer(app)

// Production detection - Railway automatically sets NODE_ENV=production
// For Railway deployment, also check for PORT which Railway always sets
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.PORT !== undefined

const io = socketIo(server, {
  cors: {
    origin: IS_PRODUCTION 
      ? ['https://real-time-polling-app-production-ff8b.up.railway.app'] 
      : true,
    methods: ['GET', 'POST'],
    credentials: true
  }
})

// Middleware
app.use(cors({
  origin: IS_PRODUCTION 
    ? ['https://real-time-polling-app-production-ff8b.up.railway.app'] 
    : true,
  credentials: true
}))
app.use(express.json())

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📝 ${req.method} ${req.path}`)
  next()
})

// Serve static files from React build in production
if (IS_PRODUCTION) {
  const fs = require('fs')
  
  // Try multiple possible paths for Railway
  const possiblePaths = [
    path.join(__dirname, '../client/dist'),
    path.join(__dirname, '../dist'),
    path.join(process.cwd(), 'client/dist'),
    path.join(process.cwd(), 'dist')
  ]
  
  let staticPath = null
  for (const testPath of possiblePaths) {
    console.log(`� Testing path: ${testPath}`)
    if (fs.existsSync(testPath)) {
      staticPath = testPath
      console.log(`✅ Found static files at: ${staticPath}`)
      break
    }
  }
  
  if (staticPath) {
    console.log(`📋 Files in static directory:`, fs.readdirSync(staticPath))
    app.use(express.static(staticPath))
  } else {
    console.error(`❌ No static files found in any of these paths:`, possiblePaths)
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

// Railway health check endpoint
app.get('/healthz', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

// Railway ping endpoint
app.get('/ping', (req, res) => {
  res.send('pong')
})

// Initialize Socket.IO handlers for polling
const activePolls = new Map()

io.on('connection', (socket) => {
  console.log(`🔗 User connected: ${socket.id}`)

  // Handle new poll creation
  socket.on('createPoll', (pollData) => {
    console.log('📊 New poll created:', pollData.question)
    activePolls.set(pollData.id, pollData)
    // Broadcast to all connected clients
    socket.broadcast.emit('newPoll', pollData)
  })

  // Handle voting
  socket.on('vote', (voteData) => {
    console.log('🗳️ Vote received:', voteData)
    const poll = activePolls.get(voteData.pollId)
    if (poll) {
      poll.votes = voteData.votes
      activePolls.set(voteData.pollId, poll)
      // Broadcast vote update to all clients
      io.emit('voteUpdate', voteData)
    }
  })

  // Handle poll ending
  socket.on('endPoll', (pollId) => {
    console.log('🛑 Poll ended:', pollId)
    const poll = activePolls.get(pollId)
    if (poll) {
      poll.ended = true
      activePolls.set(pollId, poll)
      io.emit('pollEnded', pollId)
    }
  })

  socket.on('disconnect', () => {
    console.log(`👋 User disconnected: ${socket.id}`)
  })
})

// Serve React app for all non-API routes in production
if (IS_PRODUCTION) {
  // Make sure static files are served first, then fallback to index.html
  app.get('*', (req, res, next) => {
    const fs = require('fs')
    
    // If requesting a file extension, let express.static handle it
    if (req.path.includes('.')) {
      return next()
    }
    
    // Try to find index.html in the same paths we checked earlier
    const possibleIndexPaths = [
      path.join(__dirname, '../client/dist/index.html'),
      path.join(__dirname, '../dist/index.html'),
      path.join(process.cwd(), 'client/dist/index.html'),
      path.join(process.cwd(), 'dist/index.html')
    ]
    
    let indexPath = null
    for (const testPath of possibleIndexPaths) {
      if (fs.existsSync(testPath)) {
        indexPath = testPath
        break
      }
    }
    
    if (indexPath) {
      console.log(`📄 Serving index.html from: ${indexPath}`)
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error('Error serving index.html:', err)
          res.status(500).send('Error loading application')
        }
      })
    } else {
      console.error('❌ index.html not found in any location')
      res.status(404).send('Application not found')
    }
  })
} else {
  // Basic route for testing in development
  app.get('/', (req, res) => {
    res.json({ 
      message: 'Polling App API Server',
      version: '1.0.0',
      status: 'ready'
    })
  })
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  })
})

const PORT = process.env.PORT || 5000

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`🌐 Environment: ${process.env.NODE_ENV}`)
  console.log(`📊 Polling App API is ready!`)
  console.log(`📁 Serving static files: ${IS_PRODUCTION ? 'YES' : 'NO'}`)
  console.log(`📍 Server accessible at: http://0.0.0.0:${PORT}`)
})
