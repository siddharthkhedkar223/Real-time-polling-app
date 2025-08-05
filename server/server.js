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
  console.log('🩺 Health check requested')
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: process.env.NODE_ENV,
    isProduction: IS_PRODUCTION
  })
})

// Railway health check endpoint
app.get('/healthz', (req, res) => {
  console.log('🩺 Railway health check requested')
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

// Railway ping endpoint
app.get('/ping', (req, res) => {
  console.log('🏓 Ping requested')
  res.status(200).send('pong')
})

// Add root endpoint for Railway
app.get('/', (req, res) => {
  if (IS_PRODUCTION) {
    // In production, this should be handled by the React fallback
    // But if static files aren't working, show a debug message
    res.status(200).json({
      message: 'Polling App Server is running',
      status: 'OK',
      timestamp: new Date().toISOString(),
      debug: 'If you see this, static files are not being served properly'
    })
  } else {
    res.json({ 
      message: 'Polling App API Server',
      version: '1.0.0',
      status: 'ready'
    })
  }
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
  // Serve static files first
  app.get('*', (req, res, next) => {
    const fs = require('fs')
    
    // Skip API routes
    if (req.path.startsWith('/health') || req.path.startsWith('/ping') || req.path.startsWith('/socket.io')) {
      return next()
    }
    
    // If requesting a file with extension, try to serve it as static
    if (req.path.includes('.')) {
      return next()
    }
    
    // For all other routes, serve index.html (React app)
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
        console.log(`📄 Found index.html at: ${indexPath}`)
        break
      }
    }
    
    if (indexPath) {
      console.log(`📄 Serving React app for route: ${req.path}`)
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error('Error serving index.html:', err)
          res.status(500).json({ 
            error: 'Error loading application',
            path: req.path,
            indexPath: indexPath
          })
        }
      })
    } else {
      console.error('❌ index.html not found, available paths checked:', possibleIndexPaths)
      res.status(404).json({ 
        error: 'Application files not found',
        paths: possibleIndexPaths,
        currentPath: req.path
      })
    }
  })
} else {
  // Development mode - remove this since we already have root handler above
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

// Log Railway environment variables for debugging
console.log('🔧 Railway Environment Variables:')
console.log('PORT:', process.env.PORT)
console.log('NODE_ENV:', process.env.NODE_ENV)
console.log('RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT)
console.log('PWD:', process.env.PWD)

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`🌐 Environment: ${process.env.NODE_ENV}`)
  console.log(`📊 Polling App API is ready!`)
  console.log(`📁 Serving static files: ${IS_PRODUCTION ? 'YES' : 'NO'}`)
  console.log(`📍 Server accessible at: http://0.0.0.0:${PORT}`)
  
  // Test if server is actually listening
  console.log('✅ Server successfully started and listening')
}).on('error', (err) => {
  console.error('❌ Server failed to start:', err)
  process.exit(1)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received, shutting down gracefully')
  server.close(() => {
    console.log('📴 Server closed')
    process.exit(0)
  })
})
