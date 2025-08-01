const store = require('../utils/memoryStore')

// Submit a vote
const submitVote = (req, res) => {
  try {
    const { pollId, option } = req.body
    
    // Validation
    if (!pollId || !pollId.trim()) {
      return res.status(400).json({ error: 'Poll ID is required' })
    }

    if (!option || !option.trim()) {
      return res.status(400).json({ error: 'Option is required' })
    }

    // Generate or get client ID for vote tracking
    let clientId = req.headers['x-client-id']
    if (!clientId) {
      // Generate a unique client ID based on IP and user agent for basic tracking
      clientId = req.ip + '_' + (req.headers['user-agent'] || '').substring(0, 50)
    }

    // Check if user already voted
    if (store.hasVoted(pollId, clientId)) {
      return res.status(409).json({ 
        error: 'You have already voted in this poll',
        code: 'ALREADY_VOTED'
      })
    }

    // Submit vote
    const updatedPoll = store.addVote(pollId, option.trim(), clientId)
    
    res.json({
      success: true,
      message: 'Vote submitted successfully',
      poll: store.getPollStats(pollId)
    })

    console.log(`🗳️ Vote submitted for poll ${pollId}: "${option}" by ${clientId}`)
    
  } catch (error) {
    console.error('Error submitting vote:', error)
    
    // Handle specific error types
    if (error.message === 'Poll not found') {
      return res.status(404).json({ error: 'Poll not found' })
    }
    
    if (error.message === 'Poll has expired') {
      return res.status(410).json({ 
        error: 'This poll has expired and is no longer accepting votes',
        code: 'POLL_EXPIRED'
      })
    }
    
    if (error.message === 'Invalid option') {
      return res.status(400).json({ error: 'Invalid option selected' })
    }
    
    if (error.message === 'User has already voted') {
      return res.status(409).json({ 
        error: 'You have already voted in this poll',
        code: 'ALREADY_VOTED'
      })
    }

    res.status(500).json({ 
      error: 'Failed to submit vote',
      message: error.message 
    })
  }
}

// Check if user has voted (utility endpoint)
const checkVoteStatus = (req, res) => {
  try {
    const { pollId } = req.params
    let clientId = req.headers['x-client-id']
    
    if (!clientId) {
      clientId = req.ip + '_' + (req.headers['user-agent'] || '').substring(0, 50)
    }

    const hasVoted = store.hasVoted(pollId, clientId)
    const poll = store.getPoll(pollId)
    
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' })
    }

    res.json({
      success: true,
      hasVoted,
      pollId,
      isExpired: poll.endTime ? poll.endTime <= Date.now() : false
    })
    
  } catch (error) {
    console.error('Error checking vote status:', error)
    res.status(500).json({ 
      error: 'Failed to check vote status',
      message: error.message 
    })
  }
}

module.exports = {
  submitVote,
  checkVoteStatus
}
