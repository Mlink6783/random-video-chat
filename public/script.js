const socket = io();
let peerConnection;
let localStream;

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const status = document.getElementById('status');

// Get media
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localStream = stream;
    localVideo.srcObject = stream;
    socket.emit('joinRoom');
  })
  .catch(err => {
    alert('Allow camera and mic!');
    console.error(err);
  });

socket.on('waiting', () => {
  status.innerText = 'Waiting for a partner...';
});

socket.on('matched', async ({ partnerId }) => {
  status.innerText = 'Matched!';
  createPeer();

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('signal', { offer });
});

socket.on('signal', async data => {
  if (data.offer) {
    createPeer();
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
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
  status.innerText = 'Partner left. Click Next to find someone new.';
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  remoteVideo.srcObject = null;
});

function createPeer() {
  if (peerConnection) {
    peerConnection.close();
  }

  peerConnection = new RTCPeerConnection(config);

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit('signal', { candidate: event.candidate });
    }
  };

  peerConnection.ontrack = event => {
    console.log('Remote track received');
    remoteVideo.srcObject = event.streams[0];
  };
}

function connectNextUser() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  remoteVideo.srcObject = null;
  status.innerText = 'Searching for next user...';
  socket.emit('nextUser');
}
