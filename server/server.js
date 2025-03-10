const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let waitingQueue = [];
let activePairs = new Map();

io.on('connection', (socket) => {
    console.log('a user connected:', socket.id);

    socket.on('start-search', () => {
        waitingQueue.push(socket.id);
        pairUsers();
    });

    socket.on('end-search', () => {
        waitingQueue = waitingQueue.filter(id => id !== socket.id);
        const partnerId = activePairs.get(socket.id);
        if (partnerId) {
            io.to(partnerId).emit('partner-disconnected');
            activePairs.delete(socket.id);
            activePairs.delete(partnerId);
        }
    });

    socket.on('next', () => {
        const partnerId = activePairs.get(socket.id);
        if (partnerId) {
            io.to(partnerId).emit('partner-disconnected');
            activePairs.delete(socket.id);
            activePairs.delete(partnerId);
            waitingQueue.push(socket.id);
            pairUsers();
        }
    });

    socket.on('chat-message', (msg) => {
        const partnerId = activePairs.get(socket.id);
        if (partnerId) {
            io.to(partnerId).emit('chat-message', msg);
        }
    });

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

    socket.on('disconnect', () => {
        console.log('user disconnected:', socket.id);
        const partnerId = activePairs.get(socket.id);
        if (partnerId) {
            io.to(partnerId).emit('partner-disconnected');
            activePairs.delete(socket.id);
            activePairs.delete(partnerId);
        }
        waitingQueue = waitingQueue.filter(id => id !== socket.id);
    });
});

function pairUsers() {
    while (waitingQueue.length >= 2) {
        const user1 = waitingQueue.shift();
        const user2 = waitingQueue.shift();
        activePairs.set(user1, user2);
        activePairs.set(user2, user1);
        io.to(user1).emit('paired', user2);
        io.to(user2).emit('paired', user1);
    }
}

server.listen(3000, () => {
    console.log('Server is running on port 3000');
});
