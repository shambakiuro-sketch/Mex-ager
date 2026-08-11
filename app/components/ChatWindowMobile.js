'use client';

import { useState, useEffect, useRef } from 'react';
import { database } from '../lib/firebase';
import { ref, onValue, push, set, update } from 'firebase/database';

export default function ChatWindowMobile({ selectedUser, currentUser, darkMode, onMessageNotification }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState(null);
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [waveformData, setWaveformData] = useState([]);
  
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const streamRef = useRef(null);
  const micButtonRef = useRef(null);
  const lastNotifiedRef = useRef(null);

  const getChatId = (uid1, uid2) => {
    const ids = [uid1, uid2].sort();
    return `chats/${ids.join('_')}`;
  };

  const chatId = getChatId(currentUser.uid, selectedUser.uid);

  // Function to detect and linkify URLs
  const linkifyText = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'inherit',
              textDecoration: 'underline',
              cursor: 'pointer',
              wordBreak: 'break-all'
            }}
            title={part}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const messagesRef = ref(database, `${chatId}/messages`);
    onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const messageList = Object.entries(data).map(([id, msg]) => ({
          id,
          ...msg
        }));
        setMessages(messageList);
        
        // Send notification for new messages from other user
        const lastMessage = messageList[messageList.length - 1];
        if (lastMessage && lastMessage.sender !== currentUser.uid && lastMessage.id !== lastNotifiedRef.current) {
          lastNotifiedRef.current = lastMessage.id;
          if (onMessageNotification) {
            const messageText = lastMessage.type === 'voice' ? '🎤 Voice message' : lastMessage.text;
            onMessageNotification(lastMessage.senderName || selectedUser.displayName, messageText, lastMessage.sender);
          }
        }
        
        // Mark messages as read
        messageList.forEach((msg) => {
          if (msg.sender !== currentUser.uid && !msg.read) {
            const msgRef = ref(database, `${chatId}/messages/${msg.id}`);
            update(msgRef, { read: true });
          }
        });
        
        scrollToBottom();
      }
    });

    // Listen for typing status
    const typingRef = ref(database, `${chatId}/typing/${selectedUser.uid}`);
    onValue(typingRef, (snapshot) => {
      setIsTyping(snapshot.val() || false);
    });
  }, [chatId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleMessageChange = (e) => {
    setNewMessage(e.target.value);

    // Update typing status
    const typingRef = ref(database, `${chatId}/typing/${currentUser.uid}`);
    set(typingRef, true);

    if (typingTimeout) clearTimeout(typingTimeout);

    const newTimeout = setTimeout(() => {
      set(typingRef, false);
    }, 1000);

    setTypingTimeout(newTimeout);
  };

  // Voice recording state and helpers
  const [recordingMimeType, setRecordingMimeType] = useState('audio/webm');
  const recordingPointerRef = useRef(null);
  const recordingStartYRef = useRef(null);
  const audioContextRef = useRef(null);
  const animationFrameRef = useRef(null);
  const recordingCancelledRef = useRef(false);

  const getSupportedMimeType = () => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4'
    ];
    return types.find((type) => MediaRecorder.isTypeSupported?.(type)) || '';
  };

  const startRecording = async (event) => {
    if (isRecording || loading) return;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('This browser does not support microphone recording.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];
      recordingCancelledRef.current = false;
      setRecordingTime(0);
      setIsRecording(true);
      setIsLocked(false);
      setIsPaused(false);
      setShowPreview(false);
      setRecordedAudio(null);
      setWaveformData([]);

      const mimeType = getSupportedMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      setRecordingMimeType(recorder.mimeType || mimeType || 'audio/webm');

      recordingPointerRef.current = event?.pointerId ?? recordingPointerRef.current;
      if (event?.clientY != null && recordingStartYRef.current == null) {
        recordingStartYRef.current = event.clientY;
      }

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        clearInterval(recordingIntervalRef.current);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (audioContextRef.current) {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        if (recordingCancelledRef.current || audioChunksRef.current.length === 0) {
          setIsRecording(false);
          setIsLocked(false);
          setIsPaused(false);
          return;
        }

        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || mimeType || 'audio/webm'
        });
        const url = URL.createObjectURL(blob);
        setRecordedAudio({
          blob,
          url,
          duration: recordingTime,
          mimeType: recorder.mimeType || mimeType || 'audio/webm'
        });
        setShowPreview(true);
        setIsRecording(false);
        setIsLocked(false);
        setIsPaused(false);
      };

      // Timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      // Waveform visualization
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyser);

      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateWaveform = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = Array.from(dataArray).reduce((a, b) => a + b) / dataArray.length;
        setWaveformData((prev) => {
          const updated = [...prev, average];
          return updated.slice(-28);
        });
        animationFrameRef.current = requestAnimationFrame(updateWaveform);
      };

      updateWaveform();
      recorder.start();
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Error: ' + error.message);
    }
  };

  const cancelRecording = () => {
    const recorder = mediaRecorderRef.current;

    if (!recorder) {
      return;
    }

    try {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    } catch (error) {
      console.error('Error stopping recorder:', error);
    }

    setIsRecording(false);
    setIsLocked(false);
    setRecordingTime(0);
    setShowPreview(false);
    setRecordedAudio(null);

    recordingCancelledRef.current = true;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const pauseRecording = () => {
    const recorder = mediaRecorderRef.current;

    if (!recorder) {
      return;
    }

    try {
      if (isPaused) {
        if (recorder.state === 'paused') {
          recorder.resume();
        }
      } else {
        if (recorder.state === 'recording') {
          recorder.pause();
        }
      }
    } catch (error) {
      console.error('Error pausing recorder:', error);
    }

    setIsPaused(!isPaused);
  };

  const handleLockedStop = () => {
    const recorder = mediaRecorderRef.current;

    if (!recorder) {
      return;
    }

    try {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    } catch (error) {
      console.error('Error stopping recorder:', error);
    }
  };

  const discardPreview = () => {
    setShowPreview(false);
    setRecordedAudio(null);
  };

  const handleVoicePointerDown = (e) => {
    if (e.target?.dataset?.voiceMic) {
      startRecording(e);
    }
  };

  const handleVoicePointerMove = (e) => {
    if (!isRecording || !recordingStartYRef.current) return;

    const deltaY = recordingStartYRef.current - e.clientY;

    if (deltaY > 60) {
      setIsLocked(true);
    }
  };

  const handleVoicePointerUp = () => {
    if (isRecording && !isLocked) {
      cancelRecording();
    }
  };

  const handleVoicePointerCancel = () => {
    if (isRecording) {
      cancelRecording();
    }
  };

  const sendVoiceMessage = async () => {
    if (!recordedAudio) return;

    setLoading(true);
    try {
      const { storage } = await import('../lib/firebase');
      const { ref: storageRef, uploadBytes, getDownloadURL } = await import('firebase/storage');

      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.webm`;
      const voiceRef = storageRef(storage, `voices/${currentUser.uid}/${fileName}`);

      await uploadBytes(voiceRef, recordedAudio.blob);
      const fileUrl = await getDownloadURL(voiceRef);

      const messagesRef = ref(database, `${chatId}/messages`);
      const newMsg = push(messagesRef);

      await set(newMsg, {
        type: 'voice',
        fileUrl: fileUrl,
        duration: recordingTime,
        sender: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        timestamp: new Date().toISOString(),
        read: false
      });

      setRecordedAudio(null);
      setShowPreview(false);
      setRecordingTime(0);
      scrollToBottom();
    } catch (error) {
      console.error('Error sending voice:', error);
      alert('Failed to send voice message');
    } finally {
      setLoading(false);
    }
  };

  // Colors
  const textColor = darkMode ? 'white' : '#333';
  const mutedText = darkMode ? '#999' : '#999';
  const messageBgOwn = darkMode ? '#667eea' : '#e8f1ff';
  const messageBgOther = darkMode ? '#333' : '#f0f0f0';
  const messageTextOwn = darkMode ? 'white' : '#333';
  const messageTextOther = darkMode ? '#ddd' : '#333';
  const inputBg = darkMode ? '#1a1a1a' : '#f9f9f9';
  const inputBorder = darkMode ? '#333' : '#ddd';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: darkMode ? '#0a0a0a' : 'white',
      color: textColor
    }}>
      {/* MOBILE HEADER - Fixed at top */}
      <div style={{
        padding: '0.8rem 1rem',
        background: inputBg,
        borderBottom: `1px solid ${inputBorder}`,
        display: 'flex',
        alignItems: 'center',
        gap: '0.8rem',
        flexShrink: 0,
        minHeight: '60px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: '#667eea',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold',
          flexShrink: 0
        }}>
          {selectedUser.displayName?.charAt(0) || '?'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
            {selectedUser.displayName || selectedUser.email}
          </div>
          <div style={{ fontSize: '0.75rem', color: mutedText }}>
            {isTyping ? 'typing...' : 'Online'}
          </div>
        </div>
      </div>

      {/* MESSAGES AREA - Scrollable */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.8rem'
      }}>
        {messages.map((msg) => {
          const isOwn = msg.sender === currentUser.uid;

          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: isOwn ? 'flex-end' : 'flex-start',
                gap: '0.5rem',
                alignItems: 'flex-end'
              }}
            >
              {!isOwn && (
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: '#667eea',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  flexShrink: 0
                }}>
                  {selectedUser.displayName?.charAt(0) || '?'}
                </div>
              )}

              <div style={{
                maxWidth: '85%',
                background: isOwn ? messageBgOwn : messageBgOther,
                color: isOwn ? messageTextOwn : messageTextOther,
                padding: msg.type === 'voice' ? '0.5rem' : '0.8rem 1rem',
                borderRadius: '12px',
                wordWrap: 'break-word'
              }}>
                {msg.type === 'voice' ? (
                  <div>
                    <audio controls src={msg.fileUrl} style={{ width: '100%', height: '32px' }} />
                    <div style={{ fontSize: '0.7rem', marginTop: '0.3rem', opacity: 0.8 }}>
                      {msg.duration}s
                    </div>
                  </div>
                ) : (
                  <div>{linkifyText(msg.text)}</div>
                )}

                <p style={{
                  margin: msg.type === 'voice' ? '0' : '0.3rem 0 0 0',
                  fontSize: '0.7rem',
                  opacity: 0.8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}>
                  {msg.type !== 'voice' && new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {isOwn && <span>{msg.read ? '✓✓' : '✓'}</span>}
                </p>
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-start',
            gap: '0.5rem',
            alignItems: 'flex-end'
          }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: '#667eea',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '0.7rem',
              fontWeight: 'bold',
              flexShrink: 0
            }}>
              {selectedUser.displayName?.charAt(0) || '?'}
            </div>
            <div style={{
              padding: '0.8rem 1rem',
              borderRadius: '15px',
              background: messageBgOther,
              color: messageTextOther
            }}>
              <p style={{ margin: 0 }}>
                <span style={{ display: 'inline-block' }}>typing</span>
                <span style={{
                  display: 'inline-block',
                  marginLeft: '0.3rem',
                  animation: 'blink 1.4s infinite'
                }}>
                  <span style={{ opacity: 0.4 }}>.</span>
                  <span style={{ opacity: 0.6 }}>.</span>
                  <span style={{ opacity: 0.8 }}>.</span>
                </span>
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />

        <style>{`
          @keyframes blink {
            0%, 20%, 50%, 80%, 100% { opacity: 0.4; }
            40% { opacity: 0.8; }
            60% { opacity: 0.8; }
          }
        `}</style>
      </div>

      {/* MOBILE VOICE PREVIEW - Full-width card */}
      {showPreview && recordedAudio && (
        <div style={{
          background: darkMode ? '#222' : 'white',
          borderTop: `1px solid ${inputBorder}`,
          padding: '1.2rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          flexShrink: 0
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>
              Duration: {formatTime(recordedAudio.duration)}
            </div>
            <div style={{ fontSize: '0.8rem', color: mutedText }}>
              Ready to send
            </div>
          </div>

          {/* Audio Player - Full Width */}
          <audio 
            controls 
            src={recordedAudio.url} 
            style={{ 
              width: '100%',
              height: '44px'
            }} 
          />

          {/* Button Row */}
          <div style={{
            display: 'flex',
            gap: '0.8rem',
            justifyContent: 'flex-end'
          }}>
            <button 
              onClick={discardPreview} 
              disabled={loading} 
              style={{ 
                width: '50px',
                height: '50px',
                borderRadius: '50%', 
                border: 'none', 
                background: '#e74c3c', 
                color: 'white', 
                cursor: 'pointer',
                fontSize: '1.3rem',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }} 
              title="Delete recording"
            >
              ✕
            </button>
            
            <button 
              onClick={sendVoiceMessage} 
              disabled={loading} 
              style={{ 
                width: '54px',
                height: '54px',
                borderRadius: '50%', 
                border: 'none', 
                background: '#667eea', 
                color: 'white', 
                cursor: loading ? 'not-allowed' : 'pointer', 
                fontSize: '1.3rem',
                opacity: loading ? 0.6 : 1,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                transition: 'all 0.2s'
              }} 
              title="Send voice message"
            >
              ➤
            </button>
          </div>
        </div>
      )}

      {/* MOBILE INPUT AREA - Fixed at bottom */}
      <div
        onPointerDown={handleVoicePointerDown}
        onPointerMove={handleVoicePointerMove}
        onPointerUp={handleVoicePointerUp}
        onPointerCancel={handleVoicePointerCancel}
        style={{
          padding: '0.8rem 1rem',
          background: inputBg,
          borderTop: `1px solid ${inputBorder}`,
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          touchAction: 'none',
          userSelect: 'none',
          flexShrink: 0,
          minHeight: '60px'
        }}
      >
        {!isRecording ? (
          <>
            <button
              ref={micButtonRef}
              type="button"
              data-voice-mic="true"
              disabled={loading}
              onContextMenu={(e) => e.preventDefault()}
              style={{ 
                width: 48, 
                height: 48, 
                borderRadius: '50%', 
                border: 'none', 
                background: '#667eea', 
                color: 'white', 
                cursor: loading ? 'not-allowed' : 'pointer', 
                fontSize: '1.3rem', 
                touchAction: 'none', 
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Hold to record • slide up to lock"
            >
              🎤
            </button>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (!newMessage.trim()) return;

              setLoading(true);
              try {
                const messagesRef = ref(database, `${chatId}/messages`);
                const newMsg = push(messagesRef);
                set(newMsg, {
                  text: newMessage,
                  sender: currentUser.uid,
                  senderName: currentUser.displayName || currentUser.email,
                  timestamp: new Date().toISOString(),
                  type: 'text',
                  read: false
                });
                
                const typingRef = ref(database, `${chatId}/typing/${currentUser.uid}`);
                set(typingRef, false);
                
                setNewMessage('');
                scrollToBottom();
              } catch (error) {
                console.error('Error sending message:', error);
              } finally {
                setLoading(false);
              }
            }} style={{ display: 'flex', flex: 1, gap: '0.5rem' }}>
              <input
                id="message"
                name="message"
                type="text"
                value={newMessage}
                onChange={handleMessageChange}
                placeholder="Type a message..."
                disabled={loading}
                style={{ 
                  flex: 1, 
                  padding: '0.8rem 1rem', 
                  border: `1px solid ${inputBorder}`, 
                  borderRadius: '20px', 
                  fontSize: '1rem', 
                  boxSizing: 'border-box', 
                  background: darkMode ? '#333' : 'white', 
                  color: textColor
                }}
              />
              <button 
                type="submit" 
                disabled={loading || !newMessage.trim()} 
                style={{ 
                  width: 44, 
                  height: 44, 
                  borderRadius: '50%', 
                  border: 'none', 
                  background: '#667eea', 
                  color: 'white', 
                  cursor: 'pointer', 
                  opacity: loading || !newMessage.trim() ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.1rem',
                  flexShrink: 0
                }}
              >
                ➤
              </button>
            </form>
          </>
        ) : (
          <div
            style={{ 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.7rem', 
              background: darkMode ? '#333' : '#f5f5f5', 
              padding: '0.7rem 0.8rem', 
              borderRadius: '22px', 
              touchAction: 'none'
            }}
          >
            <button 
              onClick={cancelRecording} 
              style={{ 
                width: 38, 
                height: 38, 
                borderRadius: '50%', 
                border: 'none', 
                background: '#e74c3c', 
                color: 'white', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
                flexShrink: 0
              }} 
              title="Cancel"
            >
              ✕
            </button>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#e74c3c', fontSize: '0.8rem' }}>●</span>
                <strong style={{ color: textColor }}>{formatTime(recordingTime)}</strong>
                <div style={{ flex: 1, height: 26, display: 'flex', alignItems: 'center', gap: 2, overflow: 'hidden' }}>
                  {(waveformData.length ? waveformData : Array(28).fill(5)).map((val, idx) => (
                    <span key={idx} style={{ width: 2, height: `${Math.max(3, Math.min(24, val / 5))}px`, background: '#667eea', borderRadius: 2 }} />
                  ))}
                </div>
              </div>
              <div style={{ fontSize: '0.72rem', color: mutedText, marginTop: 2 }}>
                {isLocked ? '🔒 Recording locked — tap pause or stop' : '↑ Slide up to lock'}
              </div>
            </div>

            <button 
              onClick={pauseRecording} 
              style={{ 
                width: 40, 
                height: 40, 
                borderRadius: '50%', 
                border: 'none', 
                background: '#ff9800', 
                color: 'white', 
                cursor: 'pointer', 
                fontSize: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }} 
              title={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? '▶' : '⏸'}
            </button>

            {isLocked && (
              <button 
                onClick={handleLockedStop} 
                style={{ 
                  width: 40, 
                  height: 40, 
                  borderRadius: '50%', 
                  border: 'none', 
                  background: '#667eea', 
                  color: 'white', 
                  cursor: 'pointer', 
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }} 
                title="Stop and preview"
              >
                ➤
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
