const socket = io();
let peerConnection;
let localStream;

const config = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:relay.metered.ca:80', // Optional TURN server
      username: 'openai',
      credential: 'openai'
    }
  ]
};

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const status = document.getElementById('status');

// Get user camera and mic
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localStream = stream;
    localVideo.srcObject = stream;

    socket.emit('joinRoom');

    socket.on('waiting', () => {
      status.innerText = 'Waiting for a partner...';
    });

    socket.on('matched', async ({ partnerId }) => {
      status.innerText = 'Matched with a partner!';
      setupPeerConnection();
      localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit('signal', { offer });
    });

    socket.on('signal', async data => {
      if (data.offer) {
        setupPeerConnection();
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', { answer });
      }

      if (data.answer && peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      }

      if (data.candidate && peerConnection) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error('Error adding ICE candidate', e);
        }
      }
    });

    socket.on('partnerDisconnected', () => {
      status.innerText = 'Partner left. Click "Next" to find a new one.';
      if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
      }
      remoteVideo.srcObject = null;
    });

  })
  .catch(error => {
    console.error('Error accessing media devices:', error);
    alert("Please allow access to camera and microphone.");
  });

// Setup PeerConnection
function setupPeerConnection() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  peerConnection = new RTCPeerConnection(config);

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit('signal', { candidate: event.candidate });
    }
  };

  peerConnection.ontrack = event => {
    remoteVideo.srcObject = event.streams[0];
  };
}

// Next button logic
function connectNextUser() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  remoteVideo.srcObject = null;
  status.innerText = 'Connecting to a new user...';
  socket.emit('nextUser');
}
