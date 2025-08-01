// Socket.IO handlers for real-time polling functionality

const initializeSocketHandlers = (io) => {
  const activeRooms = new Map() // Track active rooms and users
  const activePolls = new Map() // Track active polls
  const connectedStudents = new Map() // Track connected students with names
  
  io.on('connection', (socket) => {
    console.log(`🔗 User connected: ${socket.id}`)
    
    // 👤 STUDENT JOINS WITH NAME
    socket.on('joinAsStudent', (studentData) => {
      console.log('👤 Student joined:', studentData);
      
      // Store student info
      connectedStudents.set(socket.id, {
        name: studentData.name,
        socketId: socket.id,
        joinedAt: new Date()
      });
      
      // Broadcast updated student list to teachers
      const studentList = Array.from(connectedStudents.values());
      io.emit('studentsUpdate', studentList);
      
      console.log(`✅ Student ${studentData.name} joined successfully`);
    });
    
    // 🎯 TEACHER CREATES POLL - BROADCAST TO ALL STUDENTS
    socket.on('createPoll', (pollData) => {
      console.log('📡 Broadcasting new poll to all clients:', pollData);
      
      // Initialize poll with proper vote structure
      pollData.votes = {};
      pollData.voters = []; // Track who voted
      pollData.voterNames = []; // Track voter names
      pollData.joinedStudents = Array.from(connectedStudents.values());
      
      // Store the poll
      activePolls.set(pollData.id, pollData);
      
      // 🚀 BROADCAST TO ALL CONNECTED CLIENTS
      io.emit('newPoll', pollData);
      
      console.log(`✅ Poll ${pollData.id} broadcasted to all clients`);
    });
    
    // 📊 STUDENT VOTES - UPDATE TEACHER DASHBOARD
    socket.on('vote', (voteData) => {
      console.log('📊 Vote received:', voteData);
      
      // Update poll data with proper vote counting
      if (activePolls.has(voteData.pollId)) {
        const poll = activePolls.get(voteData.pollId);
        
        // Initialize vote count for the option if it doesn't exist
        if (!poll.votes[voteData.option]) {
          poll.votes[voteData.option] = 0;
        }
        
        // Increment vote count
        poll.votes[voteData.option]++;
        
        // Track voter
        const studentInfo = connectedStudents.get(socket.id);
        if (studentInfo && !poll.voters.includes(socket.id)) {
          poll.voters.push(socket.id);
          poll.voterNames = poll.voterNames || [];
          poll.voterNames.push(studentInfo.name);
        }
        
        activePolls.set(voteData.pollId, poll);
        
        // Broadcast updated poll to all clients
        io.emit('pollUpdate', poll);
      }
      
      console.log(`✅ Vote update broadcasted for poll ${voteData.pollId}`);
    });
    
    // 🛑 TEACHER ENDS POLL
    socket.on('endPoll', (pollId) => {
      console.log('🛑 Ending poll:', pollId);
      
      // Mark poll as ended
      if (activePolls.has(pollId)) {
        const poll = activePolls.get(pollId);
        poll.ended = true;
        activePolls.set(pollId, poll);
      }
      
      // Broadcast poll ended to all clients
      io.emit('pollEnded', { pollId });
      
      console.log(`✅ Poll ${pollId} ended and broadcasted`);
    });

    // 🚫 TEACHER KICKS OUT STUDENT
    socket.on('kickStudent', (data) => {
      console.log('🚫 Kicking out student:', data.studentName);
      
      // Find student by name and kick them out
      const studentEntry = Array.from(connectedStudents.entries()).find(
        ([socketId, student]) => student.name === data.studentName
      );
      
      if (studentEntry) {
        const [studentSocketId, studentData] = studentEntry;
        
        // Send kick message to the specific student
        io.to(studentSocketId).emit('kicked');
        
        // Remove student from connected list
        connectedStudents.delete(studentSocketId);
        
        // Force disconnect the student
        const studentSocket = io.sockets.sockets.get(studentSocketId);
        if (studentSocket) {
          studentSocket.disconnect(true);
        }
        
        // Broadcast updated student list
        const studentList = Array.from(connectedStudents.values());
        io.emit('studentsUpdate', studentList);
        
        console.log(`✅ Student ${data.studentName} kicked out successfully`);
      }
    });

    // 💬 CHAT MESSAGE
    socket.on('chatMessage', (messageData) => {
      console.log('💬 Chat message received:', messageData);
      
      // Broadcast the message to all connected clients
      io.emit('chatMessage', messageData);
      
      console.log(`✅ Chat message broadcasted from ${messageData.sender}`);
    });
    
    // Handle user disconnect
    socket.on('disconnect', () => {
      console.log(`🔌 User disconnected: ${socket.id}`);
      
      // Remove student from list if they were a student
      if (connectedStudents.has(socket.id)) {
        const student = connectedStudents.get(socket.id);
        connectedStudents.delete(socket.id);
        console.log(`👋 Student ${student.name} left`);
        
        // Broadcast updated student list
        const studentList = Array.from(connectedStudents.values());
        io.emit('studentsUpdate', studentList);
      }
      
      // Clean up rooms
      Array.from(socket.rooms).forEach(room => {
        if (room !== socket.id && activeRooms.has(room)) {
          const roomUsers = activeRooms.get(room);
          roomUsers.delete(socket.id);
          if (roomUsers.size === 0) {
            activeRooms.delete(room);
          }
        }
      });
    });
  });
  
  console.log('🚀 Socket.IO chat handlers initialized');
};

module.exports = { initializeSocketHandlers };
