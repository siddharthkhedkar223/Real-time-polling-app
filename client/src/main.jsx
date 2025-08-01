import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { io } from 'socket.io-client'

// Force cache refresh - timestamp: 2025-08-02-02-15-FINAL-UPDATE
// Toast Component
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2000) // Reduced from 3000 to 2000ms
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className={`fixed bottom-4 right-4 p-3 rounded-lg shadow-lg z-40 max-w-xs ${
      type === 'success' ? 'bg-green-500' : 
      type === 'error' ? 'bg-red-500' : 
      type === 'info' ? 'bg-blue-500' : 'bg-gray-500'
    } text-white text-sm text-center`}>
      {message}
    </div>
  )
}

// Connection Status Component (Hidden)
function ConnectionStatus({ status }) {
  return null // Hidden as requested
}

// Main Polling App Component
function PollingApp() {
  const [userRole, setUserRole] = useState(null)
  const [selectedRole, setSelectedRole] = useState('student') // Default selection
  const [currentView, setCurrentView] = useState('home')
  const [socket, setSocket] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [toast, setToast] = useState(null)
  const [currentPoll, setCurrentPoll] = useState(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [hasVoted, setHasVoted] = useState(false)
  const [selectedOption, setSelectedOption] = useState(null)
  const [studentName, setStudentName] = useState('')
  const [isNameSubmitted, setIsNameSubmitted] = useState(false)
  const [joinedStudents, setJoinedStudents] = useState([])
  const [showParticipantsPanel, setShowParticipantsPanel] = useState(false)
  const [isKickedOut, setIsKickedOut] = useState(false)
  const [activeTab, setActiveTab] = useState('participants') // 'chat' or 'participants'
  const [chatMessages, setChatMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  
  // Poll creation form data
  const [pollData, setPollData] = useState({
    question: '',
    options: ['', ''],
    duration: 60,
    correctAnswers: [] // Track which options are correct
  })

  // Show toast notification
  const showToast = (message, type = 'info') => {
    setToast({ message, type })
  }

  // Initialize Socket.IO connection
  useEffect(() => {
    if (userRole) {
      setConnectionStatus('connecting')
      const newSocket = io('http://localhost:5000', {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true
      })

      newSocket.on('connect', () => {
        setConnectionStatus('connected')
        showToast('Connected to server!', 'success')
        
        // If student with name, join as student
        if (userRole === 'student' && isNameSubmitted) {
          newSocket.emit('joinAsStudent', { name: studentName })
        }
      })

      newSocket.on('connect_error', (error) => {
        setConnectionStatus('disconnected')
        showToast(`Connection failed: ${error.message}`, 'error')
        console.error('Socket connection error:', error)
      })

      newSocket.on('disconnect', () => {
        setConnectionStatus('disconnected')
        showToast('Disconnected from server', 'error')
      })

      newSocket.on('newPoll', (poll) => {
        if (userRole === 'student') {
          setCurrentPoll(poll)
          setCurrentView('voting')
          setHasVoted(false)
          setSelectedOption(null)
          setTimeLeft(poll.duration) // Set correct timer
          showToast('New poll available!', 'info')
        }
      })

      newSocket.on('pollUpdate', (poll) => {
        setCurrentPoll(prevPoll => {
          if (!prevPoll) return poll
          // Only update votes and other data, preserve duration and timer-related properties
          // Don't reset timeLeft - keep the current countdown
          return {
            ...prevPoll,
            votes: poll.votes,
            voterNames: poll.voterNames,
            ended: poll.ended
            // Explicitly NOT updating duration or any timer-related fields
          }
        })
        // Don't reset timeLeft here - let it continue counting down
      })

      newSocket.on('pollEnded', () => {
        if (userRole === 'student') {
          setCurrentView('results')
          showToast('Poll has ended', 'info')
        }
      })

      newSocket.on('studentsUpdate', (students) => {
        setJoinedStudents(students)
      })

      newSocket.on('chatMessage', (message) => {
        setChatMessages(prev => [...prev, message])
      })

      newSocket.on('kicked', () => {
        if (userRole === 'student') {
          setIsKickedOut(true)
          showToast('You have been kicked out by the teacher!', 'error')
        }
      })

      setSocket(newSocket)

      return () => {
        newSocket.close()
      }
    }
  }, [userRole, isNameSubmitted, studentName])

  // Timer effect
  useEffect(() => {
    if (currentPoll && !currentPoll.ended && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (userRole === 'teacher') {
              setCurrentPoll(p => ({ ...p, ended: true }))
              socket?.emit('endPoll', currentPoll.id)
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [currentPoll, timeLeft, userRole, socket])

  // Set timer when poll starts
  useEffect(() => {
    if (currentPoll && currentPoll.duration && !currentPoll.ended && timeLeft === 0) {
      // Only set timer if it's not already running (timeLeft === 0)
      setTimeLeft(currentPoll.duration)
    }
  }, [currentPoll])

  // Update poll data
  const updateOption = (index, value) => {
    setPollData(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => i === index ? value : opt)
    }))
  }

  const addOption = () => {
    setPollData(prev => ({
      ...prev,
      options: [...prev.options, '']
    }))
  }

  // Toggle correct answer
  const toggleCorrectAnswer = (index) => {
    setPollData(prev => ({
      ...prev,
      correctAnswers: prev.correctAnswers.includes(index)
        ? prev.correctAnswers.filter(i => i !== index)
        : [...prev.correctAnswers, index]
    }))
  }

  // Create poll
  const createPoll = async (e) => {
    e.preventDefault()
    
    if (!socket || connectionStatus !== 'connected') {
      showToast('Not connected to server', 'error')
      return
    }

    try {
      const pollId = Date.now().toString()
      const poll = {
        id: pollId,
        question: pollData.question,
        options: pollData.options.filter(opt => opt.trim()),
        duration: pollData.duration,
        votes: {},
        ended: false
      }

      setCurrentPoll(poll)
      setTimeLeft(pollData.duration)
      setCurrentView('results') // Go directly to results view instead of activePoll
      
      socket.emit('createPoll', poll)
      showToast('Poll created and broadcast!', 'success')
      
      // Reset form
      setPollData({
        question: '',
        options: ['', ''],
        duration: 60,
        correctAnswers: []
      })
    } catch (error) {
      showToast('Error creating poll', 'error')
    }
  }

  // Submit vote
  const submitVote = async () => {
    if (!socket || connectionStatus !== 'connected' || hasVoted || !selectedOption) return

    try {
      socket.emit('vote', { pollId: currentPoll.id, option: selectedOption })
      setHasVoted(true)
      showToast('Vote submitted!', 'success')
    } catch (error) {
      showToast('Error submitting vote', 'error')
    }
  }

  // Student name submission
  const submitStudentName = (e) => {
    e.preventDefault()
    if (studentName.trim()) {
      setIsNameSubmitted(true)
      if (socket && connectionStatus === 'connected') {
        socket.emit('joinAsStudent', { name: studentName.trim() })
      }
      showToast(`Welcome ${studentName}!`, 'success')
    }
  }

  // Handle Continue button from role selection
  const handleContinue = () => {
    setUserRole(selectedRole)
  }

  // Go home
  const goHome = () => {
    setUserRole(null)
    setSelectedRole('student') // Reset to default selection
    setCurrentView('home')
    setCurrentPoll(null)
    setHasVoted(false)
    setSelectedOption(null)
    setStudentName('')
    setIsNameSubmitted(false)
    setJoinedStudents([])
    setShowParticipantsPanel(false)
    setIsKickedOut(false)
    setActiveTab('participants')
    setChatMessages([])
    setNewMessage('')
  }

  // Kick out student (Teacher only)
  const kickOutStudent = (studentName) => {
    if (socket && connectionStatus === 'connected') {
      socket.emit('kickStudent', { studentName })
      showToast(`${studentName} has been kicked out`, 'info')
    }
  }

  // Send chat message
  const sendChatMessage = (e) => {
    e.preventDefault()
    if (!socket || connectionStatus !== 'connected' || !newMessage.trim()) return

    const message = {
      id: Date.now(),
      text: newMessage.trim(),
      sender: userRole === 'teacher' ? 'Teacher' : studentName,
      role: userRole,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    socket.emit('chatMessage', message)
    setNewMessage('')
  }

  // Student Dashboard
  if (userRole === 'student') {
    // Show name input if not submitted yet
    if (!isNameSubmitted) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center p-8">
          <ConnectionStatus status={connectionStatus} />
          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
          
          {/* Home Button - Top Right */}
          <div className="absolute top-8 right-8 z-50">
            <button onClick={goHome} className="text-white px-6 py-3 rounded-lg font-semibold transition-colors" style={{ backgroundColor: '#6E6E6E' }}>
              ← Home
            </button>
          </div>
          
          <div className="max-w-2xl w-full">
            {/* Top Badge - Intervue Poll */}
            <div className="text-center mb-8">
              <span 
                className="inline-block px-6 py-3 rounded-full text-lg font-semibold text-white"
                style={{ 
                  background: 'linear-gradient(135deg, #4F0DCE 0%, #7765DA 100%)'
                }}
              >
                💠 Intervue Poll
              </span>
            </div>

            {/* Title - Let's Get Started */}
            <div className="text-center mb-8">
              <h1 className="text-5xl mb-6" style={{ color: '#373737' }}>
                Let's <span className="font-bold">Get Started</span>
              </h1>
            </div>

            {/* Description Text */}
            <div className="mb-8 text-center">
              <p className="text-lg leading-relaxed" style={{ color: '#6E6E6E' }}>
                If you're a student, you'll be able to <span className="font-bold" style={{ color: '#373737' }}>submit your answers</span>, participate in live polls, and see how your responses compare with your classmates.
              </p>
            </div>
            
            <form onSubmit={submitStudentName} className="space-y-8">
              {/* Input Field - Enter your Name */}
              <div>
                <label className="block text-xl font-medium mb-4" style={{ color: '#373737' }}>
                  Enter your Name
                </label>
                <input 
                  type="text" 
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  required 
                  className="w-full px-6 py-4 text-xl rounded-xl focus:outline-none transition-colors" 
                  style={{ 
                    backgroundColor: '#F2F2F2',
                    color: '#373737',
                    border: 'none'
                  }}
                  placeholder="Rahul Bajaj"
                  maxLength="50"
                />
              </div>
              
              {/* Continue Button */}
              <div className="text-center">
                <button 
                  type="submit" 
                  className="px-16 py-4 rounded-full text-xl font-semibold text-white shadow-lg transform hover:scale-105 transition-all duration-200"
                  style={{ 
                    background: 'linear-gradient(135deg, #4F0DCE 0%, #5767D0 100%)'
                  }}
                >
                  Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      )
    }

    // Show kicked out screen if student was kicked
    if (isKickedOut) {
      return (
        <div className="min-h-screen bg-gray-50 p-4">
          <ConnectionStatus status={connectionStatus} />
          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
          
          {/* Home Button - Top Right */}
          <div className="absolute top-8 right-8 z-50">
            <button onClick={goHome} className="text-white px-6 py-3 rounded-lg font-semibold transition-colors" style={{ backgroundColor: '#6E6E6E' }}>
              ← Home
            </button>
          </div>
          
          <div className="max-w-2xl mx-auto">
            {/* Welcome Header */}
            <div className="text-center mb-12 mt-8">
              <h2 className="text-5xl font-bold mb-4" style={{ color: '#373737' }}>
                🎓 Welcome, <span style={{ color: '#4F0DCE' }}>{studentName}</span>!
              </h2>
              <p className="text-xl" style={{ color: '#6E6E6E' }}>
                Ready to participate in live polls and see real-time results
              </p>
            </div>

            <div className="min-h-[60vh] flex flex-col items-center justify-center relative">
              {/* Intervue Poll Badge */}
              <div className="mb-12">
                <span 
                  className="inline-block px-6 py-3 rounded-full text-lg font-medium text-white"
                  style={{ 
                    background: 'linear-gradient(135deg, #4F0DCE 0%, #7765DA 100%)'
                  }}
                >
                  💠 Intervue Poll
                </span>
              </div>

              {/* Kicked Out Message */}
              <div className="text-center">
                <h3 className="text-4xl font-bold mb-4" style={{ color: '#373737' }}>
                  You've been kicked out
                </h3>
                <p className="text-lg" style={{ color: '#6E6E6E' }}>
                  Looks like the teacher has removed you from this session
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <ConnectionStatus status={connectionStatus} />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        
        {/* Home Button - Top Right */}
        <div className="absolute top-8 right-8 z-50">
          <button onClick={goHome} className="text-white px-6 py-3 rounded-lg font-semibold transition-colors" style={{ backgroundColor: '#6E6E6E' }}>
            ← Home
          </button>
        </div>
        
        <div className="max-w-2xl mx-auto">
          {/* Welcome Header */}
          <div className="text-center mb-12 mt-8">
            <h2 className="text-5xl font-bold mb-4" style={{ color: '#373737' }}>
              🎓 Welcome, <span style={{ color: '#4F0DCE' }}>{studentName}</span>!
            </h2>
            <p className="text-xl" style={{ color: '#6E6E6E' }}>
              Ready to participate in live polls and see real-time results
            </p>
          </div>

          {!currentPoll && (
            <div className="min-h-[60vh] flex flex-col items-center justify-center relative">
              {/* Intervue Poll Badge */}
              <div className="mb-12">
                <span 
                  className="inline-block px-6 py-3 rounded-full text-lg font-medium text-white"
                  style={{ 
                    background: 'linear-gradient(135deg, #4F0DCE 0%, #7765DA 100%)'
                  }}
                >
                  💠 Intervue Poll
                </span>
              </div>

              {/* Animated Spinner */}
              <div className="mb-12">
                <div 
                  className="w-20 h-20 border-4 border-gray-200 border-t-4 rounded-full animate-spin"
                  style={{ borderTopColor: '#4F0DCE' }}
                ></div>
              </div>

              {/* Wait Message */}
              <div className="text-center">
                <h3 className="text-4xl font-bold" style={{ color: '#373737' }}>
                  Wait for the teacher to ask questions..
                </h3>
              </div>

              {/* Bottom-Right Floating Chat Button */}
              <div className="fixed bottom-8 right-8">
                <button 
                  onClick={() => setShowParticipantsPanel(!showParticipantsPanel)}
                  className="w-16 h-16 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center transform hover:scale-105"
                  style={{ backgroundColor: '#4F0DCE' }}
                  title="Participants & Chat"
                >
                  <svg 
                    className="w-8 h-8 text-white" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
                    />
                  </svg>
                </button>

                {/* Participants/Chat Panel - Floating */}
                {showParticipantsPanel && (
                  <div className="absolute bottom-20 right-0 w-80 bg-white rounded-lg shadow-xl border z-50">
                    {/* Tab Headers */}
                    <div className="flex border-b">
                      <button 
                        onClick={() => setActiveTab('chat')}
                        className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                          activeTab === 'chat' 
                            ? 'border-purple-500 text-purple-600' 
                            : 'border-transparent text-gray-600 hover:text-purple-600'
                        }`}
                      >
                        Chat
                      </button>
                      <button 
                        onClick={() => setActiveTab('participants')}
                        className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                          activeTab === 'participants' 
                            ? 'border-purple-500 text-purple-600' 
                            : 'border-transparent text-gray-600 hover:text-purple-600'
                        }`}
                      >
                        Participants
                      </button>
                    </div>

                    {/* Chat Content */}
                    {activeTab === 'chat' && (
                      <div className="flex flex-col h-80">
                        {/* Messages */}
                        <div className="flex-1 p-4 overflow-y-auto space-y-2">
                          {chatMessages.map((msg) => (
                            <div key={msg.id} className="text-sm">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`font-semibold ${
                                  msg.role === 'teacher' ? 'text-purple-600' : 'text-blue-600'
                                }`}>
                                  {msg.sender}
                                </span>
                                <span className="text-xs text-gray-500">{msg.timestamp}</span>
                              </div>
                              <div className="text-gray-700 pl-2">{msg.text}</div>
                            </div>
                          ))}
                          {chatMessages.length === 0 && (
                            <div className="text-center text-gray-500 italic py-8">
                              No messages yet. Start the conversation!
                            </div>
                          )}
                        </div>
                        
                        {/* Message Input */}
                        <form onSubmit={sendChatMessage} className="p-3 border-t">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              placeholder="Type a message..."
                              className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:border-purple-500"
                            />
                            <button
                              type="submit"
                              disabled={!newMessage.trim()}
                              className="px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Send
                            </button>
                          </div>
                        </form>
                      </div>
                    )}

                    {/* Participants Content */}
                    {activeTab === 'participants' && (
                      <div className="p-4 max-h-64 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left">
                              <th className="py-2 font-semibold" style={{ color: '#373737' }}>Name</th>
                              <th className="py-2 font-semibold" style={{ color: '#373737' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {joinedStudents.map((student, index) => (
                              <tr key={index} className="border-t border-gray-100">
                                <td className="py-2" style={{ color: '#373737' }}>{student.name}</td>
                                <td className="py-2">
                                  <span className="text-green-600 text-xs">Online</span>
                                </td>
                              </tr>
                            ))}
                            {joinedStudents.length === 0 && (
                              <tr>
                                <td colSpan="2" className="py-4 text-center text-gray-500 italic">
                                  No participants yet
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {currentPoll && currentView === 'voting' && (
            <div className="max-w-md mx-auto space-y-4">
              {/* Question and Timer - Above Card */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold" style={{ color: '#000000' }}>
                  Question 1
                </h3>
                <div className="text-red-600 font-semibold flex items-center space-x-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-lg">
                    00:{timeLeft.toString().padStart(2, '0')}
                  </span>
                </div>
              </div>

              {/* Voting Card */}
              <div className="bg-white rounded-xl shadow-md hover:shadow-md transition-shadow duration-200 overflow-hidden">
                {/* Question Header with Black Gradient */}
                <div className="bg-gradient-to-br from-gray-800 via-gray-900 to-black text-white font-semibold text-center py-4 px-6">
                  <h4 className="text-lg">
                    {currentPoll.question}
                  </h4>
                </div>
                
                {/* Options Section */}
                <div className="p-6">
                  <div className="space-y-3">
                    {currentPoll.options.map((option, index) => {
                      const isSelected = selectedOption === option
                      const isDisabled = hasVoted
                      
                      return (
                        <div 
                          key={`${option}-${index}`}
                          onClick={() => !isDisabled && setSelectedOption(option)}
                          className={`flex items-center gap-4 px-4 py-3 rounded-md cursor-pointer transition-all border-2 ${
                            isDisabled 
                              ? 'opacity-60 cursor-not-allowed bg-gray-100 border-gray-200' 
                              : isSelected
                              ? 'bg-purple-50 border-purple-500'
                              : 'bg-gray-100 border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                          }`}
                        >
                          {/* Option Number Circle */}
                          <div className={`w-6 h-6 text-xs font-medium flex items-center justify-center rounded-full ${
                            isSelected 
                              ? 'bg-purple-500 text-white' 
                              : 'bg-gray-300 text-gray-700'
                          }`}>
                            {index + 1}
                          </div>
                          
                          {/* Option Text */}
                          <span className="text-base font-normal flex-1 text-left">
                            {option}
                          </span>

                          {/* Selection Radio */}
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            isSelected 
                              ? 'border-purple-500 bg-purple-500' 
                              : 'border-gray-300 bg-white'
                          }`}>
                            {isSelected && (
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Submit Button - Below Card, Bottom Right */}
              <div className="flex justify-end mt-4">
                <button 
                  onClick={submitVote}
                  disabled={hasVoted || !selectedOption}
                  className={`px-12 py-4 rounded-full text-xl font-bold text-white shadow-lg transform transition-all duration-200 ${
                    hasVoted || !selectedOption
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:scale-105 hover:shadow-xl'
                  }`}
                  style={{ 
                    background: hasVoted || !selectedOption
                      ? 'linear-gradient(135deg, #A0A0A0 0%, #808080 100%)'
                      : 'linear-gradient(135deg, #856DF1 0%, #4F0DCE 100%)'
                  }}
                >
                  {hasVoted ? 'Submitted!' : !selectedOption ? 'Select an Option' : 'Submit'}
                </button>
              </div>

              {/* Floating Help Button - Bottom Right */}
              <div className="fixed bottom-8 right-8">
                <button 
                  onClick={() => setShowParticipantsPanel(!showParticipantsPanel)}
                  className="w-16 h-16 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center transform hover:scale-105"
                  style={{ backgroundColor: '#4F0DCE' }}
                  title="Participants & Chat"
                >
                  <svg 
                    className="w-8 h-8 text-white" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
                    />
                  </svg>
                </button>

                {/* Participants/Chat Panel - Floating */}
                {showParticipantsPanel && (
                  <div className="absolute bottom-20 right-0 w-80 bg-white rounded-lg shadow-xl border z-50">
                    {/* Tab Headers */}
                    <div className="flex border-b">
                      <button 
                        onClick={() => setActiveTab('chat')}
                        className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                          activeTab === 'chat' 
                            ? 'border-purple-500 text-purple-600' 
                            : 'border-transparent text-gray-600 hover:text-purple-600'
                        }`}
                      >
                        Chat
                      </button>
                      <button 
                        onClick={() => setActiveTab('participants')}
                        className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                          activeTab === 'participants' 
                            ? 'border-purple-500 text-purple-600' 
                            : 'border-transparent text-gray-600 hover:text-purple-600'
                        }`}
                      >
                        Participants
                      </button>
                    </div>

                    {/* Chat Content */}
                    {activeTab === 'chat' && (
                      <div className="flex flex-col h-80">
                        {/* Messages */}
                        <div className="flex-1 p-4 overflow-y-auto space-y-2">
                          {chatMessages.map((msg) => (
                            <div key={msg.id} className="text-sm">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`font-semibold ${
                                  msg.role === 'teacher' ? 'text-purple-600' : 'text-blue-600'
                                }`}>
                                  {msg.sender}
                                </span>
                                <span className="text-xs text-gray-500">{msg.timestamp}</span>
                              </div>
                              <div className="text-gray-700 pl-2">{msg.text}</div>
                            </div>
                          ))}
                          {chatMessages.length === 0 && (
                            <div className="text-center text-gray-500 italic py-8">
                              No messages yet. Start the conversation!
                            </div>
                          )}
                        </div>
                        
                        {/* Message Input */}
                        <form onSubmit={sendChatMessage} className="p-3 border-t">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              placeholder="Type a message..."
                              className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:border-purple-500"
                            />
                            <button
                              type="submit"
                              disabled={!newMessage.trim()}
                              className="px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Send
                            </button>
                          </div>
                        </form>
                      </div>
                    )}

                    {/* Participants Content */}
                    {activeTab === 'participants' && (
                      <div className="p-4 max-h-64 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left">
                              <th className="py-2 font-semibold" style={{ color: '#373737' }}>Name</th>
                              <th className="py-2 font-semibold" style={{ color: '#373737' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {joinedStudents.map((student, index) => (
                              <tr key={index} className="border-t border-gray-100">
                                <td className="py-2" style={{ color: '#373737' }}>{student.name}</td>
                                <td className="py-2">
                                  <span className="text-green-600 text-xs">Online</span>
                                </td>
                              </tr>
                            ))}
                            {joinedStudents.length === 0 && (
                              <tr>
                                <td colSpan="2" className="py-4 text-center text-gray-500 italic">
                                  No participants yet
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {currentView === 'results' && currentPoll && (
            <div className="max-w-lg mx-auto">
              {/* Question and Timer - Above Card */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold" style={{ color: '#000000' }}>
                  Question 1
                </h3>
                <div className="text-red-600 font-medium flex items-center space-x-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm">
                    00:00
                  </span>
                </div>
              </div>

              {/* Results Card */}
              <div className="bg-white rounded-md shadow-md overflow-hidden">
                {/* Question Header with Dark Gradient */}
                <div className="rounded-t-md bg-gradient-to-r from-gray-700 to-gray-900 text-white font-semibold px-4 py-2">
                  {currentPoll.question}
                </div>
                
                {/* Options with Progress Bars */}
                <div className="p-4">
                  <div className="space-y-2">
                    {currentPoll.options.map((option, index) => {
                      const count = currentPoll.votes[option] || 0
                      const total = Object.values(currentPoll.votes).reduce((sum, count) => sum + count, 0)
                      const percentage = total > 0 ? Math.round((count / total) * 100) : 0
                      
                      return (
                        <div key={option} className="relative bg-gray-100 rounded-md mb-2 overflow-hidden border border-purple-300">
                          <div 
                            className="absolute top-0 left-0 h-full transition-all duration-1000" 
                            style={{ 
                              width: `${percentage}%`,
                              background: 'linear-gradient(135deg, rgba(79, 13, 206, 0.7) 0%, rgba(119, 101, 218, 0.7) 100%)'
                            }}
                          ></div>
                          <div className="relative z-10 flex items-center justify-between px-4 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-white border text-sm font-bold flex items-center justify-center">
                                {index + 1}
                              </div>
                              <span className="text-sm font-medium">{option}</span>
                            </div>
                            <div className="border border-purple-500 text-purple-700 text-xs px-2 py-0.5 rounded-md bg-white">
                              {percentage}%
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Footer Message */}
              <p className="text-center mt-4 font-semibold text-lg" style={{ color: '#373737' }}>
                Wait for the teacher to ask a new question..
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Teacher Dashboard
  if (userRole === 'teacher') {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <ConnectionStatus status={connectionStatus} />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        
        {/* Home Button - Top Right */}
        <div className="absolute top-8 right-8 z-50">
          <button onClick={goHome} className="text-white px-6 py-3 rounded-lg font-semibold transition-colors" style={{ backgroundColor: '#6E6E6E' }}>
            ← Home
          </button>
        </div>
        
        <div className="max-w-6xl mx-auto">
          {(currentView === 'teacher' || !currentPoll) && (
            <div className="max-w-7xl mx-auto mt-8">
              {/* Top Tag */}
              <div className="mb-10">
                <span 
                  className="inline-block px-6 py-3 rounded-full text-lg font-semibold text-white"
                  style={{ 
                    background: 'linear-gradient(135deg, #4F0DCE 0%, #7765DA 100%)'
                  }}
                >
                  💠 Intervue Poll
                </span>
              </div>

              {/* Page Title */}
              <div className="mb-12">
                <h1 className="text-6xl mb-6" style={{ color: '#373737' }}>
                  Let's <span className="font-bold">Get Started</span>
                </h1>
                <p className="text-xl leading-relaxed" style={{ color: '#6E6E6E' }}>
                  you'll have the ability to create and manage polls, ask questions,<br />
                  and monitor your students' responses in real-time.
                </p>
              </div>

              <div className="flex justify-between items-start gap-16">
                {/* Left Side - Form Content */}
                <div className="flex-1 max-w-4xl">
                  <form id="poll-form" onSubmit={createPoll}>
                {/* Question Input Section */}
                <div className="mb-12">
                  <div className="flex justify-between items-center mb-6">
                    <label className="block text-xl font-bold" style={{ color: '#373737' }}>
                      Enter your question
                    </label>
                    {/* Timer Dropdown - Top Right */}
                    <div>
                      <select
                        value={pollData.duration}
                        onChange={(e) => setPollData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                        className="px-4 py-3 rounded-lg text-lg font-semibold focus:outline-none"
                        style={{ 
                          backgroundColor: '#F2F2F2',
                          color: '#373737',
                          border: '2px solid #5767D0'
                        }}
                      >
                        <option value={30}>30 seconds</option>
                        <option value={60}>60 seconds</option>
                        <option value={90}>90 seconds</option>
                        <option value={120}>120 seconds</option>
                        <option value={180}>180 seconds</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <textarea
                      value={pollData.question}
                      onChange={(e) => setPollData(prev => ({ ...prev, question: e.target.value }))}
                      required
                      className="w-full px-6 py-6 text-xl rounded-xl resize-none focus:outline-none"
                      style={{ 
                        backgroundColor: '#F2F2F2',
                        color: '#373737',
                        minHeight: '150px'
                      }}
                      placeholder="Type your question here..."
                      maxLength={100}
                    />

                    {/* Character Counter */}
                    <div className="absolute bottom-6 right-6 text-lg font-medium" style={{ color: '#6E6E6E' }}>
                      {pollData.question.length}/100
                    </div>
                  </div>
                </div>

                {/* Options Section */}
                <div className="mb-12">
                  {/* Labels Row */}
                  <div className="flex justify-between items-center mb-8">
                    <label className="text-xl font-bold" style={{ color: '#373737' }}>
                      Edit Options
                    </label>
                    <label className="text-xl font-bold" style={{ color: '#373737' }}>
                      Is it Correct?
                    </label>
                  </div>

                  {/* Option Rows */}
                  <div className="space-y-6">
                    {pollData.options.map((option, index) => (
                      <div key={index} className="flex items-center gap-6">
                        {/* Option Number Badge */}
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg"
                          style={{ backgroundColor: '#7765DA' }}
                        >
                          {index + 1}
                        </div>

                        {/* Option Input */}
                        <div className="flex-1">
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => updateOption(index, e.target.value)}
                            required
                            className="w-full px-6 py-4 text-lg rounded-xl focus:outline-none"
                            style={{ 
                              backgroundColor: '#F2F2F2',
                              color: '#373737'
                            }}
                            placeholder={`Option ${index + 1}`}
                          />
                        </div>

                        {/* Radio Buttons */}
                        <div className="flex items-center gap-8">
                          {/* Yes Option */}
                          <label className="flex items-center gap-3 cursor-pointer">
                            <div className="relative">
                              <input
                                type="radio"
                                name={`correct-${index}`}
                                checked={pollData.correctAnswers.includes(index)}
                                onChange={() => toggleCorrectAnswer(index)}
                                className="sr-only"
                              />
                              <div 
                                className="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all"
                                style={{
                                  borderColor: pollData.correctAnswers.includes(index) ? '#4F0DCE' : '#CFCFCF',
                                  backgroundColor: pollData.correctAnswers.includes(index) ? '#4F0DCE' : 'transparent'
                                }}
                              >
                                {pollData.correctAnswers.includes(index) && (
                                  <div className="w-3 h-3 bg-white rounded-full"></div>
                                )}
                              </div>
                            </div>
                            <span className="text-lg font-medium" style={{ color: '#373737' }}>Yes</span>
                          </label>

                          {/* No Option */}
                          <label className="flex items-center gap-3 cursor-pointer">
                            <div className="relative">
                              <input
                                type="radio"
                                name={`correct-${index}`}
                                checked={!pollData.correctAnswers.includes(index)}
                                onChange={() => {
                                  if (pollData.correctAnswers.includes(index)) {
                                    toggleCorrectAnswer(index)
                                  }
                                }}
                                className="sr-only"
                              />
                              <div 
                                className="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all"
                                style={{
                                  borderColor: !pollData.correctAnswers.includes(index) ? '#4F0DCE' : '#CFCFCF',
                                  backgroundColor: !pollData.correctAnswers.includes(index) ? '#4F0DCE' : 'transparent'
                                }}
                              >
                                {!pollData.correctAnswers.includes(index) && (
                                  <div className="w-3 h-3 bg-white rounded-full"></div>
                                )}
                              </div>
                            </div>
                            <span className="text-lg font-medium" style={{ color: '#373737' }}>No</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add More Option Button */}
                  <div className="mt-8">
                    <button
                      type="button"
                      onClick={addOption}
                      className="px-8 py-4 rounded-xl text-lg font-semibold transition-all hover:bg-opacity-10"
                      style={{
                        color: '#4F0DCE',
                        border: '2px solid #4F0DCE',
                        backgroundColor: 'transparent'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#4F0DCE20'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    >
                      + Add More option
                    </button>
                  </div>
                </div>

                {/* Footer Button - Remove from form */}
                </form>
                </div>
              </div>

              {/* Ask Question Button - Bottom Right */}
              <div className="flex justify-end mt-8">
                <button
                  type="submit"
                  form="poll-form"
                  className="px-20 py-6 rounded-full text-2xl font-bold text-white shadow-xl transform hover:scale-105 transition-all duration-200"
                  style={{ 
                    background: 'linear-gradient(135deg, #4F0DCE 0%, #7765DA 100%)'
                  }}
                >
                  Ask Question
                </button>
              </div>
            </div>
          )}

          {/* Teacher Results View - EXACT SAME as Student */}
          {currentView === 'results' && currentPoll && (
            <div className="max-w-lg mx-auto">
              {/* Question and Timer - Above Card */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold" style={{ color: '#000000' }}>
                  Question 1
                </h3>
                <div className="text-red-600 font-medium flex items-center space-x-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm">
                    {timeLeft > 0 ? `00:${timeLeft.toString().padStart(2, '0')}` : '00:00'}
                  </span>
                </div>
              </div>

              {/* Results Card */}
              <div className="bg-white rounded-md shadow-md overflow-hidden">
                {/* Question Header with Dark Gradient */}
                <div className="rounded-t-md bg-gradient-to-r from-gray-700 to-gray-900 text-white font-semibold px-4 py-2">
                  {currentPoll.question}
                </div>
                
                {/* Options with Progress Bars */}
                <div className="p-4">
                  <div className="space-y-2">
                    {currentPoll.options.map((option, index) => {
                      const count = currentPoll.votes[option] || 0
                      const total = Object.values(currentPoll.votes).reduce((sum, count) => sum + count, 0)
                      const percentage = total > 0 ? Math.round((count / total) * 100) : 0
                      
                      return (
                        <div key={option} className="relative bg-gray-100 rounded-md mb-2 overflow-hidden border border-purple-300">
                          <div 
                            className="absolute top-0 left-0 h-full transition-all duration-1000" 
                            style={{ 
                              width: `${percentage}%`,
                              background: 'linear-gradient(135deg, rgba(79, 13, 206, 0.7) 0%, rgba(119, 101, 218, 0.7) 100%)'
                            }}
                          ></div>
                          <div className="relative z-10 flex items-center justify-between px-4 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-white border text-sm font-bold flex items-center justify-center">
                                {index + 1}
                              </div>
                              <span className="text-sm font-medium">{option}</span>
                            </div>
                            <div className="border border-purple-500 text-purple-700 text-xs px-2 py-0.5 rounded-md bg-white">
                              {percentage}%
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Footer Message - EXACT SAME as Student */}
              <p className="text-center mt-4 font-semibold text-lg" style={{ color: '#373737' }}>
                Wait for the teacher to ask a new question..
              </p>
              
              {/* Teacher Only: Ask New Question Button */}
              {userRole === 'teacher' && (
                <div className="text-center mt-8">
                  <button 
                    onClick={() => {
                      setCurrentView('teacher')
                      setCurrentPoll(null)
                    }}
                    className="px-8 py-3 rounded-full text-white font-semibold transition-all duration-200 transform hover:scale-105"
                    style={{ 
                      background: 'linear-gradient(135deg, #4F0DCE 0%, #7765DA 100%)'
                    }}
                  >
                    + Ask a new question
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Floating Chat/Participants Button - Bottom Right (Always visible for teacher) */}
        <div className="fixed bottom-8 right-8">
          <button 
            onClick={() => setShowParticipantsPanel(!showParticipantsPanel)}
            className="w-16 h-16 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center transform hover:scale-105"
            style={{ backgroundColor: '#4F0DCE' }}
            title="Participants & Management"
          >
            <svg 
              className="w-8 h-8 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
              />
            </svg>
          </button>

          {/* Participants/Management Panel - Floating */}
          {showParticipantsPanel && (
            <div className="absolute bottom-20 right-0 w-80 bg-white rounded-lg shadow-xl border z-50">
              {/* Tab Headers */}
              <div className="flex border-b">
                <button 
                  onClick={() => setActiveTab('chat')}
                  className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'chat' 
                      ? 'border-purple-500 text-purple-600' 
                      : 'border-transparent text-gray-600 hover:text-purple-600'
                  }`}
                >
                  Chat
                </button>
                <button 
                  onClick={() => setActiveTab('participants')}
                  className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'participants' 
                      ? 'border-purple-500 text-purple-600' 
                      : 'border-transparent text-gray-600 hover:text-purple-600'
                  }`}
                >
                  Participants
                </button>
              </div>

              {/* Chat Content */}
              {activeTab === 'chat' && (
                <div className="flex flex-col h-80">
                  {/* Messages */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-2">
                    {chatMessages.map((msg) => (
                      <div key={msg.id} className="text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-semibold ${
                            msg.role === 'teacher' ? 'text-purple-600' : 'text-blue-600'
                          }`}>
                            {msg.sender}
                          </span>
                          <span className="text-xs text-gray-500">{msg.timestamp}</span>
                        </div>
                        <div className="text-gray-700 pl-2">{msg.text}</div>
                      </div>
                    ))}
                    {chatMessages.length === 0 && (
                      <div className="text-center text-gray-500 italic py-8">
                        No messages yet. Start the conversation!
                      </div>
                    )}
                  </div>
                  
                  {/* Message Input */}
                  <form onSubmit={sendChatMessage} className="p-3 border-t">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:border-purple-500"
                      />
                      <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Send
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Participants Content */}
              {activeTab === 'participants' && (
                <div className="p-4 max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left">
                        <th className="py-2 font-semibold" style={{ color: '#373737' }}>Name</th>
                        <th className="py-2 font-semibold" style={{ color: '#373737' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {joinedStudents.map((student, index) => (
                        <tr key={index} className="border-t border-gray-100">
                          <td className="py-2" style={{ color: '#373737' }}>{student.name}</td>
                          <td className="py-2">
                            <button
                              onClick={() => kickOutStudent(student.name)}
                              className="bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1 rounded transition-colors"
                              title="Kick out student"
                            >
                              Kick
                            </button>
                          </td>
                        </tr>
                      ))}
                      {joinedStudents.length === 0 && (
                        <tr>
                          <td colSpan="2" className="py-4 text-center text-gray-500 italic">
                            No participants yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Role Selector (Main Page) - Enhanced UI
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8">
      <ConnectionStatus status={connectionStatus} />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="max-w-6xl w-full">
        {/* Top Tag Button */}
        <div className="text-center mb-12">
          <span 
            className="inline-block px-6 py-3 rounded-full text-lg font-semibold text-white"
            style={{ 
              background: 'linear-gradient(135deg, #4F0DCE 0%, #7765DA 100%)'
            }}
          >
            💠 Intervue Poll
          </span>
        </div>
        
        {/* Header Section */}
        <div className="text-center mb-16">
          <h1 className="text-6xl font-normal mb-6" style={{ color: '#373737' }}>
            Welcome to the <span className="font-bold">Live Polling System</span>
          </h1>
          <p className="text-xl max-w-3xl mx-auto leading-relaxed" style={{ color: '#6E6E6E' }}>
            Please select the role that best describes you to begin using the live polling system
          </p>
        </div>
        
        {/* Role Selection Cards */}
        <div className="grid md:grid-cols-2 gap-10 mb-16">
          {/* Student Card */}
          <div 
            onClick={() => setSelectedRole('student')}
            className={`p-10 rounded-2xl cursor-pointer transition-all duration-300 ${
              selectedRole === 'student' 
                ? 'border-2 shadow-xl' 
                : 'border hover:border-gray-300 bg-white'
            }`}
            style={{
              borderColor: selectedRole === 'student' ? '#5767D0' : '#F2F2F2',
              backgroundColor: selectedRole === 'student' ? '#F2F2F2' : 'white'
            }}
          >
            <div className="text-center">
              <h3 className="text-3xl font-bold italic mb-6" style={{ color: '#373737' }}>I'm a Student</h3>
              <p className="text-lg leading-relaxed" style={{ color: '#6E6E6E' }}>
                Join live polls, submit your answers, and see real-time results from your teacher's questions.
              </p>
              {selectedRole === 'student' && (
                <div className="mt-6">
                  <div className="w-8 h-8 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: '#5767D0' }}>
                    <div className="w-3 h-3 bg-white rounded-full"></div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Teacher Card */}
          <div 
            onClick={() => setSelectedRole('teacher')}
            className={`p-10 rounded-2xl cursor-pointer transition-all duration-300 ${
              selectedRole === 'teacher' 
                ? 'border-2 shadow-xl' 
                : 'border hover:border-gray-300 bg-white'
            }`}
            style={{
              borderColor: selectedRole === 'teacher' ? '#5767D0' : '#F2F2F2',
              backgroundColor: selectedRole === 'teacher' ? '#F2F2F2' : 'white'
            }}
          >
            <div className="text-center">
              <h3 className="text-3xl font-bold italic mb-6" style={{ color: '#373737' }}>I'm a Teacher</h3>
              <p className="text-lg leading-relaxed" style={{ color: '#6E6E6E' }}>
                Create engaging polls, monitor student participation, and view live poll results in real-time.
              </p>
              {selectedRole === 'teacher' && (
                <div className="mt-6">
                  <div className="w-8 h-8 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: '#5767D0' }}>
                    <div className="w-3 h-3 bg-white rounded-full"></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Continue Button */}
        <div className="text-center">
          <button 
            onClick={handleContinue}
            className="text-white px-16 py-5 rounded-full text-xl font-bold shadow-xl transform hover:scale-105 transition-all duration-200"
            style={{ 
              background: 'linear-gradient(135deg, #4F0DCE 0%, #7765DA 100%)'
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}

// Mount the app
ReactDOM.createRoot(document.getElementById('root')).render(<PollingApp />)
