const store = require('../utils/memoryStore')

// Create a new poll
const createPoll = (req, res) => {
  try {
    const { question, options, duration } = req.body

    // Validation
    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Question is required' })
    }

    if (!options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: 'At least 2 options are required' })
    }

    // Filter out empty options
    const validOptions = options.filter(opt => opt && opt.trim())
    if (validOptions.length < 2) {
      return res.status(400).json({ error: 'At least 2 non-empty options are required' })
    }

    // Create poll
    const pollData = {
      question: question.trim(),
      options: validOptions.map(opt => opt.trim()),
      duration: duration && duration > 0 ? duration : null
    }

    const poll = store.createPoll(pollData)
    
    res.status(201).json({
      success: true,
      pollId: poll.pollId,
      poll: poll,
      message: 'Poll created successfully'
    })

    console.log(`📊 New poll created: ${poll.pollId} - "${poll.question}"`)
    
  } catch (error) {
    console.error('Error creating poll:', error)
    res.status(500).json({ 
      error: 'Failed to create poll',
      message: error.message 
    })
  }
}

// Get poll results
const getPollResults = (req, res) => {
  try {
    const { pollId } = req.params
    
    if (!pollId) {
      return res.status(400).json({ error: 'Poll ID is required' })
    }

    const poll = store.getPollStats(pollId)
    
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' })
    }

    res.json({
      success: true,
      ...poll
    })
    
  } catch (error) {
    console.error('Error getting poll results:', error)
    res.status(500).json({ 
      error: 'Failed to get poll results',
      message: error.message 
    })
  }
}

// Get all polls (history)
const getPollHistory = (req, res) => {
  try {
    const polls = store.getAllPolls()
    
    // Add stats to each poll
    const pollsWithStats = polls.map(poll => store.getPollStats(poll.pollId))
    
    res.json({
      success: true,
      polls: pollsWithStats,
      count: pollsWithStats.length
    })
    
  } catch (error) {
    console.error('Error getting poll history:', error)
    res.status(500).json({ 
      error: 'Failed to get poll history',
      message: error.message 
    })
  }
}

module.exports = {
  createPoll,
  getPollResults,
  getPollHistory
}
