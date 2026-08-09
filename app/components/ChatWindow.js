'use client';

import { useEffect, useRef, useState } from 'react';
import { auth, database, storage } from '../lib/firebase';
import { ref, onValue, push, set, update } from 'firebase/database';
import { getDownloadURL, uploadBytes } from 'firebase/storage';

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

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [waveformData, setWaveformData] = useState([]);
  const [isHoldingMic, setIsHoldingMic] = useState(false);

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

  const pointerIdRef = useRef(null);
  const pointerDownRef = useRef(false);
  const recordingStartedRef = useRef(false);
  const lockTriggeredRef = useRef(false);

  const getChatId = (uid1, uid2) => {
    const ids = [uid1, uid2].sort();
    return `chats/${ids.join('_')}`;
  };

  const chatId = getChatId(currentUser.uid, selectedUser.uid);

  const formatTime = (seconds) => {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const mins = Math.floor(total / 60);
    const secs = total % 60;

    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: 'smooth'
      });
    });
  };

  const cleanupRecordingResources = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    analyserRef.current = null;

    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) => track.stop());

      streamRef.current = null;
    }
  };

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
          setLoading(false);
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
        setLoading(false);

        const lastMessage =
          messageList[messageList.length - 1];

        if (
          lastMessage &&
          lastMessage.sender !== currentUser.uid &&
          lastMessage.id !== lastNotifiedRef.current
        ) {
          lastNotifiedRef.current = lastMessage.id;

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

        setLoading(false);
      }
    );

    const unsubscribeTyping = onValue(
      typingRef,
      (snapshot) => {
        setIsTyping(snapshot.val() === true);
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
        clearTimeout(typingTimeoutRef.current);
      }

      cleanupRecordingResources();
    };
  }, [
    chatId,
    selectedUser.uid,
    currentUser.uid
  ]);

  const getSupportedMimeType = () => {
    if (typeof MediaRecorder === 'undefined') {
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

      const dataArray = new Uint8Array(
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
          Array.from(dataArray).slice(0, 32)
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

  const startRecording = async () => {
    if (
      recordingStartedRef.current ||
      loading
    ) {
      return;
    }

    if (
      !navigator.mediaDevices?.getUserMedia
    ) {
      alert(
        'Your browser does not support microphone recording.'
      );

      return;
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            audio: true
          }
        );

      const mimeType =
        getSupportedMimeType();

      if (
        typeof MediaRecorder ===
          'undefined' ||
        !mimeType
      ) {
        stream
          .getTracks()
          .forEach((track) =>
            track.stop()
          );

        alert(
          'This browser cannot record audio in a supported format.'
        );

        return;
      }

      audioChunksRef.current = [];

      recordingStartedRef.current = true;

      setRecordingTime(0);
      setIsRecording(true);
      setIsLocked(false);
      setIsPaused(false);
      setShowPreview(false);
      setRecordedAudio(null);
      setWaveformData([]);

      streamRef.current = stream;

      startWaveform(stream);

      const recorder = new MediaRecorder(
        stream,
        {
          mimeType
        }
      );

      mediaRecorderRef.current =
        recorder;

      recorder.ondataavailable = (
        event
      ) => {
        if (event.data?.size > 0) {
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

      recorder.start(100);

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
        'Error accessing microphone:',
        error
      );

      recordingStartedRef.current =
        false;

      if (
        error.name ===
        'NotAllowedError'
      ) {
        alert(
          'Microphone permission was denied. Allow microphone access and try again.'
        );
      } else if (
        error.name ===
        'NotFoundError'
      ) {
        alert(
          'No microphone was found on this device.'
        );
      } else {
        alert(
          'Could not start microphone recording.'
        );
      }

      setIsRecording(false);

      cleanupRecordingResources();
    }
  };

  const finishRecording = () => {
    const recorder =
      mediaRecorderRef.current;

    if (!recorder) {
      return;
    }

    const finish = () => {
      const mimeType =
        recorder.mimeType ||
        'audio/webm';

      const blob = new Blob(
        audioChunksRef.current,
        {
          type: mimeType
        }
      );

      recordingStartedRef.current =
        false;

      pointerDownRef.current = false;

      if (!blob.size) {
        setIsRecording(false);
        setIsLocked(false);
        setIsPaused(false);

        cleanupRecordingResources();

        alert(
          'No audio was recorded.'
        );

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

      cleanupRecordingResources();
    };

    recorder.onstop = finish;

    try {
      if (
        recorder.state !==
        'inactive'
      ) {
        recorder.stop();
      } else {
        finish();
      }
    } catch (error) {
      console.error(
        'Failed to stop recording:',
        error
      );

      finish();
    }
  };

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

    cleanupRecordingResources();

    recordingStartedRef.current =
      false;

    pointerDownRef.current = false;

    setIsRecording(false);
    setIsLocked(false);
    setIsPaused(false);
    setRecordingTime(0);
    setRecordedAudio(null);
    setShowPreview(false);
    setWaveformData([]);
  };

  const pauseRecording = () => {
    const recorder =
      mediaRecorderRef.current;

    if (
      !recorder ||
      !isRecording
    ) {
      return;
    }

    try {
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
    } catch (error) {
      console.error(
        'Pause/resume error:',
        error
      );
    }
  };

  const discardPreview = () => {
    if (recordedAudio?.url) {
      URL.revokeObjectURL(
        recordedAudio.url
      );
    }

    setRecordedAudio(null);
    setShowPreview(false);
    setRecordingTime(0);
  };

  const sendVoiceMessage =
    async () => {
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

        const messagesRef =
          ref(
            database,
            `${chatId}/messages`
          );

        const newMsg =
          push(messagesRef);

        await set(newMsg, {
          text: 'Voice message',
          sender: currentUser.uid,
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

    if (typingTimeoutRef.current) {
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

      const messagesRef =
        ref(
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
   * HOLD TO RECORD
   *
   * Press and hold microphone:
   * - recording starts
   *
   * Move finger/mouse upward:
   * - recording locks
   *
   * Release without locking:
   * - recording finishes
   *
   * Once locked:
   * - releasing does NOT stop recording
   * - use ✓ to finish
   */

  const handlePointerDown = (
    event
  ) => {
    if (
      event.pointerType === 'mouse' &&
      event.button !== 0
    ) {
      return;
    }

    if (
      loading ||
      showPreview ||
      recordingStartedRef.current
    ) {
      return;
    }

    event.preventDefault();

    pointerDownRef.current = true;

    pointerIdRef.current =
      event.pointerId;

    lockTriggeredRef.current =
      false;

    setIsHoldingMic(true);

    try {
      micButtonRef.current?.setPointerCapture?.(
        event.pointerId
      );
    } catch (error) {
      console.warn(
        'Pointer capture unavailable:',
        error
      );
    }

    startRecording();
  };

  const handlePointerMove = (
    event
  ) => {
    if (
      !pointerDownRef.current ||
      !isRecording ||
      isLocked ||
      lockTriggeredRef.current
    ) {
      return;
    }

    const rect =
      micButtonRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const distanceUp =
      rect.top - event.clientY;

    /*
     * 60px is deliberately used instead of
     * 80px so the lock is easier to trigger
     * on phones and touch screens.
     */
    if (distanceUp >= 60) {
      lockTriggeredRef.current =
        true;

      setIsLocked(true);
      setIsHoldingMic(false);

      try {
        micButtonRef.current?.releasePointerCapture?.(
          event.pointerId
        );
      } catch (error) {
        // Ignore pointer capture errors.
      }
    }
  };

  const handlePointerUp = (
    event
  ) => {
    if (
      event.pointerId !==
      pointerIdRef.current
    ) {
      return;
    }

    pointerDownRef.current = false;

    setIsHoldingMic(false);

    /*
     * If recording was locked, releasing
     * the finger must NOT stop it.
     */
    if (isLocked) {
      return;
    }

    if (isRecording) {
      finishRecording();
    }

    try {
      micButtonRef.current?.releasePointerCapture?.(
        event.pointerId
      );
    } catch (error) {
      // Ignore pointer capture errors.
    }
  };

  const handlePointerCancel = () => {
    pointerDownRef.current = false;

    setIsHoldingMic(false);

    if (
      isRecording &&
      !isLocked
    ) {
      cancelRecording();
    }
  };

  const handleMicContextMenu = (
    event
  ) => {
    event.preventDefault();
  };

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
        background: bgColor
      }}
    >
      {/* Header */}

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
          {selectedUser.displayName}
        </h3>

        <p
          style={{
            margin:
              '0.2rem 0 0',
            fontSize: '0.9rem',
            opacity: 0.9
          }}
        >
          {selectedUser.email}
        </p>
      </div>

      {/* Messages */}

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
              textAlign: 'center',
              color: darkMode
                ? '#666'
                : '#999',
              marginTop: '2rem'
            }}
          >
            <p>
              No messages yet.
              Start the conversation!
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                marginBottom: '1rem',
                display: 'flex',
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
                  maxWidth: '70%',
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
                  <div
                    style={{
                      display: 'flex',
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
                    🎤 Voice message
                    unavailable
                  </p>
                ) : (
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
                    {msg.fileName}
                  </a>
                )}

                <p
                  style={{
                    margin:
                      '0.3rem 0 0',
                    fontSize:
                      '0.7rem',
                    opacity: 0.75,
                    display: 'flex',
                    alignItems:
                      'center',
                    gap: '0.3rem'
                  }}
                >
                  {new Date(
                    msg.timestamp
                  ).toLocaleTimeString(
                    [],
                    {
                      hour: '2-digit',
                      minute: '2-digit'
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
          ))
        )}

        {/* Typing indicator */}

        {isTyping && (
          <div
            style={{
              marginBottom:
                '1rem',
              display: 'flex',
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

      {/* Voice preview */}

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

              display: 'flex',
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
                height: '38px'
              }}
            />

            <button
              type="button"
              onClick={
                discardPreview
              }
              disabled={loading}
              title="Discard recording"
              style={{
                width: '40px',
                height: '40px',
                border: 'none',
                borderRadius:
                  '50%',
                background:
                  '#777',
                color:
                  'white',
                cursor: loading
                  ? 'not-allowed'
                  : 'pointer',
                flexShrink: 0
              }}
            >
              ✕
            </button>

            <button
              type="button"
              onClick={
                sendVoiceMessage
              }
              disabled={loading}
              title="Send voice note"
              style={{
                width: '40px',
                height: '40px',
                border: 'none',
                borderRadius:
                  '50%',
                background:
                  '#667eea',
                color:
                  'white',
                cursor: loading
                  ? 'not-allowed'
                  : 'pointer',
                flexShrink: 0
              }}
            >
              {loading
                ? '⌛'
                : '➤'}
            </button>
          </div>
        )}

      {/* Composer */}

      <div
        style={{
          padding: '0.8rem',
          background: inputBg,
          borderTop:
            `1px solid ${inputBorder}`,
          display: 'flex',
          gap: '0.5rem',
          alignItems:
            'center',
          touchAction: 'none',
          userSelect: 'none'
        }}
      >
        {!isRecording ? (
          <>
            <button
              ref={micButtonRef}
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
              onContextMenu={
                handleMicContextMenu
              }
              disabled={
                loading ||
                showPreview
              }
              title="Hold to record • swipe up to lock"
              aria-label="Hold to record voice message"
              style={{
                width: '42px',
                height: '42px',
                border: 'none',
                borderRadius:
                  '50%',
                background:
                  '#667eea',
                color:
                  'white',
                cursor:
                  loading ||
                  showPreview
                    ? 'not-allowed'
                    : 'pointer',
                fontSize:
                  '1.2rem',
                flexShrink: 0,
                touchAction:
                  'none',
                WebkitUserSelect:
                  'none',
                userSelect:
                  'none'
              }}
            >
              🎤
            </button>

            <form
              onSubmit={
                handleSendMessage
              }
              style={{
                display: 'flex',
                flex: 1,
                gap: '0.5rem'
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
                disabled={loading}
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
                    'border-box',
                  userSelect:
                    'text'
                }}
              />

              <button
                type="submit"
                disabled={
                  loading ||
                  !newMessage.trim()
                }
                style={{
                  width: '42px',
                  height: '42px',
                  border: 'none',
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
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems:
                'center',
              gap: '0.6rem',
              background:
                darkMode
                  ? '#333'
                  : '#f5f5f5',
              padding:
                '0.6rem 0.8rem',
              borderRadius:
                '22px',
              minWidth: 0,
              boxSizing:
                'border-box'
            }}
          >
            {/* Timer */}

            <span
              style={{
                color:
                  isPaused
                    ? '#ff9800'
                    : '#e74c3c',
                fontWeight:
                  'bold',
                minWidth:
                  '45px',
                fontVariantNumeric:
                  'tabular-nums'
              }}
            >
              {formatTime(
                recordingTime
              )}
            </span>

            {/* Waveform */}

            <div
              style={{
                flex: 1,
                height: '30px',
                display: 'flex',
                alignItems:
                  'center',
                gap: '2px',
                overflow:
                  'hidden',
                minWidth: 0
              }}
            >
              {waveformData.length ? (
                waveformData.map(
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
                        height:
                          `${Math.max(
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
              ) : (
                Array.from({
                  length: 32
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
                )
              )}
            </div>

            {/* Cancel */}

            <button
              type="button"
              onClick={
                cancelRecording
              }
              title="Cancel recording"
              aria-label="Cancel recording"
              style={{
                width: '36px',
                height: '36px',
                border: 'none',
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

            {/* Pause / Resume */}

            <button
              type="button"
              onClick={
                pauseRecording
              }
              title={
                isPaused
                  ? 'Resume'
                  : 'Pause'
              }
              aria-label={
                isPaused
                  ? 'Resume recording'
                  : 'Pause recording'
              }
              style={{
                width: '36px',
                height: '36px',
                border: 'none',
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

            {/* Finish after lock */}

            {isLocked && (
              <button
                type="button"
                onClick={
                  finishRecording
                }
                title="Finish recording"
                aria-label="Finish recording"
                style={{
                  width: '36px',
                  height: '36px',
                  border: 'none',
                  borderRadius:
                    '50%',
                  background:
                    '#4caf50',
                  color:
                    'white',
                  cursor:
                    'pointer',
                  flexShrink: 0
                }}
              >
                ✓
              </button>
            )}

            {/* Lock status */}

            <span
              style={{
                fontSize:
                  '0.7rem',
                color:
                  darkMode
                    ? '#aaa'
                    : '#777',
                whiteSpace:
                  'nowrap'
              }}
            >
              {isLocked
                ? '🔒 Locked'
                : '↑ Lock'}
            </span>
          </div>
        )}
      </div>

      {/* Swipe hint */}

      {isHoldingMic &&
        isRecording &&
        !isLocked && (
          <div
            style={{
              position:
                'fixed',
              bottom: '75px',
              left: '50%',
              transform:
                'translateX(-50%)',
              padding:
                '0.45rem 0.8rem',
              borderRadius:
                '20px',
              background:
                'rgba(0,0,0,0.75)',
              color:
                'white',
              fontSize:
                '0.75rem',
              zIndex: 1000,
              pointerEvents:
                'none'
            }}
          >
            ↑ Swipe up to lock
          </div>
        )}
    </div>
  );
}
