const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const chatArea = document.getElementById('chat-area');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const startButton = document.getElementById('start-button');
const endButton = document.getElementById('end-button');
const nextButton = document.getElementById('next-button');
const statusMessage = document.getElementById('status-message');
const statusText = document.getElementById('status-text');

const socket = io();

let localStream;
let peerConnection;
let partnerId = null;

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
        console.log('Got local stream:', stream);
        localVideo.srcObject = stream;
        localStream = stream;
    })
    .catch(error => {
        console.error('Error accessing media devices:', error);
        alert('Please allow camera and microphone access.');
    });

// Handle Start button click
startButton.addEventListener('click', () => {
    startButton.classList.add('hidden');
    endButton.classList.remove('hidden');
    nextButton.classList.remove('hidden');
    statusMessage.classList.remove('hidden');
    statusText.textContent = 'Searching for a stranger...';
    socket.emit('start-search');
});

// Handle End button click
endButton.addEventListener('click', () => {
    resetUI();
    socket.emit('end-search');
});

// Handle Next button click
nextButton.addEventListener('click', () => {
    resetUI();
    socket.emit('next');
});

// Handle pairing with another user
socket.on('paired', (id) => {
    partnerId = id;
    statusText.textContent = 'Found a stranger!';
    createPeerConnection();
});

// Handle partner disconnection
socket.on('partner-disconnected', () => {
    statusText.textContent = 'Stranger has disconnected.';
    resetUI();
});

// Handle chat messages
socket.on('chat-message', (msg) => {
    appendMessage(`Stranger: ${msg}`);
});

// Handle WebRTC signaling
socket.on('offer', async (offer) => {
    console.log('Received offer:', offer);
    if (!peerConnection) {
        createPeerConnection();
    }
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    console.log('Sending answer:', answer);
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', answer);
});

socket.on('answer', async (answer) => {
    console.log('Received answer:', answer);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('candidate', async (candidate) => {
    console.log('Received ICE candidate:', candidate);
    try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
        console.error('Error adding received ice candidate', e);
    }
});

// Create RTCPeerConnection
function createPeerConnection() {
    peerConnection = new RTCPeerConnection(servers);

    // Add local stream tracks
    localStream.getTracks().forEach(track => {
        console.log('Adding local track:', track);
        peerConnection.addTrack(track, localStream);
    });

    // Handle remote stream
    peerConnection.ontrack = (event) => {
        console.log('Received remote track:', event.track);
        if (!remoteVideo.srcObject) {
            remoteVideo.srcObject = new MediaStream();
        }
        remoteVideo.srcObject.addTrack(event.track);
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log('Sending ICE candidate:', event.candidate);
            socket.emit('candidate', event.candidate);
        }
    };

    // Handle ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', peerConnection.iceConnectionState);
        if (peerConnection.iceConnectionState === 'failed') {
            console.error('ICE connection failed. Restarting...');
            restartPeerConnection();
        }
    };

    // Send an offer to the partner
    if (partnerId) {
        peerConnection.createOffer()
            .then(offer => {
                console.log('Sending offer:', offer);
                return peerConnection.setLocalDescription(offer);
            })
            .then(() => {
                socket.emit('offer', peerConnection.localDescription);
            })
            .catch(error => {
                console.error('Error creating offer:', error);
            });
    }
}

// Restart PeerConnection
function restartPeerConnection() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    createPeerConnection();
}

// Reset UI
function resetUI() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    remoteVideo.srcObject = null;
    partnerId = null;
    startButton.classList.remove('hidden');
    endButton.classList.add('hidden');
    nextButton.classList.add('hidden');
    statusMessage.classList.add('hidden');
    appendMessage('You have disconnected.');
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
