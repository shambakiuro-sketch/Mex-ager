'use client';

import { useEffect, useRef, useState } from 'react';
import { auth, database, storage } from '../lib/firebase';
import {
  ref,
  onValue,
  push,
  set,
  update
} from 'firebase/database';
import {
  getDownloadURL,
  uploadBytes
} from 'firebase/storage';

export default function ChatWindow({
  selectedUser,
  currentUser,
  darkMode,
  onMessageNotification
}) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // Recording state
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

  const analyserRef = useRef(null);
  const audioContextRef = useRef(null);
  const animationFrameRef = useRef(null);

  const lastNotifiedRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Recording gesture refs
  const recordingStartYRef = useRef(0);
  const isPointerDownRef = useRef(false);
  const pointerIdRef = useRef(null);

  if (!currentUser || !selectedUser) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        Select a user to start chatting
      </div>
    );
  }

  const getChatId = (uid1, uid2) => {
    const ids = [uid1, uid2].sort();
    return `chats/${ids.join('_')}`;
  };

  const chatId = getChatId(
    currentUser.uid,
    selectedUser.uid
  );

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${mins}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  const linkifyText = (text = '') => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    return text.split(urlRegex).map((part, index) => {
      if (/^https?:\/\//.test(part)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'inherit',
              textDecoration: 'underline',
              wordBreak: 'break-all'
            }}
          >
            {part}
          </a>
        );
      }

      return part;
    });
  };

  /*
   * ============================
   * LOAD MESSAGES
   * ============================
   */

  useEffect(() => {
    const messagesRef = ref(
      database,
      `${chatId}/messages`
    );

    const typingRef = ref(
      database,
      `${chatId}/typing/${selectedUser.uid}`
    );

    const unsubscribeMessages = onValue(
      messagesRef,
      (snapshot) => {
        const data = snapshot.val();

        if (!data) {
          setMessages([]);
          return;
        }

        const messageList = Object.entries(data)
          .map(([id, msg]) => ({
            id,
            ...msg
          }))
          .sort(
            (a, b) =>
              new Date(a.timestamp || 0) -
              new Date(b.timestamp || 0)
          );

        setMessages(messageList);

        const lastMessage =
          messageList[messageList.length - 1];

        if (
          lastMessage &&
          lastMessage.sender !== currentUser.uid &&
          lastMessage.id !== lastNotifiedRef.current
        ) {
          lastNotifiedRef.current =
            lastMessage.id;

          const messageText =
            lastMessage.type === 'voice'
              ? `🎤 Voice message • ${
                  lastMessage.duration || 0
                }s`
              : lastMessage.type === 'file'
              ? `📎 ${
                  lastMessage.fileName || 'File'
                }`
              : lastMessage.text || '';

          onMessageNotification?.(
            lastMessage.senderName ||
              selectedUser.displayName ||
              'Someone',
            messageText,
            lastMessage.sender
          );
        }

        // Mark incoming messages as read
        messageList.forEach((msg) => {
          if (
            msg.sender !== currentUser.uid &&
            !msg.read
          ) {
            update(
              ref(
                database,
                `${chatId}/messages/${msg.id}`
              ),
              {
                read: true
              }
            ).catch((error) =>
              console.error(
                'Failed to mark message read:',
                error
              )
            );
          }
        });

        scrollToBottom();
      },
      (error) => {
        console.error(
          'Failed to load messages:',
          error
        );
      }
    );

    const unsubscribeTyping = onValue(
      typingRef,
      (snapshot) => {
        setIsTyping(
          snapshot.val() === true
        );
      },
      (error) => {
        console.error(
          'Failed to load typing status:',
          error
        );
      }
    );

    return () => {
      unsubscribeMessages();
      unsubscribeTyping();

      if (typingTimeoutRef.current) {
        clearTimeout(
          typingTimeoutRef.current
        );
      }

      stopMediaTracks();
    };
  }, [
    chatId,
    selectedUser.uid,
    currentUser.uid
  ]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: 'smooth'
      });
    });
  };

  /*
   * ============================
   * RECORDING HELPERS
   * ============================
   */

  const stopMediaTracks = () => {
    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) => track.stop());

      streamRef.current = null;
    }

    if (recordingIntervalRef.current) {
      clearInterval(
        recordingIntervalRef.current
      );

      recordingIntervalRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(
        animationFrameRef.current
      );

      animationFrameRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current
        .close()
        .catch(() => {});

      audioContextRef.current = null;
    }

    analyserRef.current = null;
  };

  const getSupportedMimeType = () => {
    if (
      typeof MediaRecorder ===
      'undefined'
    ) {
      return '';
    }

    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus'
    ];

    return (
      types.find((type) =>
        MediaRecorder.isTypeSupported(type)
      ) || ''
    );
  };

  const startWaveform = (stream) => {
    try {
      const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContextClass) {
        return;
      }

      const audioContext =
        new AudioContextClass();

      const analyser =
        audioContext.createAnalyser();

      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.75;

      const microphone =
        audioContext.createMediaStreamSource(
          stream
        );

      microphone.connect(analyser);

      audioContextRef.current =
        audioContext;

      analyserRef.current = analyser;

      const dataArray =
        new Uint8Array(
          analyser.frequencyBinCount
        );

      const draw = () => {
        if (!analyserRef.current) {
          return;
        }

        analyser.getByteFrequencyData(
          dataArray
        );

        setWaveformData(
          Array.from(dataArray).slice(
            0,
            32
          )
        );

        animationFrameRef.current =
          requestAnimationFrame(draw);
      };

      draw();
    } catch (error) {
      console.warn(
        'Waveform unavailable:',
        error
      );
    }
  };

  /*
   * ============================
   * START RECORDING
   * ============================
   */

  const startRecording = async () => {
    if (isRecording || loading) {
      return;
    }

    try {
      if (
        !navigator.mediaDevices?.getUserMedia
      ) {
        alert(
          'Your browser does not support microphone recording.'
        );

        return;
      }

      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            audio: true
          }
        );

      const mimeType =
        getSupportedMimeType();

      if (!mimeType) {
        stream
          .getTracks()
          .forEach((track) =>
            track.stop()
          );

        alert(
          'This browser does not support audio recording.'
        );

        return;
      }

      audioChunksRef.current = [];

      setRecordingTime(0);
      setIsRecording(true);
      setIsLocked(false);
      setIsPaused(false);
      setRecordedAudio(null);
      setShowPreview(false);
      setWaveformData([]);

      streamRef.current = stream;

      startWaveform(stream);

      const recorder =
        new MediaRecorder(stream, {
          mimeType
        });

      mediaRecorderRef.current =
        recorder;

      recorder.ondataavailable = (
        event
      ) => {
        if (
          event.data &&
          event.data.size > 0
        ) {
          audioChunksRef.current.push(
            event.data
          );
        }
      };

      recorder.onerror = (event) => {
        console.error(
          'MediaRecorder error:',
          event.error
        );
      };

      recorder.start(250);

      recordingIntervalRef.current =
        setInterval(() => {
          if (
            mediaRecorderRef.current
              ?.state === 'recording'
          ) {
            setRecordingTime(
              (previous) =>
                previous + 1
            );
          }
        }, 1000);
    } catch (error) {
      console.error(
        'Microphone error:',
        error
      );

      setIsRecording(false);

      if (
        error.name ===
        'NotAllowedError'
      ) {
        alert(
          'Microphone permission was denied. Please allow microphone access.'
        );
      } else {
        alert(
          'Could not access the microphone.'
        );
      }

      stopMediaTracks();
    }
  };

  /*
   * ============================
   * FINISH RECORDING
   * ============================
   */

  const finishRecording = () => {
    const recorder =
      mediaRecorderRef.current;

    if (!recorder) {
      return;
    }

    const complete = () => {
      const mimeType =
        recorder.mimeType ||
        'audio/webm';

      const blob = new Blob(
        audioChunksRef.current,
        {
          type: mimeType
        }
      );

      if (!blob.size) {
        alert(
          'No audio was recorded.'
        );

        setIsRecording(false);
        setIsLocked(false);

        stopMediaTracks();

        return;
      }

      const url =
        URL.createObjectURL(blob);

      setRecordedAudio({
        blob,
        url,
        duration: recordingTime,
        mimeType
      });

      setShowPreview(true);

      setIsRecording(false);
      setIsLocked(false);
      setIsPaused(false);

      stopMediaTracks();
    };

    recorder.onstop = complete;

    try {
      if (
        recorder.state !==
        'inactive'
      ) {
        recorder.stop();
      } else {
        complete();
      }
    } catch (error) {
      console.error(
        'Failed to stop recording:',
        error
      );

      complete();
    }
  };

  /*
   * ============================
   * CANCEL RECORDING
   * ============================
   */

  const cancelRecording = () => {
    const recorder =
      mediaRecorderRef.current;

    try {
      if (
        recorder &&
        recorder.state !==
          'inactive'
      ) {
        recorder.onstop = null;
        recorder.stop();
      }
    } catch (error) {
      console.error(
        'Cancel recording error:',
        error
      );
    }

    audioChunksRef.current = [];

    stopMediaTracks();

    setIsRecording(false);
    setIsLocked(false);
    setIsPaused(false);
    setRecordingTime(0);
    setRecordedAudio(null);
    setShowPreview(false);
    setWaveformData([]);

    isPointerDownRef.current =
      false;
  };

  /*
   * ============================
   * PAUSE / RESUME
   * ============================
   */

  const pauseRecording = () => {
    const recorder =
      mediaRecorderRef.current;

    if (!recorder) {
      return;
    }

    if (
      recorder.state ===
      'recording'
    ) {
      recorder.pause();
      setIsPaused(true);
    } else if (
      recorder.state ===
      'paused'
    ) {
      recorder.resume();
      setIsPaused(false);
    }
  };

  /*
   * ============================
   * DELETE PREVIEW
   * ============================
   */

  const discardPreview = () => {
    if (recordedAudio?.url) {
      URL.revokeObjectURL(
        recordedAudio.url
      );
    }

    setRecordedAudio(null);
    setShowPreview(false);
    setRecordingTime(0);
    setWaveformData([]);
  };

  /*
   * ============================
   * SEND VOICE MESSAGE
   * ============================
   */

  const sendVoiceMessage = async () => {
    if (
      !recordedAudio ||
      loading
    ) {
      return;
    }

    try {
      setLoading(true);

      const extension =
        recordedAudio.mimeType.includes(
          'mp4'
        )
          ? 'm4a'
          : recordedAudio.mimeType.includes(
              'ogg'
            )
          ? 'ogg'
          : 'webm';

      const storagePath =
        `voice-messages/${currentUser.uid}/${chatId.replace(
          '/',
          '_'
        )}/${Date.now()}.${extension}`;

      const storageRef = ref(
        storage,
        storagePath
      );

      await uploadBytes(
        storageRef,
        recordedAudio.blob,
        {
          contentType:
            recordedAudio.mimeType,
          customMetadata: {
            senderId:
              currentUser.uid,
            receiverId:
              selectedUser.uid
          }
        }
      );

      const audioUrl =
        await getDownloadURL(
          storageRef
        );

      const messagesRef = ref(
        database,
        `${chatId}/messages`
      );

      const newMsg =
        push(messagesRef);

      await set(newMsg, {
        text: 'Voice message',
        sender:
          currentUser.uid,
        receiver:
          selectedUser.uid,
        senderName:
          currentUser.displayName ||
          currentUser.email,
        timestamp:
          new Date().toISOString(),
        type: 'voice',
        audioUrl,
        duration:
          recordedAudio.duration,
        mimeType:
          recordedAudio.mimeType,
        read: false
      });

      URL.revokeObjectURL(
        recordedAudio.url
      );

      setRecordedAudio(null);
      setShowPreview(false);
      setRecordingTime(0);
      setWaveformData([]);

      scrollToBottom();
    } catch (error) {
      console.error(
        'Error sending voice message:',
        error
      );

      alert(
        `Could not send voice message: ${error.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * ============================
   * HOLD + SWIPE UP TO LOCK
   * ============================
   */

  const handlePointerDown = (
    event
  ) => {
    if (
      event.pointerType ===
        'mouse' &&
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();

    isPointerDownRef.current =
      true;

    pointerIdRef.current =
      event.pointerId;

    recordingStartYRef.current =
      event.clientY;

    try {
      micButtonRef.current?.setPointerCapture?.(
        event.pointerId
      );
    } catch {}

    startRecording();
  };

  const handlePointerMove = (
    event
  ) => {
    if (
      !isRecording ||
      isLocked ||
      !isPointerDownRef.current
    ) {
      return;
    }

    const distanceUp =
      recordingStartYRef.current -
      event.clientY;

    /*
     * Move 60px upward to lock.
     */
    if (distanceUp >= 60) {
      setIsLocked(true);

      if (
        navigator.vibrate
      ) {
        navigator.vibrate(40);
      }
    }
  };

  const handlePointerUp = (
    event
  ) => {
    event.preventDefault();

    isPointerDownRef.current =
      false;

    if (!isRecording) {
      return;
    }

    /*
     * IMPORTANT:
     *
     * If locked, releasing the finger
     * DOES NOT stop recording.
     */
    if (isLocked) {
      return;
    }

    finishRecording();
  };

  const handlePointerCancel = () => {
    isPointerDownRef.current =
      false;

    if (!isRecording) {
      return;
    }

    if (!isLocked) {
      cancelRecording();
    }
  };

  /*
   * ============================
   * TEXT MESSAGES
   * ============================
   */

  const handleMessageChange = (
    event
  ) => {
    const value =
      event.target.value;

    setNewMessage(value);

    const typingRef = ref(
      database,
      `${chatId}/typing/${currentUser.uid}`
    );

    set(
      typingRef,
      value.length > 0
    ).catch(() => {});

    if (
      typingTimeoutRef.current
    ) {
      clearTimeout(
        typingTimeoutRef.current
      );
    }

    typingTimeoutRef.current =
      setTimeout(() => {
        set(
          typingRef,
          false
        ).catch(() => {});
      }, 1200);
  };

  const handleSendMessage = async (
    event
  ) => {
    event?.preventDefault();

    const text =
      newMessage.trim();

    if (!text || loading) {
      return;
    }

    try {
      setLoading(true);

      const messagesRef = ref(
        database,
        `${chatId}/messages`
      );

      const newMsg =
        push(messagesRef);

      await set(newMsg, {
        text,
        sender:
          currentUser.uid,
        receiver:
          selectedUser.uid,
        senderName:
          currentUser.displayName ||
          currentUser.email,
        timestamp:
          new Date().toISOString(),
        type: 'text',
        read: false
      });

      await set(
        ref(
          database,
          `${chatId}/typing/${currentUser.uid}`
        ),
        false
      );

      setNewMessage('');

      scrollToBottom();
    } catch (error) {
      console.error(
        'Error sending message:',
        error
      );

      alert(
        `Could not send message: ${error.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * ============================
   * STYLES
   * ============================
   */

  const bgColor = darkMode
    ? '#1a1a1a'
    : '#fafafa';

  const textColor = darkMode
    ? '#e0e0e0'
    : '#333';

  const headerBg = darkMode
    ? '#2d2d2d'
    : '#667eea';

  const inputBg = darkMode
    ? '#2d2d2d'
    : 'white';

  const inputBorder = darkMode
    ? '#444'
    : '#ddd';

  const messageBgMe =
    '#667eea';

  const messageBgOther =
    darkMode
      ? '#333'
      : '#e0e0e0';

  const messageTextMe =
    'white';

  const messageTextOther =
    darkMode
      ? '#e0e0e0'
      : '#333';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: bgColor,
        color: textColor
      }}
    >
      {/* CHAT HEADER */}

      <div
        style={{
          padding: '1rem',
          background: headerBg,
          color: 'white',
          borderBottom: `1px solid ${
            darkMode
              ? '#444'
              : '#ddd'
          }`
        }}
      >
        <h3
          style={{
            margin: 0
          }}
        >
          {selectedUser.displayName ||
            'User'}
        </h3>

        <p
          style={{
            margin:
              '0.2rem 0 0',
            fontSize:
              '0.9rem',
            opacity: 0.9
          }}
        >
          {selectedUser.email}
        </p>
      </div>

      {/* MESSAGES */}

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1rem',
          background: bgColor
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              textAlign:
                'center',
              color: darkMode
                ? '#666'
                : '#999',
              marginTop:
                '2rem'
            }}
          >
            <p>
              No messages yet.
              Start the
              conversation!
            </p>
          </div>
        ) : (
          messages.map(
            (msg) => (
              <div
                key={msg.id}
                style={{
                  marginBottom:
                    '1rem',
                  display:
                    'flex',
                  justifyContent:
                    msg.sender ===
                    currentUser.uid
                      ? 'flex-end'
                      : 'flex-start',
                  alignItems:
                    'flex-end'
                }}
              >
                <div
                  style={{
                    maxWidth:
                      '70%',
                    padding:
                      msg.type ===
                      'voice'
                        ? '0.6rem 0.8rem'
                        : '0.8rem 1rem',
                    borderRadius:
                      '15px',
                    background:
                      msg.sender ===
                      currentUser.uid
                        ? messageBgMe
                        : messageBgOther,
                    color:
                      msg.sender ===
                      currentUser.uid
                        ? messageTextMe
                        : messageTextOther,
                    wordBreak:
                      'break-word'
                  }}
                >
                  {/* TEXT */}

                  {msg.type ===
                  'text' ? (
                    <p
                      style={{
                        margin: 0
                      }}
                    >
                      {linkifyText(
                        msg.text
                      )}
                    </p>
                  ) : msg.type ===
                      'voice' &&
                    msg.audioUrl ? (
                    /* VOICE */

                    <div
                      style={{
                        display:
                          'flex',
                        alignItems:
                          'center',
                        gap: '0.6rem'
                      }}
                    >
                      <audio
                        controls
                        preload="metadata"
                        src={
                          msg.audioUrl
                        }
                        style={{
                          height:
                            '36px',
                          width:
                            '230px',
                          maxWidth:
                            '100%'
                        }}
                      />

                      <span
                        style={{
                          fontSize:
                            '0.75rem',
                          whiteSpace:
                            'nowrap'
                        }}
                      >
                        {formatTime(
                          Number(
                            msg.duration
                          ) || 0
                        )}
                      </span>
                    </div>
                  ) : msg.type ===
                    'voice' ? (
                    <p
                      style={{
                        margin: 0
                      }}
                    >
                      🎤 Voice
                      message
                      unavailable
                    </p>
                  ) : (
                    /* FILE */

                    <a
                      href={
                        msg.fileUrl
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color:
                          msg.sender ===
                          currentUser.uid
                            ? 'white'
                            : '#667eea',
                        textDecoration:
                          'underline'
                      }}
                    >
                      📎{' '}
                      {
                        msg.fileName
                      }
                    </a>
                  )}

                  {/* TIME + READ RECEIPT */}

                  <p
                    style={{
                      margin:
                        '0.3rem 0 0',
                      fontSize:
                        '0.7rem',
                      opacity:
                        0.75,
                      display:
                        'flex',
                      alignItems:
                        'center',
                      gap:
                        '0.3rem'
                    }}
                  >
                    {new Date(
                      msg.timestamp
                    ).toLocaleTimeString(
                      [],
                      {
                        hour: '2-digit',
                        minute:
                          '2-digit'
                      }
                    )}

                    {msg.sender ===
                      currentUser.uid && (
                      <span>
                        {msg.read
                          ? '✓✓'
                          : '✓'}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )
          )
        )}

        {/* TYPING */}

        {isTyping && (
          <div
            style={{
              marginBottom:
                '1rem',
              display:
                'flex',
              justifyContent:
                'flex-start'
            }}
          >
            <div
              style={{
                padding:
                  '0.8rem 1rem',
                borderRadius:
                  '15px',
                background:
                  messageBgOther,
                color:
                  messageTextOther
              }}
            >
              typing...
            </div>
          </div>
        )}

        <div
          ref={messagesEndRef}
        />
      </div>

      {/* ==========================
          VOICE REVIEW
          ========================== */}

      {showPreview &&
        recordedAudio && (
          <div
            style={{
              padding:
                '0.8rem 1rem',
              background:
                darkMode
                  ? '#2d2d2d'
                  : 'white',
              borderTop:
                `1px solid ${inputBorder}`,
              display:
                'flex',
              alignItems:
                'center',
              gap: '0.6rem'
            }}
          >
            <audio
              controls
              preload="metadata"
              src={
                recordedAudio.url
              }
              style={{
                flex: 1,
                minWidth: 0,
                height:
                  '40px'
              }}
            />

            {/* DELETE */}

            <button
              type="button"
              onClick={
                discardPreview
              }
              disabled={
                loading
              }
              title="Delete recording"
              style={{
                width: '42px',
                height: '42px',
                border:
                  'none',
                borderRadius:
                  '50%',
                background:
                  '#777',
                color:
                  'white',
                cursor:
                  'pointer',
                flexShrink: 0
              }}
            >
              🗑
            </button>

            {/* SEND */}

            <button
              type="button"
              onClick={
                sendVoiceMessage
              }
              disabled={
                loading
              }
              title="Send voice note"
              style={{
                width: '42px',
                height: '42px',
                border:
                  'none',
                borderRadius:
                  '50%',
                background:
                  '#667eea',
                color:
                  'white',
                cursor:
                  loading
                    ? 'not-allowed'
                    : 'pointer',
                opacity:
                  loading
                    ? 0.6
                    : 1,
                flexShrink: 0
              }}
            >
              ➤
            </button>
          </div>
        )}

      {/* ==========================
          MESSAGE / RECORDING BAR
          ========================== */}

      <div
        style={{
          padding:
            '0.8rem',
          background:
            inputBg,
          borderTop:
            `1px solid ${inputBorder}`,
          display:
            'flex',
          gap: '0.5rem',
          alignItems:
            'center',
          touchAction:
            'none'
        }}
      >
        {!isRecording ? (
          <>
            {/* MICROPHONE */}

            <button
              ref={
                micButtonRef
              }
              type="button"
              onPointerDown={
                handlePointerDown
              }
              onPointerMove={
                handlePointerMove
              }
              onPointerUp={
                handlePointerUp
              }
              onPointerCancel={
                handlePointerCancel
              }
              disabled={
                loading
              }
              title="Hold to record • swipe up to lock"
              style={{
                width: '48px',
                height: '48px',
                border:
                  'none',
                borderRadius:
                  '50%',
                background:
                  '#667eea',
                color:
                  'white',
                cursor:
                  loading
                    ? 'not-allowed'
                    : 'pointer',
                fontSize:
                  '1.3rem',
                flexShrink: 0,
                touchAction:
                  'none',
                userSelect:
                  'none',
                WebkitUserSelect:
                  'none',
                WebkitTouchCallout:
                  'none'
              }}
            >
              🎤
            </button>

            {/* TEXT INPUT */}

            <form
              onSubmit={
                handleSendMessage
              }
              style={{
                display:
                  'flex',
                flex: 1,
                gap:
                  '0.5rem'
              }}
            >
              <input
                id="message"
                name="message"
                type="text"
                value={
                  newMessage
                }
                onChange={
                  handleMessageChange
                }
                placeholder="Type a message..."
                disabled={
                  loading
                }
                autoComplete="off"
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding:
                    '0.8rem 1rem',
                  border:
                    `1px solid ${inputBorder}`,
                  borderRadius:
                    '20px',
                  fontSize:
                    '1rem',
                  background:
                    darkMode
                      ? '#333'
                      : 'white',
                  color:
                    textColor,
                  boxSizing:
                    'border-box'
                }}
              />

              <button
                type="submit"
                disabled={
                  loading ||
                  !newMessage.trim()
                }
                style={{
                  width:
                    '42px',
                  height:
                    '42px',
                  border:
                    'none',
                  borderRadius:
                    '50%',
                  background:
                    '#667eea',
                  color:
                    'white',
                  cursor:
                    'pointer',
                  opacity:
                    loading ||
                    !newMessage.trim()
                      ? 0.5
                      : 1,
                  flexShrink: 0
                }}
              >
                ➤
              </button>
            </form>
          </>
        ) : (
          /* ==========================
             ACTIVE RECORDING
             ========================== */

          <div
            style={{
              flex: 1,
              display:
                'flex',
              alignItems:
                'center',
              gap:
                '0.6rem',
              background:
                darkMode
                  ? '#333'
                  : '#f5f5f5',
              padding:
                '0.6rem 0.8rem',
              borderRadius:
                '22px',
              minWidth: 0
            }}
          >
            {/* TIME */}

            <span
              style={{
                color:
                  isPaused
                    ? '#ff9800'
                    : '#e74c3c',
                fontWeight:
                  'bold',
                minWidth:
                  '45px'
              }}
            >
              {formatTime(
                recordingTime
              )}
            </span>

            {/* WAVEFORM */}

            <div
              style={{
                flex: 1,
                height:
                  '30px',
                display:
                  'flex',
                alignItems:
                  'center',
                gap: '2px',
                overflow:
                  'hidden'
              }}
            >
              {waveformData.length >
              0
                ? waveformData.map(
                    (
                      value,
                      index
                    ) => (
                      <span
                        key={
                          index
                        }
                        style={{
                          width:
                            '3px',
                          minWidth:
                            '3px',
                          height: `${Math.max(
                            4,
                            Math.min(
                              28,
                              value /
                                5
                            )
                          )}px`,
                          borderRadius:
                            '2px',
                          background:
                            isPaused
                              ? '#ff9800'
                              : '#667eea'
                        }}
                      />
                    )
                  )
                : Array.from({
                    length: 25
                  }).map(
                    (
                      _,
                      index
                    ) => (
                      <span
                        key={
                          index
                        }
                        style={{
                          width:
                            '3px',
                          height:
                            '5px',
                          borderRadius:
                            '2px',
                          background:
                            '#bbb'
                        }}
                      />
                    )
                  )}
            </div>

            {/* CANCEL */}

            <button
              type="button"
              onClick={
                cancelRecording
              }
              title="Cancel recording"
              style={{
                width:
                  '38px',
                height:
                  '38px',
                border:
                  'none',
                borderRadius:
                  '50%',
                background:
                  '#e74c3c',
                color:
                  'white',
                cursor:
                  'pointer',
                flexShrink: 0
              }}
            >
              ✕
            </button>

            {/* PAUSE / RESUME */}

            <button
              type="button"
              onClick={
                pauseRecording
              }
              title={
                isPaused
                  ? 'Resume recording'
                  : 'Pause recording'
              }
              style={{
                width:
                  '38px',
                height:
                  '38px',
                border:
                  'none',
                borderRadius:
                  '50%',
                background:
                  '#ff9800',
                color:
                  'white',
                cursor:
                  'pointer',
                flexShrink: 0
              }}
            >
              {isPaused
                ? '▶'
                : 'Ⅱ'}
            </button>

            {/* LOCK / FINISH */}

            {isLocked ? (
              <button
                type="button"
                onClick={
                  finishRecording
                }
                title="Finish recording"
                style={{
                  width:
                    '42px',
                  height:
                    '42px',
                  border:
                    'none',
                  borderRadius:
                    '50%',
                  background:
                    '#4caf50',
                  color:
                    'white',
                  cursor:
                    'pointer',
                  fontSize:
                    '1.1rem',
                  flexShrink: 0
                }}
              >
                ✓
              </button>
            ) : (
              <div
                style={{
                  display:
                    'flex',
                  flexDirection:
                    'column',
                  alignItems:
                    'center',
                  justifyContent:
                    'center',
                  minWidth:
                    '48px'
                }}
              >
                <span
                  style={{
                    fontSize:
                      '1.3rem',
                    lineHeight: 1
                  }}
                >
                  🔒
                </span>

                <span
                  style={{
                    fontSize:
                      '0.65rem',
                    color:
                      darkMode
                        ? '#aaa'
                        : '#777',
                    whiteSpace:
                      'nowrap'
                  }}
                >
                  Swipe up
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
