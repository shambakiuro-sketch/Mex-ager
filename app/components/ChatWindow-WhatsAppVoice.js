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

  // WhatsApp-style recording
  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      setRecordingTime(0);
      setIsRecording(true);
      setIsLocked(false);
      setIsPaused(false);
      setShowPreview(false);
      setWaveformData([]);
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      // Visualize audio
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      
      const visualize = () => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        setWaveformData(Array.from(dataArray.slice(0, 30)));
        if (isRecording) requestAnimationFrame(visualize);
      };
      visualize();
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      
      mediaRecorder.onstop = async () => {
        clearInterval(recordingIntervalRef.current);
      };
      
      mediaRecorder.start();
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Microphone access denied');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      clearInterval(recordingIntervalRef.current);
      setIsRecording(false);
      setIsLocked(false);
      
      // Preview the recording
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);
      setRecordedAudio({ blob: audioBlob, url: audioUrl, duration: recordingTime });
      setShowPreview(true);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
      } else {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      clearInterval(recordingIntervalRef.current);
      setIsRecording(false);
      setIsLocked(false);
      setRecordingTime(0);
      setShowPreview(false);
      setRecordedAudio(null);
    }
  };

  const sendVoiceMessage = async () => {
    if (!recordedAudio) return;
    
    try {
      setLoading(true);
      
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Audio = reader.result.split(',')[1];
        
        const messagesRef = ref(database, `${chatId}/messages`);
        const newMsg = push(messagesRef);
        await set(newMsg, {
          text: 'Voice message',
          sender: currentUser.uid,
          senderName: currentUser.displayName || currentUser.email,
          timestamp: new Date().toISOString(),
          type: 'voice',
          audioData: base64Audio,
          duration: recordedAudio.duration,
          read: false
        });
        
        setRecordedAudio(null);
        setShowPreview(false);
        setRecordingTime(0);
        scrollToBottom();
      };
      reader.readAsDataURL(recordedAudio.blob);
    } catch (error) {
      console.error('Error sending voice message:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle swipe to lock
  const handleMouseMove = (e) => {
    if (!isRecording || isLocked || !micButtonRef.current) return;
    
    const button = micButtonRef.current;
    const rect = button.getBoundingClientRect();
    const distance = Math.abs(e.clientY - (rect.top + rect.height / 2));
    
    if (distance > 100) {
      setIsLocked(true);
    }
  };

  const handleMouseUp = () => {
    if (!isLocked && isRecording) {
      stopRecording();
    }
  };

  const bgColor = darkMode ? '#1a1a1a' : '#fafafa';
  const textColor = darkMode ? '#e0e0e0' : '#333';
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
                      src={`data:audio/wav;base64,${msg.audioData}`}
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

      {/* Voice Recording Preview Modal */}
      {showPreview && recordedAudio && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: darkMode ? '#2d2d2d' : 'white',
          borderTop: `2px solid ${inputBorder}`,
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          zIndex: 1000
        }}>
          <audio
            controls
            style={{ flex: 1, height: '40px' }}
            src={recordedAudio.url}
          />
          <button
            onClick={() => setShowPreview(false)}
            style={{
              padding: '0.8rem 1.2rem',
              background: '#999',
              color: 'white',
              border: 'none',
              borderRadius: '20px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            ❌
          </button>
          <button
            onClick={sendVoiceMessage}
            disabled={loading}
            style={{
              padding: '0.8rem 1.2rem',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '20px',
              cursor: 'pointer',
              fontWeight: 'bold',
              opacity: loading ? 0.6 : 1
            }}
          >
            ✓ Send
          </button>
        </div>
      )}

      {/* Message Input */}
      <div 
        style={{
          padding: '1rem',
          background: inputBg,
          borderTop: `1px solid ${inputBorder}`,
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center'
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {!isRecording ? (
          <>
            {/* Mic Button */}
            <button
              ref={micButtonRef}
              onMouseDown={startRecording}
              disabled={loading}
              style={{
                padding: '0.8rem',
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '1.2rem',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              title="Hold to record"
            >
              🎤
            </button>

            {/* Text Input */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (newMessage.trim()) {
                  handleSendMessage(e);
                }
              }} 
              style={{ display: 'flex', flex: 1, gap: '0.5rem' }}
            >
              <input
                type="text"
                value={newMessage}
                onChange={handleMessageChange}
                placeholder="Type a message..."
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '0.8rem',
                  border: `1px solid ${inputBorder}`,
                  borderRadius: '20px',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  background: darkMode ? '#333' : 'white',
                  color: textColor,
                  transition: 'all 0.2s',
                  paddingLeft: '1rem'
                }}
              />
              <button
                type="submit"
                disabled={loading || !newMessage.trim()}
                style={{
                  padding: '0.8rem',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  opacity: (loading || !newMessage.trim()) ? 0.6 : 1,
                  transition: 'all 0.2s',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ➤
              </button>
            </form>
          </>
        ) : (
          // Recording UI
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            background: darkMode ? '#333' : '#f5f5f5',
            padding: '0.8rem 1rem',
            borderRadius: '20px'
          }}>
            {/* Waveform */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              {waveformData.map((val, idx) => (
                <div
                  key={idx}
                  style={{
                    width: '2px',
                    height: Math.max(3, val / 20),
                    background: '#667eea',
                    borderRadius: '1px',
                    transition: 'height 0.1s'
                  }}
                />
              ))}
            </div>

            {/* Time */}
            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', minWidth: '45px' }}>
              {formatTime(recordingTime)}
            </span>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
              {/* Cancel Button */}
              <button
                onClick={cancelRecording}
                style={{
                  padding: '0.5rem',
                  background: '#ff6b6b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Cancel"
              >
                ✕
              </button>

              {/* Pause Button */}
              <button
                onClick={pauseRecording}
                style={{
                  padding: '0.5rem',
                  background: '#ff9800',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title={isPaused ? 'Resume' : 'Pause'}
              >
                {isPaused ? '▶' : '⏸'}
              </button>

              {/* Lock Button */}
              <button
                onClick={() => setIsLocked(!isLocked)}
                style={{
                  padding: '0.5rem',
                  background: isLocked ? '#4CAF50' : '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                title={isLocked ? 'Release to send' : 'Swipe up to lock'}
              >
                {isLocked ? '🔒' : '🔓'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  function handleSendMessage(e) {
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
  }
}
