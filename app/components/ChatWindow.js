'use client';

import { useState, useEffect, useRef } from 'react';
import { database } from '../lib/firebase';
import { ref, onValue, push, set, update } from 'firebase/database';

export default function ChatWindow({ selectedUser, currentUser, darkMode, onMessageNotification }) {
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

      // Pointer tracking is handled by the persistent input container.
      // Do not depend on the microphone button staying mounted while React
      // switches to the recording UI.
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

      // Live waveform
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          const audioContext = new AudioContextClass();
          audioContextRef.current = audioContext;
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 64;
          const microphone = audioContext.createMediaStreamSource(stream);
          microphone.connect(analyser);
          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          const draw = () => {
            if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
            analyser.getByteFrequencyData(dataArray);
            setWaveformData(Array.from(dataArray).slice(0, 28));
            animationFrameRef.current = requestAnimationFrame(draw);
          };
          draw();
        }
      } catch (waveError) {
        console.warn('Waveform unavailable:', waveError);
      }

      recorder.start(100);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((previous) => previous + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setIsRecording(false);
      alert(error?.message || 'Microphone access denied. Please allow microphone access and try again.');
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    recorder.stop();
  };

  const pauseRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    if (recorder.state === 'recording') {
      recorder.pause();
      setIsPaused(true);
      clearInterval(recordingIntervalRef.current);
    } else if (recorder.state === 'paused') {
      recorder.resume();
      setIsPaused(false);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((previous) => previous + 1);
      }, 1000);
    }
  };

  const cancelRecording = () => {
    recordingCancelledRef.current = true;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    else if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());

    if (recordedAudio?.url) URL.revokeObjectURL(recordedAudio.url);
    clearInterval(recordingIntervalRef.current);
    setIsRecording(false);
    setIsLocked(false);
    setIsPaused(false);
    setRecordingTime(0);
    setShowPreview(false);
    setRecordedAudio(null);
    setWaveformData([]);
  };

  const discardPreview = () => {
    if (recordedAudio?.url) URL.revokeObjectURL(recordedAudio.url);
    setRecordedAudio(null);
    setShowPreview(false);
    setRecordingTime(0);
    setWaveformData([]);
  };

  const sendVoiceMessage = async () => {
    if (!recordedAudio || loading) return;

    try {
      setLoading(true);

      // Store the recording directly in Realtime Database.
      // This does not use Firebase Cloud Storage.
      const audioData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
        reader.readAsDataURL(recordedAudio.blob);
      });

      if (!audioData || typeof audioData !== 'string') {
        throw new Error('Could not prepare the recorded audio.');
      }

      const messagesRef = ref(database, `${chatId}/messages`);
      const newMsg = push(messagesRef);

      await set(newMsg, {
        text: 'Voice message',
        sender: currentUser.uid,
        receiver: selectedUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        timestamp: new Date().toISOString(),
        type: 'voice',
        audioData,
        duration: recordedAudio.duration,
        mimeType: recordedAudio.mimeType || 'audio/webm',
        read: false
      });

      if (recordedAudio.url) URL.revokeObjectURL(recordedAudio.url);
      setRecordedAudio(null);
      setShowPreview(false);
      setRecordingTime(0);
      setWaveformData([]);
      scrollToBottom();
    } catch (error) {
      console.error('Error sending voice message:', error);
      alert(`Could not send voice message: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };;

  // Reliable WhatsApp-style voice gesture handling.
  // The input container stays mounted while the UI changes from the mic
  // button to the recording controls, so pointer events are not lost.
  const handleVoicePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const mic = event.target?.closest?.('[data-voice-mic="true"]');
    if (!mic || isRecording || loading) return;

    event.preventDefault();
    recordingPointerRef.current = event.pointerId;
    recordingStartYRef.current = event.clientY;

    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch (_) {}

    startRecording(event);
  };

  const handleVoicePointerMove = (event) => {
    if (!isRecording || isLocked) return;
    if (recordingPointerRef.current !== null &&
        event.pointerId !== recordingPointerRef.current) return;
    if (recordingStartYRef.current == null) return;

    const deltaY = recordingStartYRef.current - event.clientY;

    if (deltaY > 0) {
      setWaveformData((current) => current);
    }

    // Swipe upward 70px to lock the recording.
    if (deltaY >= 70) {
      setIsLocked(true);
      recordingPointerRef.current = null;
      try {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      } catch (_) {}
    }
  };

  const handleVoicePointerUp = (event) => {
    if (!isRecording) return;
    if (recordingPointerRef.current !== null &&
        event.pointerId !== recordingPointerRef.current) return;

    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch (_) {}

    recordingPointerRef.current = null;
    recordingStartYRef.current = null;

    // If locked, keep recording until the user presses the stop/send-preview
    // button. Otherwise releasing the mic finishes the recording.
    if (!isLocked) {
      stopRecording();
    }
  };

  const handleVoicePointerCancel = (event) => {
    if (!isRecording) return;

    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch (_) {}

    recordingPointerRef.current = null;
    recordingStartYRef.current = null;

    if (!isLocked) {
      cancelRecording();
    }
  };

  const handleLockedStop = () => {
    if (isLocked && isRecording) {
      recordingPointerRef.current = null;
      recordingStartYRef.current = null;
      stopRecording();
    }
  };

  const bgColor = darkMode ? '#1a1a1a' : '#fafafa';
  const textColor = darkMode ? '#e0e0e0' : '#333';
  const mutedText = darkMode ? '#aaa' : '#777';
  const headerBg = darkMode ? '#2d2d2d' : '#667eea';
  const inputBg = darkMode ? '#2d2d2d' : 'white';
  const inputBorder = darkMode ? '#444' : '#ddd';
  const messageBgMe = '#667eea';
  const messageBgOther = darkMode ? '#333' : '#e0e0e0';
  const messageTextMe = 'white';
  const messageTextOther = darkMode ? '#e0e0e0' : '#333';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: bgColor }}>
      {/* Header */}
      <div style={{
        padding: '1rem',
        background: headerBg,
        color: 'white',
        borderBottom: `1px solid ${darkMode ? '#444' : '#ddd'}`
      }}>
        <h3 style={{ margin: 0 }}>{selectedUser.displayName}</h3>
        <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.9rem', opacity: 0.9 }}>
          {selectedUser.email}
        </p>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1rem',
        background: bgColor
      }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: darkMode ? '#666' : '#999', marginTop: '2rem' }}>
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: msg.sender === currentUser.uid ? 'flex-end' : 'flex-start',
                alignItems: 'flex-end',
                gap: '0.5rem'
              }}
            >
              <div
                style={{
                  maxWidth: '60%',
                  padding: msg.type === 'voice' ? '0.6rem 1rem' : '0.8rem 1rem',
                  borderRadius: '15px',
                  background: msg.sender === currentUser.uid ? messageBgMe : messageBgOther,
                  color: msg.sender === currentUser.uid ? messageTextMe : messageTextOther,
                  wordBreak: 'break-word'
                }}
              >
                {msg.type === 'text' ? (
                  <p style={{ margin: 0 }}>
                    {linkifyText(msg.text)}
                  </p>
                ) : msg.type === 'voice' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <audio
                      controls
                      style={{ 
                        height: '32px',
                        maxWidth: '250px'
                      }}
                      src={msg.audioData || msg.audioUrl || msg.fileUrl || undefined}
                    />
                    <span style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      {msg.duration}s
                    </span>
                  </div>
                ) : (
                  <div>
                    <a
                      href={msg.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: msg.sender === currentUser.uid ? 'white' : '#667eea',
                        textDecoration: 'underline'
                      }}
                    >
                      📎 {msg.fileName}
                    </a>
                  </div>
                )}
                <p style={{
                  margin: msg.type === 'voice' ? '0' : '0.3rem 0 0 0',
                  fontSize: '0.75rem',
                  opacity: 0.8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}>
                  {msg.type !== 'voice' && new Date(msg.timestamp).toLocaleTimeString()}
                  {msg.sender === currentUser.uid && (
                    <span>{msg.read ? '✓✓' : '✓'}</span>
                  )}
                </p>
              </div>
            </div>
          ))
        )}

        {/* Typing Indicator */}
        {isTyping && (
          <div style={{
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'flex-start'
          }}>
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

      {/* Voice Recording Preview */}
      {showPreview && recordedAudio && (
        <div style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          background: darkMode ? '#222' : 'white',
          borderTop: `1px solid ${inputBorder}`,
          padding: '0.7rem 0.8rem',
          zIndex: 2000,
          boxShadow: '0 -4px 15px rgba(0,0,0,0.18)',
          boxSizing: 'border-box'
        }}>
          {/* Audio preview row - kept separate so mobile controls cannot be pushed
              outside the screen by the browser's native audio element. */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            width: '100%',
            minWidth: 0
          }}>
            <span style={{
              fontWeight: 700,
              color: textColor,
              fontSize: '0.85rem',
              minWidth: 38,
              flexShrink: 0
            }}>
              {formatTime(recordedAudio.duration)}
            </span>

            <audio
              controls
              preload="metadata"
              src={recordedAudio.url}
              style={{
                width: '100%',
                minWidth: 0,
                height: 38,
                flex: 1
              }}
            />
          </div>

          {/* Action row - Send is always visible on small screens. */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '0.6rem',
            width: '100%',
            marginTop: '0.55rem'
          }}>
            <button
              type="button"
              onClick={discardPreview}
              disabled={loading}
              title="Delete recording"
              style={{
                minWidth: 44,
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: 'none',
                background: '#e74c3c',
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                flexShrink: 0
              }}
            >
              ✕
            </button>

            <button
              type="button"
              onClick={sendVoiceMessage}
              disabled={loading}
              title="Send voice message"
              style={{
                minWidth: 48,
                width: 48,
                height: 48,
                borderRadius: '50%',
                border: 'none',
                background: '#667eea',
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '1.25rem',
                fontWeight: 'bold',
                opacity: loading ? 0.6 : 1,
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
              }}
            >
              {loading ? '…' : '➤'}
            </button>
          </div>
        </div>
      )}

      {/* Message Input / Recording Controls */}
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
          userSelect: 'none'
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
              style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: '#667eea', color: 'white', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '1.2rem', touchAction: 'none', flexShrink: 0 }}
              title="Hold to record • slide up to lock"
            >🎤</button>

            <form onSubmit={handleSendMessage} style={{ display: 'flex', flex: 1, gap: '0.5rem' }}>
              <input
                id="message"
                name="message"
                type="text"
                value={newMessage}
                onChange={handleMessageChange}
                placeholder="Type a message..."
                disabled={loading}
                style={{ flex: 1, padding: '0.8rem 1rem', border: `1px solid ${inputBorder}`, borderRadius: '20px', fontSize: '1rem', boxSizing: 'border-box', background: darkMode ? '#333' : 'white', color: textColor }}
              />
              <button type="submit" disabled={loading || !newMessage.trim()} style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: '#667eea', color: 'white', cursor: 'pointer', opacity: loading || !newMessage.trim() ? 0.6 : 1 }}>➤</button>
            </form>
          </>
        ) : (
          <div
            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.7rem', background: darkMode ? '#333' : '#f5f5f5', padding: '0.7rem 0.8rem', borderRadius: '22px', touchAction: 'none' }}
          >
            <button onClick={cancelRecording} style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: '#e74c3c', color: 'white', cursor: 'pointer' }} title="Cancel">✕</button>

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

            <button onClick={pauseRecording} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: '#ff9800', color: 'white', cursor: 'pointer', fontSize: '1rem' }} title={isPaused ? 'Resume' : 'Pause'}>
              {isPaused ? '▶' : '⏸'}
            </button>

            {isLocked && (
              <button onClick={handleLockedStop} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: '#667eea', color: 'white', cursor: 'pointer', fontSize: '1rem' }} title="Stop and preview">➤</button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setLoading(true);
    try {
      const messagesRef = ref(database, `${chatId}/messages`);
      const newMsg = push(messagesRef);
      await set(newMsg, {
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
  }
}
