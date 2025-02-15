const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const chatArea = document.getElementById('chat-area');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const startEndButton = document.getElementById('start-end-button');
const nextButton = document.getElementById('next-button');
const searchingScreen = document.getElementById('searching-screen');

const socket = io();

let localStream;
let remoteStream;
let peerConnection;
let partnerId = null;
let isSearching = false;

const servers = {
    iceServers: [
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
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
        console.error('Error accessing media devices:', error);
        alert('Please allow camera and microphone access.');
    });

// Handle Start/End button click
startEndButton.addEventListener('click', () => {
    if (isSearching) {
        // End search
        socket.emit('end-search');
        isSearching = false;
        startEndButton.textContent = 'Start';
        searchingScreen.style.display = 'none';
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        remoteVideo.srcObject = null;
        partnerId = null;
        appendMessage('You have ended the search.');
    } else {
        // Start search
        socket.emit('start-search');
        isSearching = true;
        startEndButton.textContent = 'End';
        searchingScreen.style.display = 'block';
        appendMessage('Searching for a stranger...');
    }
});

// Handle Next button click
nextButton.addEventListener('click', () => {
    if (partnerId) {
        socket.emit('next');
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        remoteVideo.srcObject = null;
        partnerId = null;
        appendMessage('You have disconnected from the stranger.');
    }
});

// Handle pairing with another user
socket.on('paired', (id) => {
    partnerId = id;
    console.log('Paired with:', partnerId);
    searchingScreen.style.display = 'none';
    createPeerConnection();
});

// Handle partner disconnection
socket.on('partner-disconnected', () => {
    console.log('Partner disconnected');
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    remoteVideo.srcObject = null;
    partnerId = null;
    appendMessage('Stranger has disconnected.');
});

// Handle chat messages
socket.on('chat-message', (msg) => {
    appendMessage(`Stranger: ${msg}`);
});

// Handle WebRTC signaling
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

    // Send an offer to the partner
    if (partnerId) {
        peerConnection.createOffer()
            .then(offer => peerConnection.setLocalDescription(offer))
            .then(() => {
                socket.emit('offer', peerConnection.localDescription);
            });
    }
}

// Handle chat messages
sendButton.addEventListener('click', () => {
    const message = messageInput.value.trim();
    if (message) {
        socket.emit('chat-message', message);
        appendMessage(`You: ${message}`);
        messageInput.value = '';
    }
});

// Handle Enter key press
messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        sendButton.click();
    }
});

// Append message to chat area
function appendMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    chatArea.appendChild(messageElement);
    chatArea.scrollTop = chatArea.scrollHeight;
}
