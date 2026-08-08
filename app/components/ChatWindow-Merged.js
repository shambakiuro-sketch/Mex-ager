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
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const streamRef = useRef(null);
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
            onMessageNotification(lastMessage.senderName || selectedUser.displayName, messageText);
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

  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      setRecordingTime(0);
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.onstart = () => {
        setIsRecording(true);
        recordingIntervalRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      };
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      
      mediaRecorder.onstop = async () => {
        clearInterval(recordingIntervalRef.current);
        setIsRecording(false);
        setRecordingTime(0);
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await sendVoiceMessage(audioBlob);
      };
      
      mediaRecorder.start();
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Microphone access denied. Please allow microphone access.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  const sendVoiceMessage = async (audioBlob) => {
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
          duration: recordingTime,
          read: false
        });
        
        scrollToBottom();
      };
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('Error sending voice message:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
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
                  padding: '0.8rem 1rem',
                  borderRadius: '10px',
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
                  <div>
                    <audio
                      controls
                      style={{ width: '100%', maxWidth: '200px' }}
                      src={`data:audio/wav;base64,${msg.audioData}`}
                    />
                    <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.75rem' }}>
                      🎤 Voice ({msg.duration}s)
                    </p>
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
                  margin: '0.3rem 0 0 0',
                  fontSize: '0.75rem',
                  opacity: 0.8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}>
                  {new Date(msg.timestamp).toLocaleTimeString()}
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
              borderRadius: '10px',
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

      {/* Message Input */}
      <div style={{
        padding: '1rem',
        background: inputBg,
        borderTop: `1px solid ${inputBorder}`,
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center'
      }}>
        {/* Microphone Button */}
        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          disabled={loading}
          style={{
            padding: '0.8rem',
            background: isRecording ? '#ff6b6b' : '#667eea',
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
          title={isRecording ? `Recording... ${recordingTime}s` : 'Hold to record voice'}
        >
          🎤
        </button>

        {/* Recording Time Display */}
        {isRecording && (
          <div style={{ color: '#ff6b6b', fontWeight: 'bold', fontSize: '0.9rem' }}>
            {recordingTime}s
          </div>
        )}

        {/* Text Input */}
        <form onSubmit={handleSendMessage} style={{ display: 'flex', flex: 1, gap: '0.5rem' }}>
          <input
            type="text"
            value={newMessage}
            onChange={handleMessageChange}
            placeholder="Type a message or paste a link..."
            disabled={loading || isRecording}
            style={{
              flex: 1,
              padding: '0.8rem',
              border: `1px solid ${inputBorder}`,
              borderRadius: '5px',
              fontSize: '1rem',
              boxSizing: 'border-box',
              background: darkMode ? '#333' : 'white',
              color: textColor,
              transition: 'all 0.2s'
            }}
          />
          <button
            type="submit"
            disabled={loading || !newMessage.trim()}
            style={{
              padding: '0.8rem 1.5rem',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontWeight: 'bold',
              opacity: (loading || !newMessage.trim()) ? 0.6 : 1,
              transition: 'all 0.2s'
            }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
