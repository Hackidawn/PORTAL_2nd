// VideoMeet.jsx

import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import {
  IconButton, TextField, Button, Badge
} from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import CallEndIcon from '@mui/icons-material/CallEnd';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import ChatIcon from '@mui/icons-material/Chat';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import server from '../environment';

// Socket server URLs
const server_url = server;
const micGestureSocketURL = 'http://localhost:5001';
const screenGestureSocketURL = 'http://localhost:5002'; // Pinky Gesture
const screenshotGestureSocketURL = 'http://localhost:5003';
const recordingGestureSocketURL = 'http://localhost:5004';
const okSignGestureSocketURL = 'http://localhost:5005'; // OK Sign Gesture

const peerConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// Global variables
let connections = {};
let isOfferCreated = {};
let userNames = {};

export default function VideoMeetComponent() {
  const socketRef = useRef();
  const socketIdRef = useRef();
  const localVideoref = useRef();
  const micGestureSocketRef = useRef();
  const screenGestureSocketRef = useRef();
  const screenshotGestureSocketRef = useRef();
  const recordingGestureSocketRef = useRef();
  const okSignGestureSocketRef = useRef(); // 🆕 for OK sign
  const canvasRef = useRef();
  const recordedChunksRef = useRef([]);

  // Local State
  const [video, setVideo] = useState(true);
  const [audio, setAudio] = useState(true);
  const [screen, setScreen] = useState(false);
  const [screenAvailable, setScreenAvailable] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [newMessages, setNewMessages] = useState(0);
  const [askForUsername, setAskForUsername] = useState(true);
  const [username, setUsername] = useState('');
  const [videos, setVideos] = useState([]);
  const [previewStream, setPreviewStream] = useState(null);
  const [shouldStartScreenShare, setShouldStartScreenShare] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recorder, setRecorder] = useState(null);
  const [capturedMoments, setCapturedMoments] = useState([]);
  const [showMoments, setShowMoments] = useState(false);
  const [showHeart, setShowHeart] = useState(false);

  useEffect(() => {
    if (navigator.mediaDevices.getDisplayMedia) {
      setScreenAvailable(true);
    }
    requestPreviewStream();
  }, []);

  useEffect(() => {
    if (!askForUsername && window.localStream) {
      // Connecting all gesture servers
      micGestureSocketRef.current = io(micGestureSocketURL);
      screenGestureSocketRef.current = io(screenGestureSocketURL);
      screenshotGestureSocketRef.current = io(screenshotGestureSocketURL);
      recordingGestureSocketRef.current = io(recordingGestureSocketURL);
      okSignGestureSocketRef.current = io(okSignGestureSocketURL);

      // Mic Gesture
      micGestureSocketRef.current.on('mic-status', (data) => {
        const audioTrack = window.localStream.getAudioTracks()[0];
        if (audioTrack) audioTrack.enabled = data.status === 'on';
        setAudio(data.status === 'on');
      });

      // Pinky Gesture
      screenGestureSocketRef.current.on('pinky-reaction', () => {
        setShowHeart(true);
        setTimeout(() => setShowHeart(false), 2000);
      });

      // Screenshot Gesture
      screenshotGestureSocketRef.current.on('take-screenshot', captureScreenshot);

      // Recording Gesture
      recordingGestureSocketRef.current.on('start-recording', startRecording);
      recordingGestureSocketRef.current.on('stop-recording', stopRecording);

      // OK Sign Gesture
      okSignGestureSocketRef.current.on('ok-sign-detected', () => {
        const caption = prompt('👌 OK Sign detected! Enter a caption:', '');
        if (caption && caption.trim() !== "") {
          const timestamp = new Date().toLocaleTimeString();
          setCapturedMoments(prev => [...prev, { timestamp, caption }]);
        }
      });

      // Send frames periodically
      const interval = setInterval(sendFrameToServers, 400);

      return () => {
        clearInterval(interval);
        micGestureSocketRef.current.disconnect();
        screenGestureSocketRef.current.disconnect();
        screenshotGestureSocketRef.current.disconnect();
        recordingGestureSocketRef.current.disconnect();
        okSignGestureSocketRef.current.disconnect();
      };
    }
  }, [askForUsername]);

  useEffect(() => {
    if (shouldStartScreenShare) {
      handleScreen();
      setShouldStartScreenShare(false);
    }
  }, [shouldStartScreenShare]);

  const requestPreviewStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { frameRate: { ideal: 15, max: 30 } },
        audio: true,
      });
      setPreviewStream(stream);
    } catch (e) {
      console.error('Preview permission denied', e);
    }
  };

  const sendFrameToServers = () => {
    if (!localVideoref.current || !canvasRef.current) return;
    const video = localVideoref.current;
    const canvas = canvasRef.current;
    if (!video.videoWidth || !video.videoHeight) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL('image/jpeg', 0.7);

    // Send frame to all gesture servers
    micGestureSocketRef.current?.emit('frame', { image: imageData });
    screenGestureSocketRef.current?.emit('frame', { image: imageData });
    screenshotGestureSocketRef.current?.emit('frame', { image: imageData });
    recordingGestureSocketRef.current?.emit('frame', { image: imageData });
    okSignGestureSocketRef.current?.emit('frame', { image: imageData });
  };

  const captureScreenshot = () => {
    const canvas = document.createElement('canvas');
    const video = localVideoref.current;
    if (!video) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `screenshot_${Date.now()}.png`;
    link.click();
  };

  const startRecording = () => {
    const stream = localVideoref.current?.srcObject;
    if (!stream) return;

    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp8' });
    recordedChunksRef.current = [];

    mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recording_${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    mediaRecorder.start();
    setRecorder(mediaRecorder);
    setIsRecording(true);
  };

  const stopRecording = () => {
    recorder?.stop();
    setIsRecording(false);
    setRecorder(null);
  };

  const handleScreen = async () => {
    if (!screenAvailable) return;
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      localVideoref.current.srcObject = displayStream;
      window.localStream = displayStream;
      setScreen(true);

      displayStream.getVideoTracks()[0].onended = async () => {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        window.localStream = camStream;
        localVideoref.current.srcObject = camStream;
        setScreen(false);
      };
    } catch (error) {
      console.error('Screen share error:', error);
    }
  };

  const handleJoinClick = () => {
    if (!previewStream) return;
    window.localStream = previewStream;
    setVideos([{ socketId: 'local', stream: window.localStream, name: username }]);
    if (localVideoref.current) localVideoref.current.srcObject = window.localStream;
    setAskForUsername(false);
    connectToSocketServer();
  };

  const handleVideo = () => {
    setVideo(prev => {
      if (window.localStream) {
        window.localStream.getVideoTracks()[0].enabled = !prev;
      }
      return !prev;
    });
  };

  const handleAudio = () => {
    setAudio(prev => {
      if (window.localStream) {
        window.localStream.getAudioTracks()[0].enabled = !prev;
      }
      return !prev;
    });
  };

  const handleEndCall = () => {
    window.localStream?.getTracks().forEach(track => track.stop());
    Object.values(connections).forEach(peer => peer.close());
    socketRef.current?.disconnect();
    window.location.href = '/';
  };

  const connectToSocketServer = () => {
    socketRef.current = io(server_url);

    socketRef.current.on('connect', () => {
      socketIdRef.current = socketRef.current.id;
      socketRef.current.emit('join-call', window.location.href, username);
    });

    socketRef.current.on('user-left', id => {
      delete connections[id];
      setVideos(prev => prev.filter(v => v.socketId !== id));
    });

    socketRef.current.on('chat-message', (data, sender, senderId) => {
      setMessages(prev => [...prev, { sender, data }]);
      if (senderId !== socketIdRef.current) {
        setNewMessages(prev => prev + 1);
      }
    });

    socketRef.current.on('user-joined', (id, clients, nameMap = {}) => {
      userNames = nameMap || {};

      clients.forEach(clientId => {
        if (connections[clientId]) return;
        
        const peer = new RTCPeerConnection(peerConfig);
        connections[clientId] = peer;

        peer.onicecandidate = event => {
          if (event.candidate) {
            socketRef.current.emit('signal', clientId, JSON.stringify({ ice: event.candidate }));
          }
        };

        peer.ontrack = event => {
          setVideos(prev => {
            if (prev.some(v => v.socketId === clientId)) return prev;
            return [...prev, { socketId: clientId, stream: event.streams[0], name: userNames[clientId] || 'Guest' }];
          });
        };

        window.localStream.getTracks().forEach(track => peer.addTrack(track, window.localStream));
      });

      if (id === socketIdRef.current) {
        clients.forEach(clientId => {
          if (clientId !== socketIdRef.current && !isOfferCreated[clientId]) {
            isOfferCreated[clientId] = true;
            const peer = connections[clientId];
            peer.createOffer()
              .then(offer => peer.setLocalDescription(offer))
              .then(() => socketRef.current.emit('signal', clientId, JSON.stringify({ sdp: peer.localDescription })));
          }
        });
      }
    });

    socketRef.current.on('signal', async (fromId, message) => {
      const peer = connections[fromId];
      if (!peer) return;
      const data = JSON.parse(message);

      if (data.sdp) {
        await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
        if (data.sdp.type === 'offer') {
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          socketRef.current.emit('signal', fromId, JSON.stringify({ sdp: peer.localDescription }));
        }
      } else if (data.ice) {
        await peer.addIceCandidate(new RTCIceCandidate(data.ice));
      }
    });
  };

  const sendMessage = () => {
    if (message.trim()) {
      socketRef.current.emit('chat-message', message, username);
      setMessages(prev => [...prev, { sender: username, data: message }]);
      setMessage('');
    }
  };

  return (
    <div style={{ height: '100vh', width: '100vw', backgroundColor: '#202124', color: 'white', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      
      {/* ❤️ Floating Heart Animation */}
      {showHeart && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '5rem',
          animation: 'floatHeart 2s ease-out forwards',
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          ❤️
        </div>
      )}
  
      {/* 🖌️ Floating Animation CSS */}
      <style>{`
        @keyframes floatHeart {
          0% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -150%) scale(2);
            opacity: 0;
          }
        }
      `}</style>
  
      {/* 🎥 Hidden canvas for frame sending */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
  
      {/* 🔴 Recording Indicator */}
      {isRecording && (
        <div style={{ position: 'absolute', top: '10px', right: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: 'red' }}>
          <FiberManualRecordIcon /> Recording
        </div>
      )}
  
      {/* 🛬 Pre-join screen */}
      {askForUsername ? (
        <div style={{ margin: 'auto', textAlign: 'center', padding: '40px' }}>
          <h2>Join Meeting</h2>
          {previewStream ? (
            <video
              ref={ref => ref && (ref.srcObject = previewStream)}
              autoPlay
              muted
              playsInline
              style={{ width: '360px', height: '270px', backgroundColor: 'black', borderRadius: '12px' }}
            />
          ) : (
            <p>Waiting for camera access...</p>
          )}
  
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <IconButton onClick={handleVideo} style={{ color: 'white' }}>
              {video ? <VideocamIcon /> : <VideocamOffIcon />}
            </IconButton>
            <IconButton onClick={handleAudio} style={{ color: 'white' }}>
              {audio ? <MicIcon /> : <MicOffIcon />}
            </IconButton>
          </div>
  
          <TextField
            label="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            InputProps={{ style: { color: 'white' } }}
            InputLabelProps={{ style: { color: '#aaa' } }}
            style={{ marginTop: '1rem', backgroundColor: '#303134', borderRadius: '8px' }}
            fullWidth
          />
  
          <Button onClick={handleJoinClick} disabled={!username} variant="contained" style={{ marginTop: '1.5rem' }}>
            Join Now
          </Button>
        </div>
      ) : (
        <>
          {/* 🖥️ Video Grid */}
          {videos.length === 1 ? (
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
              <div style={{
                width: '80%',
                maxWidth: '960px',
                aspectRatio: '16/9',
                backgroundColor: '#1f1f1f',
                borderRadius: '12px',
                overflow: 'hidden',
                position: 'relative',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
              }}>
                <video
                  ref={ref => {
                    if (ref && videos[0].stream) {
                      ref.srcObject = videos[0].stream;
                      if (videos[0].socketId === 'local') localVideoref.current = ref;
                    }
                  }}
                  autoPlay
                  playsInline
                  muted={videos[0].socketId === 'local'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div style={{
                  position: 'absolute',
                  bottom: '10px',
                  left: '10px',
                  background: 'rgba(0,0,0,0.6)',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '0.9rem'
                }}>
                  {videos[0].name || 'You'}
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              flex: 1,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px',
              padding: '20px'
            }}>
              {videos.map(video => (
                <div key={video.socketId} style={{
                  width: '100%',
                  aspectRatio: '16/9',
                  backgroundColor: '#1f1f1f',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  position: 'relative',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                }}>
                  {video.stream ? (
                    <video
                      ref={ref => {
                        if (ref && video.stream) {
                          ref.srcObject = video.stream;
                          if (video.socketId === 'local') localVideoref.current = ref;
                        }
                      }}
                      autoPlay
                      playsInline
                      muted={video.socketId === 'local'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      color: 'white',
                      fontSize: '2rem',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%'
                    }}>
                      {video.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  <div style={{
                    position: 'absolute',
                    bottom: '8px',
                    left: '8px',
                    background: 'rgba(0,0,0,0.6)',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '0.8rem'
                  }}>
                    {video.name || 'Guest'}
                  </div>
                </div>
              ))}
            </div>
          )}
  
          {/* 🎛️ Control Bar */}
          <div style={{
            backgroundColor: '#303134',
            padding: '10px 0',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '30px',
            borderTop: '1px solid #444'
          }}>
            <IconButton onClick={handleVideo} style={{ color: 'white' }}>
              {video ? <VideocamIcon /> : <VideocamOffIcon />}
            </IconButton>
            <IconButton onClick={handleAudio} style={{ color: 'white' }}>
              {audio ? <MicIcon /> : <MicOffIcon />}
            </IconButton>
            <IconButton onClick={handleEndCall} style={{ color: 'red' }}>
              <CallEndIcon />
            </IconButton>
            {screenAvailable && (
              <IconButton onClick={handleScreen} style={{ color: 'white' }}>
                {screen ? <StopScreenShareIcon /> : <ScreenShareIcon />}
              </IconButton>
            )}
            <Badge badgeContent={newMessages} color="error">
              <IconButton onClick={() => setShowChat(prev => !prev)} style={{ color: 'white' }}>
                <ChatIcon />
              </IconButton>
            </Badge>
            <IconButton onClick={() => setShowMoments(prev => !prev)} style={{ color: 'gold' }}>
              <EmojiEventsIcon />
            </IconButton>
          </div>
  
          {/* 💬 Chat Sidebar */}
          {showChat && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: 0,
              height: '100%',
              width: '300px',
              backgroundColor: '#1f1f1f',
              borderLeft: '1px solid #333',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                {messages.map((msg, idx) => (
                  <div key={idx} style={{ marginBottom: '10px' }}>
                    <strong>{msg.sender}:</strong> {msg.data}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', padding: '10px' }}>
                <input
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Type a message..."
                  style={{
                    flex: 1,
                    backgroundColor: '#303134',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px'
                  }}
                />
                <Button onClick={sendMessage} variant="contained" style={{ marginLeft: '10px' }}>
                  Send
                </Button>
              </div>
            </div>
          )}
  
          {/* 🏆 Captured Moments Panel */}
          {showMoments && capturedMoments.length > 0 && (
            <div style={{
              position: 'absolute',
              top: 10,
              left: 10,
              backgroundColor: 'rgba(0,0,0,0.7)',
              padding: '10px',
              borderRadius: '8px',
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              <h4>Captured Moments 🖖</h4>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {capturedMoments.map((moment, idx) => (
                  <li key={idx}>
                    <strong>{moment.timestamp}</strong>: {moment.caption}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}  