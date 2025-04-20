const socket = io();
let peerConnection;

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const status = document.getElementById('status');

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localVideo.srcObject = stream;

    socket.on('matched', async ({ partnerId }) => {
      status.innerText = 'Matched with: ' + partnerId;

      peerConnection = new RTCPeerConnection(config);
      stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

      peerConnection.onicecandidate = event => {
        if (event.candidate) {
          socket.emit('signal', { candidate: event.candidate });
        }
      };

      peerConnection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit('signal', { offer });
    });

    socket.on('signal', async data => {
      if (data.offer) {
        peerConnection = new RTCPeerConnection(config);
        stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

        peerConnection.onicecandidate = event => {
          if (event.candidate) {
            socket.emit('signal', { candidate: event.candidate });
          }
        };

        peerConnection.ontrack = event => {
          remoteVideo.srcObject = event.streams[0];
        };

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
      status.innerText = 'Your partner has left. Refresh to match again.';
      if (peerConnection) {
        peerConnection.close();
      }
    });

    socket.on('waiting', () => {
      status.innerText = 'Waiting for a partner...';
    });
  });
