const socket = io();
let peerConnection;
let localStream;
let remoteStream;

// ICE server config will be fetched from Xirsys
let config = { iceServers: [] };

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const status = document.getElementById('status');

async function getXirsysIceServers() {
  try {
    const response = await fetch("https://global.xirsys.net/_turn/MyFirstApp", {
      method: "PUT",
      headers: {
        "Authorization": "Basic " + btoa("Adrift1:78085408-1dcd-11f0-a558-0242ac130003"),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ format: "urls" })
    });

    const data = await response.json();
    config.iceServers = data.v.iceServers;
    startStream();
  } catch (error) {
    console.error("Failed to get Xirsys ICE servers:", error);
    status.innerText = "TURN server error.";
  }
}

function startStream() {
  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
      localStream = stream;
      localVideo.srcObject = stream;
      socket.emit('joinRoom');
    })
    .catch(error => {
      console.error('🎥 Error accessing media devices:', error);
      status.innerText = 'Media access error.';
    });
}

socket.on('waiting', () => {
  status.innerText = 'Waiting for a partner...';
});

socket.on('matched', async ({ partnerId }) => {
  status.innerText = 'Matched with: ' + partnerId;
  createPeerConnection();
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('signal', { type: 'offer', offer });
});

socket.on('signal', async data => {
  if (data.type === 'offer') {
    createPeerConnection();
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('signal', { type: 'answer', answer });

  } else if (data.type === 'answer') {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));

  } else if (data.type === 'candidate') {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (e) {
      console.error('Error adding ICE candidate:', e);
    }
  }
});

socket.on('partnerDisconnected', () => {
  status.innerText = 'Your partner has left. Click "Next" to find another.';
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  remoteVideo.srcObject = null;
});

function createPeerConnection() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  peerConnection = new RTCPeerConnection(config);
  remoteStream = new MediaStream();
  remoteVideo.srcObject = remoteStream;

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit('signal', { type: 'candidate', candidate: event.candidate });
    }
  };

  peerConnection.ontrack = event => {
    remoteStream.addTrack(event.track);
  };
}

function connectNextUser() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  remoteVideo.srcObject = null;
  status.innerText = 'Connecting to a new user...';
  socket.emit('nextUser');
}

// Start the app by fetching ICE servers
getXirsysIceServers();
