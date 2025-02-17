const socket = io("wss://random-video-chat-i6qq.onrender.com", {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000
});

let localStream;
let remoteStream;
let peerConnection;

const servers = {
    iceServers: [
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        {
            urls: "turn:relay1.expressturn.com:3478",
            username: "your-username",
            credential: "your-password"
        }
    ]
};

// Start WebRTC Call
async function startCall() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById("localVideo").srcObject = localStream;

        peerConnection = new RTCPeerConnection(servers);

        // Send ICE candidates to signaling server
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("ice-candidate", event.candidate);
            }
        };

        // Handle remote stream
        peerConnection.ontrack = (event) => {
            if (!remoteStream) {
                remoteStream = new MediaStream();
                document.getElementById("remoteVideo").srcObject = remoteStream;
            }
            remoteStream.addTrack(event.track);
        };

        // Add local tracks
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        // Create and send offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit("offer", offer);
    } catch (error) {
        console.error("❌ Error starting call:", error);
    }
}

// Handle received offer
socket.on("offer", async (offer) => {
    if (!peerConnection) startCall();

    if (peerConnection.signalingState !== "stable") {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit("answer", answer);
    } else {
        console.warn("⚠️ Offer ignored. Connection already stable.");
    }
});

// Handle received answer
socket.on("answer", async (answer) => {
    if (peerConnection.signalingState === "have-local-offer") {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } else {
        console.warn("⚠️ Answer ignored. Incorrect signaling state.");
    }
});

// Handle ICE candidates
socket.on("ice-candidate", async (candidate) => {
    if (peerConnection) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
            console.error("❌ Error adding ICE candidate:", e);
        }
    }
});

// Handle WebSocket connection errors
socket.on("connect_error", (error) => {
    console.error("❌ WebSocket connection error:", error);
});

socket.on("reconnect_attempt", (attemptNumber) => {
    console.warn(`🔄 Reconnecting... Attempt ${attemptNumber}`);
});
