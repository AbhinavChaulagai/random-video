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
let remoteStream;
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
        console.log('Got local stream:', stream); // Debugging
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
    console.log('Received offer:', offer); // Debugging
    if (!peerConnection || peerConnection.signalingState !== 'stable') {
        console.error('PeerConnection not ready for offer');
        return;
    }
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        console.log('Remote description set successfully.'); // Debugging
        const answer = await peerConnection.createAnswer();
        console.log('Created answer:', answer); // Debugging
        await peerConnection.setLocalDescription(answer);
        console.log('Local description set successfully.'); // Debugging
        socket.emit('answer', answer);
    } catch (error) {
        console.error('Error handling offer:', error);
    }
});

socket.on('answer', async (answer) => {
    console.log('Received answer:', answer); // Debugging
    if (!peerConnection || peerConnection.signalingState !== 'have-local-offer') {
        console.error('Invalid state for answer:', peerConnection?.signalingState);
        return;
    }
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log('Remote description set successfully.'); // Debugging
    } catch (error) {
        console.error('Error handling answer:', error);
    }
});

socket.on('candidate', async (candidate) => {
    console.log('Received ICE candidate:', candidate); // Debugging
    if (!peerConnection) {
        console.error('PeerConnection not initialized.');
        return;
    }
    try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('ICE candidate added successfully.'); // Debugging
    } catch (error) {
        console.error('Error adding ICE candidate:', error);
    }
});

// Create RTCPeerConnection
function createPeerConnection() {
    peerConnection = new RTCPeerConnection(servers);

    remoteStream = new MediaStream();
    remoteVideo.srcObject = remoteStream;

    localStream.getTracks().forEach(track => {
        console.log('Adding local track:', track); // Debugging
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
        console.log('Received remote track:', event.track); // Debugging
        if (!remoteVideo.srcObject) {
            remoteVideo.srcObject = new MediaStream();
        }
        remoteVideo.srcObject.addTrack(event.track);
        console.log('Remote video stream updated:', remoteVideo.srcObject); // Debugging
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log('Sending ICE candidate:', event.candidate); // Debugging
            socket.emit('candidate', event.candidate);
        }
    };

    peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', peerConnection.iceConnectionState); // Debugging
        if (peerConnection.iceConnectionState === 'failed') {
            console.error('ICE connection failed. Restarting...');
            restartPeerConnection();
        }
    };

    // Send an offer to the partner
    if (partnerId) {
        peerConnection.createOffer()
            .then(offer => {
                console.log('Created offer:', offer); // Debugging
                return peerConnection.setLocalDescription(offer);
            })
            .then(() => {
                console.log('Local description set successfully.'); // Debugging
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
