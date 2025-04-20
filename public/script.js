const socket = io();
let peerConnection;
let localStream;

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const status = document.getElementById('status');

// Get user media
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

      // Must add tracks BEFORE creating offer
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit('signal', { offer });
    });

    socket.on('signal', async data => {
      if (data.offer) {
        setupPeerConnection();

        localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStream);
        });

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
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      }
    });

    socket.on('partnerDisconnected', () => {
      status.innerText = 'Partner disconnected. Click "Next" to connect again.';
      if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
      }
      remoteVideo.srcObject = null;
    });
  })
  .catch(err => {
    console.error('Media device error:', err);
    alert('Please allow camera and mic permission.');
  });

function setupPeerConnection() {
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
    console.log('Received remote stream');
    // Multiple tracks may come, check for existing stream
    if (!remoteVideo.srcObject) {
      remoteVideo.srcObject = event.streams[0];
    }
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
