const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let waitingQueue = []; // Queue to hold waiting users
let activePairs = new Map(); // Map to track active pairs of users

io.on('connection', (socket) => {
    console.log('a user connected:', socket.id);

    // Add the new user to the waiting queue
    waitingQueue.push(socket.id);

    // Try to pair users
    pairUsers();

    // Handle chat messages
    socket.on('chat message', (msg) => {
        const partnerId = activePairs.get(socket.id);
        if (partnerId) {
            io.to(partnerId).emit('chat message', msg);
        }
    });

    // Handle WebRTC signaling
    socket.on('offer', (offer) => {
        const partnerId = activePairs.get(socket.id);
        if (partnerId) {
            io.to(partnerId).emit('offer', offer);
        }
    });

    socket.on('answer', (answer) => {
        const partnerId = activePairs.get(socket.id);
        if (partnerId) {
            io.to(partnerId).emit('answer', answer);
        }
    });

    socket.on('candidate', (candidate) => {
        const partnerId = activePairs.get(socket.id);
        if (partnerId) {
            io.to(partnerId).emit('candidate', candidate);
        }
    });

    // Handle "Next" button
    socket.on('next', () => {
        const partnerId = activePairs.get(socket.id);
        if (partnerId) {
            // Notify the partner that the user has disconnected
            io.to(partnerId).emit('partner disconnected');
            // Remove the pair from activePairs
            activePairs.delete(socket.id);
            activePairs.delete(partnerId);
            // Add both users back to the waiting queue
            waitingQueue.push(socket.id, partnerId);
            // Try to pair users again
            pairUsers();
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('user disconnected:', socket.id);
        const partnerId = activePairs.get(socket.id);
        if (partnerId) {
            // Notify the partner that the user has disconnected
            io.to(partnerId).emit('partner disconnected');
            // Remove the pair from activePairs
            activePairs.delete(socket.id);
            activePairs.delete(partnerId);
        }
        // Remove the user from the waiting queue
        waitingQueue = waitingQueue.filter(id => id !== socket.id);
    });
});

// Function to pair users
function pairUsers() {
    while (waitingQueue.length >= 2) {
        const user1 = waitingQueue.shift();
        const user2 = waitingQueue.shift();

        // Pair the users
        activePairs.set(user1, user2);
        activePairs.set(user2, user1);

        // Notify both users that they are paired
        io.to(user1).emit('paired', user2);
        io.to(user2).emit('paired', user1);
    }
}

server.listen(3000, () => {
    console.log('Server is running on port 3000');
});
