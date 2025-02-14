const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const chatArea = document.getElementById('chat-area');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');

const socket = io();

let localStream;
let remoteStream;
let peerConnection;

const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        }
    ]
};

const constraints = {
    video: true,
    audio: true
};

// Get local media stream
navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
        localVideo.srcObject = stream;
        localStream = stream;
    })
    .catch(error => {
        console.error('Error accessing media devices.', error);
    });

// Handle signaling
socket.on('offer', async (offer) => {
    if (!peerConnection) {
        createPeerConnection();
    }
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', answer);
});

socket.on('answer', async (answer) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('candidate', async (candidate) => {
    try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
        console.error('Error adding received ice candidate', e);
    }
});
socket.on('chat message', (msg) => {
    console.log('Received message:', msg); // Debugging
    handleReceivedMessage(msg);
});
// Create RTCPeerConnection
function createPeerConnection() {
    peerConnection = new RTCPeerConnection(servers);

    remoteStream = new MediaStream();
    remoteVideo.srcObject = remoteStream;

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach(track => {
            remoteStream.addTrack(track);
        });
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('candidate', event.candidate);
        }
    };
}

// Clear existing event listeners to avoid duplication
socket.off('chat message'); // Remove any existing 'chat message' listeners

// Handle chat messages
function handleSendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        socket.emit('chat message', message);
        appendMessage(`You: ${message}`);
        messageInput.value = ''; // Clear the input field
    }
    
}

function handleReceivedMessage(msg) {
    appendMessage(`Stranger: ${msg}`);
}

// Add event listeners
sendButton.addEventListener('click', handleSendMessage);
socket.on('chat message', handleReceivedMessage); // Register listener only once

// Handle Enter key press in the message input field
messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault(); // Prevent default behavior (e.g., form submission)
        handleSendMessage(); // Trigger the send message function
    }
});

// Append message to chat area
function appendMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    chatArea.appendChild(messageElement);
    chatArea.scrollTop = chatArea.scrollHeight; // Auto-scroll to the latest message
}