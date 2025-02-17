const socket = io("wss://random-video-chat-i6qq.onrender.com", { transports: ["websocket"] });

let localStream;
let remoteStream;
let peerConnection;
const servers = {
    iceServers: [
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        {
            urls: 'turn:relay1.expressturn.com:3478',
            username: 'your-username',
            credential: 'your-password'
        }
    ]
};

async function startCall() {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById("localVideo").srcObject = localStream;

    peerConnection = new RTCPeerConnection(servers);
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("ice-candidate", event.candidate);
        }
    };
    
    peerConnection.ontrack = (event) => {
        if (!remoteStream) {
            remoteStream = new MediaStream();
            document.getElementById("remoteVideo").srcObject = remoteStream;
        }
        remoteStream.addTrack(event.track);
    };

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("offer", offer);
}

socket.on("offer", async (offer) => {
    if (!peerConnection) startCall();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("answer", answer);
});

socket.on("answer", async (answer) => {
    console.log("Received answer:", answer);
    if (peerConnection.signalingState !== "stable") {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } else {
        console.warn("Ignoring answer because signalingState is stable.");
    }
});

socket.on("ice-candidate", async (candidate) => {
    if (candidate && peerConnection) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
            console.error("Error adding ICE candidate:", e);
        }
    }
});
