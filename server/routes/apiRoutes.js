const express = require('express')
const router = express.Router()

const { createPoll, getPollResults, getPollHistory } = require('../controllers/pollController')
const { submitVote, checkVoteStatus } = require('../controllers/voteController')

// Poll routes
router.post('/poll', createPoll)
router.get('/results/:pollId', getPollResults)
router.get('/polls/history', getPollHistory)

// Vote routes
router.post('/vote', submitVote)
router.get('/vote-status/:pollId', checkVoteStatus)

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'Polling App API',
    version: '1.0.0',
    endpoints: {
      'POST /api/poll': 'Create a new poll',
      'GET /api/results/:pollId': 'Get poll results',
      'GET /api/polls/history': 'Get all polls',
      'POST /api/vote': 'Submit a vote',
      'GET /api/vote-status/:pollId': 'Check if user has voted'
    },
    documentation: 'See README for detailed API documentation'
  })
})

module.exports = router
