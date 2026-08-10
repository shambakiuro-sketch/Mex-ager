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
  const [swipeDistance, setSwipeDistance] = useState(0);

  // Playback state
  const [playingMessageId, setPlayingMessageId] = useState(null);
  const [playbackProgress, setPlaybackProgress] = useState({});
  const [playbackDuration, setPlaybackDuration] = useState({});
  const [playbackSpeed, setPlaybackSpeed] = useState({});

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
  const audioPlayersRef = useRef({});
  const swipeStartRef = useRef({ y: 0 });

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
              cursor: 'pointer',
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

  // ========================================
  // FIREBASE SYNC
  // ========================================

  useEffect(() => {
    const messagesRef = ref(
      database,
      `${chatId}/messages`
    );

    const unsubscribeMessages = onValue(
      messagesRef,
      (snapshot) => {
        const data = snapshot.val();

        if (data) {
          const messageList = Object.entries(
            data
          ).map(([id, msg]) => ({
            id,
            ...msg
          }));

          setMessages(messageList);

          // Notification logic
          const lastMessage =
            messageList[
              messageList.length - 1
            ];

          if (
            lastMessage &&
            lastMessage.sender !==
              currentUser.uid &&
            lastMessage.id !==
              lastNotifiedRef.current
          ) {
            lastNotifiedRef.current =
              lastMessage.id;

            if (onMessageNotification) {
              const messageText =
                lastMessage.type ===
                'voice'
                  ? '🎤 Voice message'
                  : lastMessage.text;

              onMessageNotification(
                lastMessage.senderName ||
                  selectedUser.displayName,
                messageText,
                lastMessage.sender
              );
            }
          }

          messageList.forEach((msg) => {
            if (
              msg.sender !==
                currentUser.uid &&
              !msg.read
            ) {
              const msgRef = ref(
                database,
                `${chatId}/messages/${msg.id}`
              );

              update(msgRef, {
                read: true
              }).catch((error) =>
                console.error(
                  'Failed to mark message read:',
                  error
                )
              );
            }
          });

          scrollToBottom();
        }
      },
      (error) => {
        console.error(
          'Failed to load messages:',
          error
        );
      }
    );

    const typingRef = ref(
      database,
      `${chatId}/typing/${selectedUser.uid}`
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

  // ========================================
  // KEYBOARD SHORTCUTS
  // ========================================

  useEffect(() => {
    const handleKeyPress = (e) => {
      // Spacebar to play/pause current voice message
      if (e.code === 'Space' && playingMessageId) {
        e.preventDefault();
        const audio = audioPlayersRef.current[playingMessageId];
        if (audio) {
          if (audio.paused) {
            audio.play();
          } else {
            audio.pause();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [playingMessageId]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: 'smooth'
      });
    });
  };

  // ========================================
  // RECORDING HELPERS
  // ========================================

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

  // ========================================
  // START RECORDING
  // ========================================

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
      setSwipeDistance(0);

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

  // ========================================
  // FINISH RECORDING
  // ========================================

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

  // ========================================
  // CANCEL RECORDING
  // ========================================

  const cancelRecording = () => {
    const recorder =
      mediaRecorderRef.current;

    if (!recorder) {
      return;
    }

    try {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    } catch (error) {
      console.error(
        'Error stopping recorder:',
        error
      );
    }

    setIsRecording(false);
    setIsLocked(false);
    setRecordingTime(0);
    setShowPreview(false);
    setRecordedAudio(null);
    setSwipeDistance(0);

    stopMediaTracks();
  };

  // ========================================
  // TOUCH GESTURE HANDLERS (Mobile)
  // ========================================

  const handleRecordingTouchStart = (e) => {
    if (!isRecording || isLocked) return;
    recordingStartYRef.current = e.touches[0].clientY;
    swipeStartRef.current = { y: e.touches[0].clientY };
  };

  const handleRecordingTouchMove = (e) => {
    if (!isRecording || isLocked) return;
    
    const currentY = e.touches[0].clientY;
    const deltaY = recordingStartYRef.current - currentY;
    
    setSwipeDistance(Math.max(0, deltaY));
    
    // SWIPE UP 60px TO LOCK
    if (deltaY >= 60) {
      setIsLocked(true);
      setSwipeDistance(60);
    }
  };

  const handleRecordingTouchEnd = (e) => {
    if (!isRecording || isLocked) {
      setSwipeDistance(0);
      return;
    }
    
    if (swipeDistance < 60) {
      setSwipeDistance(0);
    }
  };

  // ========================================
  // PAUSE / RESUME
  // ========================================

  const pauseRecording = () => {
    const recorder =
      mediaRecorderRef.current;

    if (!recorder) {
      return;
    }

    try {
      if (isPaused) {
        if (
          recorder.state === 'paused'
        ) {
          recorder.resume();
        }

        setIsPaused(false);
      } else {
        if (
          recorder.state === 'recording'
        ) {
          recorder.pause();
        }

        setIsPaused(true);
      }
    } catch (error) {
      console.error(
        'Error pausing recorder:',
        error
      );
    }
  };

  // ========================================
  // GESTURE HANDLING - Swipe UP to Lock
  // ========================================

  const handleRecordingMouseDown = (e) => {
    if (!isRecording || isLocked) return;
    swipeStartRef.current = { y: e.clientY };
  };

  const handleRecordingMouseMove = (e) => {
    if (!isRecording || isLocked) return;

    const deltaY =
      swipeStartRef.current.y - e.clientY;

    setSwipeDistance(
      Math.max(0, deltaY)
    );

    // SWIPE UP 60px TO LOCK
    if (deltaY >= 60) {
      setIsLocked(true);
      setSwipeDistance(60);
    }
  };

  const handleRecordingMouseUp = () => {
    if (!isRecording || isLocked) {
      setSwipeDistance(0);
      return;
    }

    if (swipeDistance < 60) {
      setSwipeDistance(0);
    }
  };

  // ========================================
  // DISCARD PREVIEW
  // ========================================

  const discardPreview = () => {
    setShowPreview(false);
    setRecordedAudio(null);
    setRecordingTime(0);
  };

  // ========================================
  // SEND VOICE MESSAGE
  // ========================================

  const sendVoiceMessage = async () => {
    if (!recordedAudio) {
      return;
    }

    setLoading(true);

    try {
      const fileName =
        `voice_${Date.now()}`;

      const storageRef = ref(
        storage,
        `voices/${currentUser.uid}/${fileName}`
      );

      await uploadBytes(
        storageRef,
        recordedAudio.blob
      );

      const fileUrl =
        await getDownloadURL(
          storageRef
        );

      const messagesRef = ref(
        database,
        `${chatId}/messages`
      );

      const newMsg = push(
        messagesRef
      );

      await set(newMsg, {
        type: 'voice',
        sender:
          currentUser.uid,
        senderName:
          currentUser.displayName ||
          currentUser.email,
        timestamp:
          new Date().toISOString(),
        fileUrl: fileUrl,
        audioUrl: fileUrl,
        duration:
          recordedAudio.duration,
        read: false
      });

      discardPreview();

      const typingRef = ref(
        database,
        `${chatId}/typing/${currentUser.uid}`
      );

      set(typingRef, false);

      scrollToBottom();
    } catch (error) {
      console.error(
        'Error sending voice:',
        error
      );

      alert(
        'Failed to send voice message'
      );
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // VOICE PLAYBACK
  // ========================================

  const playVoiceMessage = (
    messageId,
    fileUrl
  ) => {
    // Stop other messages
    if (playingMessageId !== messageId) {
      if (
        audioPlayersRef.current[
          playingMessageId
        ]
      ) {
        audioPlayersRef.current[
          playingMessageId
        ].pause();
      }

      setPlayingMessageId(messageId);
      setPlaybackProgress({});
      setPlaybackSpeed({ [messageId]: 1 });

      const audio = new Audio(fileUrl);

      audio.onloadedmetadata = () => {
        setPlaybackDuration((prev) => ({
          ...prev,
          [messageId]: audio.duration
        }));
      };

      audio.ontimeupdate = () => {
        setPlaybackProgress((prev) => ({
          ...prev,
          [messageId]: audio.currentTime
        }));
      };

      audio.onended = () => {
        setPlayingMessageId(null);
        setPlaybackProgress({});
        setPlaybackSpeed({});
      };

      audio.playbackRate = playbackSpeed[messageId] || 1;
      audioPlayersRef.current[messageId] =
        audio;

      audio.play().catch((error) => {
        console.error('Playback error:', error);
        alert('Could not play voice message');
      });
    } else {
      // Toggle play/pause
      if (
        audioPlayersRef.current[messageId]
      ) {
        if (
          audioPlayersRef.current[messageId]
            .paused
        ) {
          audioPlayersRef.current[
            messageId
          ].play();
        } else {
          audioPlayersRef.current[
            messageId
          ].pause();
        }
      }
    }
  };

  // ========================================
  // CHANGE PLAYBACK SPEED
  // ========================================

  const changePlaybackSpeed = (messageId, speed) => {
    const audio = audioPlayersRef.current[messageId];
    
    if (audio) {
      audio.playbackRate = speed;
      setPlaybackSpeed((prev) => ({
        ...prev,
        [messageId]: speed
      }));
    }
  };

  // ========================================
  // SEEK IN VOICE MESSAGE
  // ========================================

  const seekVoiceMessage = (
    messageId,
    percentage
  ) => {
    if (
      audioPlayersRef.current[messageId]
    ) {
      const audio =
        audioPlayersRef.current[messageId];

      audio.currentTime =
        (percentage / 100) *
        audio.duration;
    }
  };

  // ========================================
  // COLORS
  // ========================================

  const messageBgOwn = '#667eea';
  const messageBgOther =
    darkMode ? '#333' : '#e9ecef';
  const messageTextOwn = 'white';
  const messageTextOther =
    darkMode ? '#e0e0e0' : '#333';
  const inputBg =
    darkMode ? '#2d2d2d' : '#f9f9f9';
  const inputBorder =
    darkMode ? '#444' : '#e0e0e0';

  // ========================================
  // RENDER
  // ========================================

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background:
          darkMode ? '#1a1a1a' : '#fff'
      }}
    >
      {/* HEADER */}

      <div
        style={{
          padding: '1rem',
          background: '#667eea',
          color: 'white',
          borderBottom: `1px solid ${inputBorder}`
        }}
      >
        <h3
          style={{
            margin: '0 0 0.3rem 0',
            fontSize: '1rem'
          }}
        >
          {selectedUser.displayName ||
            selectedUser.email}
        </h3>

        {isTyping && (
          <p
            style={{
              margin: 0,
              fontSize: '0.8rem',
              opacity: 0.8
            }}
          >
            typing...
          </p>
        )}
      </div>

      {/* MESSAGES */}

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.8rem'
        }}
      >
        {messages.map((msg) => {
          const isOwn =
            msg.sender ===
            currentUser.uid;

          const isVoice =
            msg.type === 'voice';

          const isPlaying =
            playingMessageId === msg.id;

          const progress =
            playbackProgress[msg.id] || 0;

          const duration =
            playbackDuration[msg.id] ||
            msg.duration ||
            0;

          const progressPercent =
            duration > 0
              ? (progress / duration) *
                100
              : 0;

          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent:
                  isOwn
                    ? 'flex-end'
                    : 'flex-start',
                alignItems:
                  'flex-end',
                gap: '0.5rem'
              }}
            >
              {!isOwn && (
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius:
                      '50%',
                    background:
                      '#667eea',
                    display:
                      'flex',
                    alignItems:
                      'center',
                    justifyContent:
                      'center',
                    color: 'white',
                    fontSize:
                      '0.75rem',
                    fontWeight:
                      'bold',
                    flexShrink: 0
                  }}
                >
                  {selectedUser.displayName?.charAt(
                    0
                  ) || '?'}
                </div>
              )}

              <div
                style={{
                  maxWidth: '75%',
                  background:
                    isOwn
                      ? messageBgOwn
                      : messageBgOther,
                  color:
                    isOwn
                      ? messageTextOwn
                      : messageTextOther,
                  padding:
                    isVoice
                      ? '0.5rem'
                      : '0.8rem 1rem',
                  borderRadius: '12px',
                  wordWrap: 'break-word'
                }}
              >
                {isVoice ? (
                  // VOICE MESSAGE UI - ENHANCED WITH SPEED CONTROL
                  <div
                    style={{
                      padding:
                        '0.5rem 0.8rem',
                      display: 'flex',
                      alignItems:
                        'center',
                      gap: '0.8rem',
                      minWidth:
                        '240px'
                    }}
                  >
                    {/* PLAY BUTTON */}

                    <button
                      onClick={() =>
                        playVoiceMessage(
                          msg.id,
                          msg.fileUrl || msg.audioUrl
                        )
                      }
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius:
                          '50%',
                        background:
                          'rgba(255,255,255,0.3)',
                        border:
                          'none',
                        color: 'inherit',
                        cursor:
                          'pointer',
                        fontSize:
                          '1.2rem',
                        display:
                          'flex',
                        alignItems:
                          'center',
                        justifyContent:
                          'center',
                        flexShrink: 0,
                        transition:
                          'all 0.2s'
                      }}
                      onMouseEnter={(
                        e
                      ) =>
                        (e.currentTarget.style.background =
                          'rgba(255,255,255,0.4)')
                      }
                      onMouseLeave={(
                        e
                      ) =>
                        (e.currentTarget.style.background =
                          'rgba(255,255,255,0.3)')
                      }
                      title={
                        isPlaying
                          ? 'Pause'
                          : 'Play'
                      }
                    >
                      {isPlaying
                        ? '⏸'
                        : '▶'}
                    </button>

                    {/* PROGRESS BAR & CONTROLS */}

                    <div
                      style={{
                        flex: 1,
                        display:
                          'flex',
                        flexDirection:
                          'column',
                        gap: '0.4rem'
                      }}
                    >
                      <div
                        style={{
                          height: '4px',
                          background:
                            'rgba(255,255,255,0.2)',
                          borderRadius:
                            '2px',
                          cursor:
                            'pointer',
                          position:
                            'relative',
                          overflow:
                            'hidden'
                        }}
                        onClick={(
                          e
                        ) => {
                          const rect =
                            e.currentTarget.getBoundingClientRect();
                          const pct =
                            ((e.clientX -
                              rect.left) /
                              rect.width) *
                            100;
                          seekVoiceMessage(
                            msg.id,
                            pct
                          );
                        }}
                      >
                        <div
                          style={{
                            height:
                              '100%',
                            background:
                              'rgba(255,255,255,0.7)',
                            width: `${progressPercent}%`,
                            transition:
                              isPlaying
                                ? 'width 0.1s linear'
                                : 'width 0.3s'
                          }}
                        />
                      </div>

                      {/* TIME & SPEED CONTROLS */}

                      <div
                        style={{
                          fontSize:
                            '0.75rem',
                          opacity: 0.8,
                          display:
                            'flex',
                          justifyContent:
                            'space-between',
                          alignItems:
                            'center',
                          gap: '0.5rem'
                        }}
                      >
                        <span>
                          {formatTime(
                            Math.floor(
                              progress
                            )
                          )}{' '}
                          /{' '}
                          {formatTime(
                            Math.floor(
                              duration
                            )
                          )}
                        </span>

                        {/* SPEED BUTTONS (only show during playback) */}
                        {isPlaying && (
                          <div
                            style={{
                              display:
                                'flex',
                              gap:
                                '0.3rem'
                            }}
                          >
                            {[1, 1.5, 2].map(
                              (speed) => (
                                <button
                                  key={
                                    speed
                                  }
                                  onClick={() =>
                                    changePlaybackSpeed(
                                      msg.id,
                                      speed
                                    )
                                  }
                                  style={{
                                    padding:
                                      '0.15rem 0.35rem',
                                    border:
                                      playbackSpeed[
                                        msg.id
                                      ] ===
                                      speed
                                        ? '1px solid white'
                                        : 'none',
                                    background:
                                      playbackSpeed[
                                        msg.id
                                      ] ===
                                      speed
                                        ? 'rgba(255,255,255,0.2)'
                                        : 'transparent',
                                    color:
                                      'inherit',
                                    borderRadius:
                                      '3px',
                                    cursor:
                                      'pointer',
                                    fontSize:
                                      '0.7rem',
                                    fontWeight:
                                      '600',
                                    transition:
                                      'all 0.2s'
                                  }}
                                  onMouseEnter={(
                                    e
                                  ) =>
                                    (e.currentTarget.style.opacity =
                                      '0.8')
                                  }
                                  onMouseLeave={(
                                    e
                                  ) =>
                                    (e.currentTarget.style.opacity =
                                      '1')
                                  }
                                  title={`Play at ${speed}x speed`}
                                >
                                  {speed}x
                                </button>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* DOWNLOAD BUTTON */}
                    <a
                      href={msg.fileUrl}
                      download={`voice_${msg.id}.webm`}
                      style={{
                        color: 'inherit',
                        fontSize:
                          '1rem',
                        textDecoration:
                          'none',
                        cursor:
                          'pointer',
                        flexShrink: 0,
                        opacity: 0.8,
                        transition:
                          'opacity 0.2s'
                      }}
                      onMouseEnter={(
                        e
                      ) =>
                        (e.currentTarget.style.opacity =
                          '0.6')
                      }
                      onMouseLeave={(
                        e
                      ) =>
                        (e.currentTarget.style.opacity =
                          '0.8')
                      }
                      title={
                        'Download voice message'
                      }
                    >
                      ⬇️
                    </a>
                  </div>
                ) : (
                  // TEXT MESSAGE
                  <p
                    style={{
                      margin: 0,
                      wordBreak:
                        'break-word'
                    }}
                  >
                    {linkifyText(msg.text)}
                  </p>
                )}

                {/* TIMESTAMP */}

                <p
                  style={{
                    margin:
                      '0.4rem 0 0 0',
                    fontSize: '0.7rem',
                    opacity: 0.75,
                    display: 'flex',
                    alignItems:
                      'center',
                    gap: '0.3rem',
                    justifyContent:
                      isVoice
                        ? 'center'
                        : 'flex-start'
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

                  {isOwn && (
                    <span>
                      {msg.read
                        ? '✓✓'
                        : '✓'}
                    </span>
                  )}
                </p>
              </div>
            </div>
          );
        })}

        {/* TYPING */}

        {isTyping && (
          <div
            style={{
              marginBottom: '1rem',
              display: 'flex',
              justifyContent:
                'flex-start'
            }}
          >
            <div
              style={{
                padding: '0.8rem 1rem',
                borderRadius: '15px',
                background:
                  messageBgOther,
                color: messageTextOther
              }}
            >
              typing...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* VOICE PREVIEW */}

      {showPreview &&
        recordedAudio && (
          <div
            style={{
              padding: '0.8rem 1rem',
              background: inputBg,
              borderTop: `1px solid ${inputBorder}`,
              display: 'flex',
              alignItems: 'center',
              gap: '0.8rem'
            }}
          >
            {/* LISTEN BUTTON */}

            <button
              type="button"
              onClick={() => {
                const audio =
                  new Audio(
                    recordedAudio.url
                  );
                audio.play();
              }}
              title="Listen to recording"
              style={{
                width: '42px',
                height: '42px',
                border: 'none',
                borderRadius: '50%',
                background:
                  '#667eea',
                color: 'white',
                cursor: 'pointer',
                fontSize: '1.2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent:
                  'center',
                flexShrink: 0
              }}
            >
              🎧
            </button>

            {/* DURATION */}

            <span
              style={{
                fontSize: '0.85rem',
                fontWeight: 'bold',
                minWidth: '45px'
              }}
            >
              {formatTime(
                recordedAudio.duration
              )}
            </span>

            {/* DELETE BUTTON */}

            <button
              type="button"
              onClick={
                discardPreview
              }
              disabled={loading}
              title="Delete recording"
              style={{
                width: '42px',
                height: '42px',
                border: 'none',
                borderRadius: '50%',
                background:
                  '#e74c3c',
                color: 'white',
                cursor:
                  loading
                    ? 'not-allowed'
                    : 'pointer',
                fontSize: '1.2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent:
                  'center',
                flexShrink: 0,
                opacity:
                  loading ? 0.6 : 1
              }}
            >
              🗑
            </button>

            {/* SEND BUTTON */}

            <button
              type="button"
              onClick={
                sendVoiceMessage
              }
              disabled={loading}
              title="Send voice message"
              style={{
                flex: 1,
                padding: '0.8rem',
                border: 'none',
                borderRadius: '8px',
                background:
                  '#4caf50',
                color: 'white',
                cursor:
                  loading
                    ? 'not-allowed'
                    : 'pointer',
                fontWeight: 'bold',
                opacity:
                  loading ? 0.6 : 1
              }}
            >
              ➤ Send
            </button>
          </div>
        )}

      {/* INPUT AREA */}

      <div
        style={{
          padding: '0.8rem 1rem',
          background: inputBg,
          borderTop: `1px solid ${inputBorder}`,
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem'
        }}
        onMouseMove={
          handleRecordingMouseMove
        }
        onMouseUp={
          handleRecordingMouseUp
        }
        onMouseLeave={
          handleRecordingMouseUp
        }
      >
        {!isRecording ? (
          <>
            {/* MIC BUTTON */}

            <button
              ref={micButtonRef}
              type="button"
              onMouseDown={
                startRecording
              }
              disabled={loading}
              title="Hold to record voice message"
              style={{
                width: '42px',
                height: '42px',
                border: 'none',
                borderRadius: '50%',
                background:
                  '#667eea',
                color: 'white',
                cursor:
                  loading
                    ? 'not-allowed'
                    : 'pointer',
                fontSize: '1.3rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent:
                  'center',
                flexShrink: 0
              }}
            >
              🎤
            </button>

            {/* TEXT INPUT */}

            <form
              onSubmit={(e) => {
                e.preventDefault();

                if (
                  !newMessage.trim()
                ) {
                  return;
                }

                setLoading(true);

                try {
                  const messagesRef =
                    ref(
                      database,
                      `${chatId}/messages`
                    );

                  const newMsg = push(
                    messagesRef
                  );

                  set(newMsg, {
                    type: 'text',
                    text: newMessage,
                    sender:
                      currentUser.uid,
                    senderName:
                      currentUser.displayName ||
                      currentUser.email,
                    timestamp:
                      new Date().toISOString(),
                    read: false
                  });

                  setNewMessage('');

                  const typingRef = ref(
                    database,
                    `${chatId}/typing/${currentUser.uid}`
                  );

                  set(typingRef, false);

                  scrollToBottom();
                } catch (error) {
                  console.error(
                    'Error sending text:',
                    error
                  );
                } finally {
                  setLoading(false);
                }
              }}
              style={{
                display: 'flex',
                flex: 1,
                gap: '0.6rem'
              }}
            >
              <input
                type="text"
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(
                    e.target.value
                  );

                  const typingRef =
                    ref(
                      database,
                      `${chatId}/typing/${currentUser.uid}`
                    );

                  set(typingRef, true);

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
                      );
                    }, 1000);
                }}
                placeholder="Type a message..."
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '0.8rem',
                  border: `1px solid ${inputBorder}`,
                  borderRadius:
                    '20px',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  background:
                    darkMode
                      ? '#333'
                      : 'white',
                  color:
                    darkMode
                      ? '#e0e0e0'
                      : '#333'
                }}
              />

              <button
                type="submit"
                disabled={
                  loading ||
                  !newMessage.trim()
                }
                title="Send message"
                style={{
                  width: '42px',
                  height: '42px',
                  border: 'none',
                  borderRadius: '50%',
                  background:
                    '#667eea',
                  color: 'white',
                  cursor:
                    loading ||
                    !newMessage.trim()
                      ? 'not-allowed'
                      : 'pointer',
                  fontSize: '1.2rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent:
                    'center',
                  flexShrink: 0,
                  opacity:
                    loading ||
                    !newMessage.trim()
                      ? 0.6
                      : 1
                }}
              >
                ➤
              </button>
            </form>
          </>
        ) : (
          // ACTIVE RECORDING UI
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              background:
                darkMode
                  ? '#333'
                  : '#f5f5f5',
              padding: '0.6rem 0.8rem',
              borderRadius: '22px',
              minWidth: 0
            }}
            onMouseDown={
              handleRecordingMouseDown
            }
            onTouchStart={
              handleRecordingTouchStart
            }
            onTouchMove={
              handleRecordingTouchMove
            }
            onTouchEnd={
              handleRecordingTouchEnd
            }
          >
            {/* TIMER */}

            <span
              style={{
                color:
                  isPaused
                    ? '#ff9800'
                    : '#e74c3c',
                fontWeight: 'bold',
                minWidth: '45px'
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
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                overflow:
                  'hidden'
              }}
            >
              {waveformData.length >
              0
                ? waveformData.map(
                    (value, index) => (
                      <span
                        key={index}
                        style={{
                          width: '3px',
                          minWidth:
                            '3px',
                          height: `${Math.max(
                            4,
                            Math.min(
                              28,
                              value / 5
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
                    (_, index) => (
                      <span
                        key={index}
                        style={{
                          width: '3px',
                          height: '5px',
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
                width: '38px',
                height: '38px',
                border: 'none',
                borderRadius: '50%',
                background:
                  '#e74c3c',
                color: 'white',
                cursor: 'pointer',
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
                width: '38px',
                height: '38px',
                border: 'none',
                borderRadius: '50%',
                background:
                  '#ff9800',
                color: 'white',
                cursor: 'pointer',
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
                  width: '42px',
                  height: '42px',
                  border: 'none',
                  borderRadius: '50%',
                  background:
                    '#4caf50',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '1.1rem',
                  flexShrink: 0,
                  animation:
                    'pulse 1.5s infinite'
                }}
              >
                ✓
              </button>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection:
                    'column',
                  alignItems: 'center',
                  justifyContent:
                    'center',
                  minWidth: '48px'
                }}
              >
                <span
                  style={{
                    fontSize: '1.3rem',
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
                  Swipe up 60px
                </span>

                {/* VISUAL INDICATOR */}

                {swipeDistance >
                  0 && (
                  <div
                    style={{
                      width: '24px',
                      height:
                        '3px',
                      background:
                        '#667eea',
                      borderRadius:
                        '2px',
                      marginTop:
                        '0.3rem',
                      opacity:
                        Math.min(
                          1,
                          swipeDistance /
                            60
                        )
                    }}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
