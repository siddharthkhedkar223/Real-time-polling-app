const express = require('express')
const http = require('http')
const socketIo = require('socket.io')
const cors = require('cors')
require('dotenv').config()

const apiRoutes = require('./routes/apiRoutes')
const { initializeSocketHandlers } = require('./sockets/chatSocket')

const app = express()
const server = http.createServer(app)
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://your-frontend-domain.com'] 
      : true,
    methods: ['GET', 'POST'],
    credentials: true
  }
})

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.com'] 
    : true,
  credentials: true
}))
app.use(express.json())

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

// API Routes
app.use('/api', apiRoutes)

// Initialize Socket.IO handlers
initializeSocketHandlers(io)

// Basic route for testing
app.get('/', (req, res) => {
  res.json({ 
    message: 'Polling App API Server',
    version: '1.0.0',
    endpoints: {
      'POST /api/poll': 'Create a new poll',
      'POST /api/vote': 'Submit a vote',
      'GET /api/results/:pollId': 'Get poll results',
      'GET /api/polls/history': 'Get poll history',
      'WebSocket /': 'Real-time chat and updates'
    }
  })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

const PORT = process.env.PORT || 5000

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`📊 Polling App API is ready!`)
})
