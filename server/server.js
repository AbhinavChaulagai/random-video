const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: "*" })); // Allow all origins

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ["websocket", "polling"],
    allowEIO3: true // Support older clients
});

app.get("/", (req, res) => {
    res.send("WebRTC signaling server is running.");
});

// Handle favicon.ico requests to prevent errors
app.get("/favicon.ico", (req, res) => res.status(204));

io.on("connection", (socket) => {
    console.log(`New client connected: ${socket.id}`);

    socket.on("offer", (offer) => {
        console.log(`Received offer from ${socket.id}`);
        socket.broadcast.emit("offer", offer);
    });

    socket.on("answer", (answer) => {
        console.log(`Received answer from ${socket.id}`);
        socket.broadcast.emit("answer", answer);
    });

    socket.on("ice-candidate", (candidate) => {
        console.log(`Received ICE candidate from ${socket.id}`);
        socket.broadcast.emit("ice-candidate", candidate);
    });

    socket.on("disconnect", () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 10000; // Render assigns dynamic ports
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
