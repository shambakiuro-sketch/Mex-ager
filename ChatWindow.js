'use client';

import { useState, useEffect, useRef } from 'react';
import { database, storage } from '../lib/firebase';
import { ref, onValue, push, set, update } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function ChatWindow({ selectedUser, currentUser, darkMode }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState(null);
  const messagesEndRef = useRef(null);

  const getChatId = (uid1, uid2) => {
    const ids = [uid1, uid2].sort();
    return `chats/${ids.join('_')}`;
  };

  const chatId = getChatId(currentUser.uid, selectedUser.uid);

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

    // Clear previous timeout
    if (typingTimeout) clearTimeout(typingTimeout);

    // Set new timeout
    const newTimeout = setTimeout(() => {
      set(typingRef, false);
    }, 1000);

    setTypingTimeout(newTimeout);
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
      
      // Clear typing indicator
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

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const fileRef = storageRef(storage, `${chatId}/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const downloadURL = await getDownloadURL(fileRef);

      const messagesRef = ref(database, `${chatId}/messages`);
      const newMsg = push(messagesRef);
      await set(newMsg, {
        fileName: file.name,
        fileUrl: downloadURL,
        sender: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        timestamp: new Date().toISOString(),
        type: 'file',
        read: false
      });
      scrollToBottom();
    } catch (error) {
      console.error('Error uploading file:', error);
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
                  <p style={{ margin: 0 }}>{msg.text}</p>
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
        gap: '0.5rem'
      }}>
        <input
          type="file"
          onChange={handleFileUpload}
          disabled={loading}
          id="fileInput"
          style={{ display: 'none' }}
        />
        <button
          onClick={() => document.getElementById('fileInput').click()}
          disabled={loading}
          style={{
            padding: '0.8rem 1rem',
            background: darkMode ? '#444' : '#e0e0e0',
            color: darkMode ? '#e0e0e0' : '#333',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '1rem',
            transition: 'all 0.2s'
          }}
          title="Upload file"
        >
          📎
        </button>

        <form onSubmit={handleSendMessage} style={{ display: 'flex', flex: 1, gap: '0.5rem' }}>
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
