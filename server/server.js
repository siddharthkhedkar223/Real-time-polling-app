const express = require('express')
const http = require('http')
const socketIo = require('socket.io')
const cors = require('cors')
const path = require('path')
require('dotenv').config()

const app = express()
const server = http.createServer(app)

// Production detection - Railway automatically sets NODE_ENV=production
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

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

// Serve static files from React build in production
if (IS_PRODUCTION) {
  app.use(express.static(path.join(__dirname, '../client/dist')))
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
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
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'))
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

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`🌐 Environment: ${process.env.NODE_ENV}`)
  console.log(`📊 Polling App API is ready!`)
  console.log(`📁 Serving static files: ${IS_PRODUCTION ? 'YES' : 'NO'}`)
})
