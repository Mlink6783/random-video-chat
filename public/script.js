const socket = io();
let peerConnection;
let localStream;
let remoteStream;

const config = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    window.onload = function() {
         let xhr = new XMLHttpRequest();
         xhr.onreadystatechange = function($evt){
            if(xhr.readyState == 4 && xhr.status == 200){
                let res = JSON.parse(xhr.responseText);
                console.log("response: ",res);
            }
         }
         xhr.open("PUT", "https://global.xirsys.net/_turn/MyFirstApp", true);
         xhr.setRequestHeader ("Authorization": "Basic " + btoa("Adrift1:78085408-1dcd-11f0-a558-0242ac130003") );
         xhr.setRequestHeader ("Content-Type": "application/json");
         xhr.send( JSON.stringify({"format": "urls"}) );
      }:
  ]
};

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const status = document.getElementById('status');

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
