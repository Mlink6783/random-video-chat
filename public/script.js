const socket = io();
let peerConnection;
let localStream;

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const status = document.getElementById('status');

// Xirsys ICE servers
const config = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302"
    },
    {
      urls: "turn:turn.xirsys.com:3478?transport=udp",
      username: "Adrift1",
      credential: "78085408-1dcd-11f0-a558-0242ac130003"
    },
    {
      urls: "turn:turn.xirsys.com:3478?transport=tcp",
      username: "Adrift1",
      credential: "78085408-1dcd-11f0-a558-0242ac130003"
    }
  ]
};

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localStream = stream;
    localVideo.srcObject = stream;

    socket.emit('joinRoom');

    socket.on('waiting', () => {
      status.innerText = 'Waiting for a partner...';
    });

    socket.on('matched', async ({ partnerId }) => {
      status.innerText = 'Matched with: ' + partnerId;
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

      if (data.answer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      }

      if (data.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });

    socket.on('partnerDisconnected', () => {
      status.innerText = 'Your partner has left. Click "Next" to find a new one.';
      if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
      }
      remoteVideo.srcObject = null;
    });
  })
  .catch(error => {
    console.error('Error accessing media devices:', error);
  });

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

function connectNextUser() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  remoteVideo.srcObject = null;
  status.innerText = 'Connecting to a new user...';

  socket.emit('nextUser');
}
