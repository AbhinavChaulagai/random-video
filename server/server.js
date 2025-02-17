const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    socket.on("offer", (offer) => {
        console.log("Received offer:", offer);
        socket.broadcast.emit("offer", offer);
    });

    socket.on("answer", (answer) => {
        console.log("Received answer:", answer);
        socket.broadcast.emit("answer", answer);
    });

    socket.on("ice-candidate", (candidate) => {
        console.log("Received ICE candidate:", candidate);
        socket.broadcast.emit("ice-candidate", candidate);
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
    });
});

server.listen(3000, () => {
    console.log("Server is running on port 3000");
});
