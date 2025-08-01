// In-memory store for polls and votes
class MemoryStore {
  constructor() {
    this.polls = new Map()
    this.votes = new Map() // pollId -> Set of clientIds who voted
  }

  // Poll operations
  createPoll(pollData) {
    const pollId = 'poll_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now()
    
    const poll = {
      pollId,
      question: pollData.question,
      options: pollData.options.map(option => ({
        text: option,
        votes: 0
      })),
      createdAt: Date.now(),
      endTime: pollData.duration ? Date.now() + pollData.duration : null,
      isActive: true
    }
    
    this.polls.set(pollId, poll)
    this.votes.set(pollId, new Set())
    
    return poll
  }

  getPoll(pollId) {
    return this.polls.get(pollId)
  }

  getAllPolls() {
    return Array.from(this.polls.values()).sort((a, b) => b.createdAt - a.createdAt)
  }

  // Vote operations
  addVote(pollId, option, clientId) {
    const poll = this.polls.get(pollId)
    if (!poll) {
      throw new Error('Poll not found')
    }

    // Check if poll is expired
    if (poll.endTime && poll.endTime <= Date.now()) {
      throw new Error('Poll has expired')
    }

    // Check if user already voted
    const pollVotes = this.votes.get(pollId)
    if (pollVotes.has(clientId)) {
      throw new Error('User has already voted')
    }

    // Find the option and increment vote count
    const optionIndex = poll.options.findIndex(opt => opt.text === option)
    if (optionIndex === -1) {
      throw new Error('Invalid option')
    }

    poll.options[optionIndex].votes += 1
    pollVotes.add(clientId)
    
    return poll
  }

  hasVoted(pollId, clientId) {
    const pollVotes = this.votes.get(pollId)
    return pollVotes ? pollVotes.has(clientId) : false
  }

  // Cleanup expired polls (optional)
  cleanupExpiredPolls() {
    const now = Date.now()
    for (const [pollId, poll] of this.polls.entries()) {
      if (poll.endTime && poll.endTime <= now) {
        poll.isActive = false
      }
    }
  }

  // Get poll statistics
  getPollStats(pollId) {
    const poll = this.polls.get(pollId)
    if (!poll) return null

    const totalVotes = poll.options.reduce((sum, option) => sum + option.votes, 0)
    const votedUsers = this.votes.get(pollId)?.size || 0

    return {
      ...poll,
      totalVotes,
      uniqueVoters: votedUsers,
      isExpired: poll.endTime ? poll.endTime <= Date.now() : false
    }
  }
}

const store = new MemoryStore()

// Cleanup expired polls every minute
setInterval(() => {
  store.cleanupExpiredPolls()
}, 60000)

module.exports = store
