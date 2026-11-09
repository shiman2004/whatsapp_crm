import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Mic, Pin, Star, Check, CheckCheck, Clock, AlertCircle, Download } from 'lucide-react';
import { WhatsAppAvatar } from './WhatsAppAvatar';
import { Message } from '../../types';
import { API_BASE_URL } from '../../config/api';

interface WhatsAppVoiceNotePlayerProps {
  message: Message;
  senderName?: string;
  senderAvatar?: string;
  isOutbound: boolean;
}

// WhatsApp-like randomized bar heights (32 bars for realistic audio waveform)
const DEFAULT_WAVEFORM_HEIGHTS = [
  6, 12, 18, 8, 14, 22, 16, 26, 12, 18, 24, 14, 20, 28, 16, 22,
  10, 18, 26, 14, 20, 16, 24, 12, 18, 22, 14, 20, 10, 16, 12, 6
];

export const WhatsAppVoiceNotePlayer: React.FC<WhatsAppVoiceNotePlayerProps> = ({
  message,
  senderName = 'Contact',
  senderAvatar,
  isOutbound
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformTrackRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const animFrameRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isLoaded, setIsLoaded] = useState(false);
  const [waveformHeights, setWaveformHeights] = useState<number[]>(DEFAULT_WAVEFORM_HEIGHTS);

  // Normalize media URL to absolute path with auth token if required
  const rawUrl = message.media?.url || '';
  const token = typeof window !== 'undefined' ? (localStorage.getItem('token') || '') : '';
  let audioUrl = rawUrl;
  if (audioUrl) {
    if (audioUrl.startsWith('/') && !audioUrl.startsWith('//')) {
      audioUrl = `${API_BASE_URL}${audioUrl}`;
    }
    if (audioUrl.includes('/api/media/') && !audioUrl.includes('sig=') && !audioUrl.includes('token=') && token) {
      audioUrl = `${audioUrl}${audioUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
    }
  }

  // 1. Decode audio using Web Audio API to obtain true duration & real waveform amplitude
  useEffect(() => {
    if (!audioUrl) return;

    let isCancelled = false;

    const decodeAudioWaveform = async () => {
      try {
        const res = await fetch(audioUrl);
        if (!res.ok) return;

        const arrayBuffer = await res.arrayBuffer();
        if (isCancelled || !arrayBuffer.byteLength) return;

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;

        const ctx = new AudioCtx();
        try {
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
          if (isCancelled || !audioBuffer) return;

          const exactDuration = audioBuffer.duration;
          if (exactDuration && isFinite(exactDuration) && exactDuration > 0) {
            setDuration(exactDuration);
            setIsLoaded(true);
          }

          // Sample 32 waveform bars from the decoded audio channel
          const rawData = audioBuffer.getChannelData(0);
          const samples = 32;
          const blockSize = Math.floor(rawData.length / samples);
          if (blockSize > 0) {
            const filteredData: number[] = [];
            for (let i = 0; i < samples; i++) {
              const blockStart = blockSize * i;
              let sum = 0;
              for (let j = 0; j < blockSize; j++) {
                sum += Math.abs(rawData[blockStart + j]);
              }
              filteredData.push(sum / blockSize);
            }

            const maxVal = Math.max(...filteredData);
            if (maxVal > 0) {
              const multiplier = 1 / maxVal;
              const heights = filteredData.map(val => {
                const h = Math.round(val * multiplier * 24) + 6;
                return Math.max(6, Math.min(28, isNaN(h) ? 12 : h));
              });
              if (heights.length === 32) {
                setWaveformHeights(heights);
              }
            }
          }
        } finally {
          ctx.close().catch(() => {});
        }
      } catch (err) {
        // Fallback gracefully to HTML5 audio element duration
      }
    };

    decodeAudioWaveform();

    return () => {
      isCancelled = true;
    };
  }, [audioUrl]);

  // 2. HTML5 Audio element listeners with Chromium OGG Opus duration workaround
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateFiniteDuration = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration) && audio.duration > 0) {
        setDuration(prev => (prev > 0 ? prev : audio.duration));
        setIsLoaded(true);
      } else if (audio.duration === Infinity) {
        // Chromium OGG Opus workaround: seek to the end to force Chromium to parse the last granule
        const onSeeked = () => {
          audio.removeEventListener('seeked', onSeeked);
          if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
            setDuration(prev => (prev > 0 ? prev : audio.duration));
            setIsLoaded(true);
          }
          audio.currentTime = 0;
        };
        audio.addEventListener('seeked', onSeeked);
        audio.currentTime = 1e101;
      }
    };

    const handleTimeUpdate = () => {
      if (!isDraggingRef.current) {
        setCurrentTime(audio.currentTime);
        if (audio.currentTime > 0) {
          setDuration(prev => (prev > 0 ? prev : Math.max(prev, audio.currentTime)));
        }
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
    };

    if (audio.readyState >= 1) {
      updateFiniteDuration();
    }

    audio.addEventListener('loadedmetadata', updateFiniteDuration);
    audio.addEventListener('durationchange', updateFiniteDuration);
    audio.addEventListener('canplay', updateFiniteDuration);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', updateFiniteDuration);
      audio.removeEventListener('durationchange', updateFiniteDuration);
      audio.removeEventListener('canplay', updateFiniteDuration);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  // 3. Smooth 60fps tracking animation loop while audio is playing
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    const step = () => {
      const audio = audioRef.current;
      if (audio && !isDraggingRef.current) {
        setCurrentTime(audio.currentTime);
      }
      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [isPlaying]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.warn('Audio playback error:', err);
      });
    }
  };

  const seekToPosition = useCallback((clientX: number) => {
    const audio = audioRef.current;
    const track = waveformTrackRef.current;
    if (!audio || !track) return;

    const effectiveDuration = duration > 0 ? duration : (audio.duration && isFinite(audio.duration) ? audio.duration : 0);
    if (!effectiveDuration) return;

    const rect = track.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const progressRatio = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = progressRatio * effectiveDuration;

    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    seekToPosition(e.clientX);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (isDraggingRef.current) {
        seekToPosition(moveEvent.clientX);
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!e.touches[0]) return;
    isDraggingRef.current = true;
    seekToPosition(e.touches[0].clientX);

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (isDraggingRef.current && moveEvent.touches[0]) {
        seekToPosition(moveEvent.touches[0].clientX);
      }
    };

    const handleTouchEnd = () => {
      isDraggingRef.current = false;
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };

    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const speeds = [1, 1.5, 2];
    const nextSpeed = speeds[(speeds.indexOf(playbackRate) + 1) % speeds.length];
    setPlaybackRate(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || !isFinite(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const effectiveDuration = duration > 0 ? duration : (audioRef.current?.duration && isFinite(audioRef.current.duration) ? audioRef.current.duration : 0);
  const progressPercent = effectiveDuration > 0 ? Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100)) : 0;
  const displayDuration = isPlaying || currentTime > 0 ? formatTime(currentTime) : (effectiveDuration > 0 ? formatTime(effectiveDuration) : (isLoaded ? '0:00' : '0:00'));

  return (
    <div className="w-full min-w-[260px] max-w-[340px] py-1 select-none">
      {/* Hidden native audio element */}
      <audio 
        ref={audioRef} 
        src={audioUrl} 
        preload="auto" 
      />

      <div className="flex items-center gap-3">
        {/* 1. Left Avatar with Microphone Badge */}
        <div className="relative shrink-0">
          <WhatsAppAvatar 
            name={senderName} 
            avatarUrl={senderAvatar} 
            size="md" 
          />
          {/* Green Microphone Icon Badge (Exact WhatsApp Web style) */}
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#00a884] border border-white dark:border-[#111b21] flex items-center justify-center shadow-xs">
            <Mic className="w-2.5 h-2.5 text-black stroke-[3]" />
          </div>
        </div>

        {/* 2. Middle & Right: Controls, Waveform, Timers */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
          {/* Top Row: Play/Pause Button + Waveform Track */}
          <div className="flex items-center gap-2">
            {/* Play/Pause Button */}
            <button
              type="button"
              onClick={togglePlay}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#54656f] dark:text-[#8696a0] hover:text-[#111b21] dark:hover:text-[#e9edef] active:scale-95 transition-all shrink-0 cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play voice note'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            {/* Interactive Audio Waveform with Scrubber Dot */}
            <div 
              ref={waveformTrackRef}
              className="flex-1 h-8 flex items-center gap-[2.5px] cursor-pointer relative group/wave py-1 touch-none"
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
              title="Seek audio track"
            >
              {waveformHeights.map((height, idx) => {
                const barProgress = (idx / (waveformHeights.length - 1)) * 100;
                const isPassed = barProgress <= progressPercent;

                return (
                  <div
                    key={idx}
                    className={`w-[3px] rounded-full transition-colors duration-75 ${
                      isPassed 
                        ? 'bg-[#34B7F1]' // Active blue/cyan WhatsApp played color
                        : isOutbound ? 'bg-[#8696a0]/50' : 'bg-[#8696a0]/40'
                    }`}
                    style={{ height: `${height}px` }}
                  />
                );
              })}

              {/* Scrubber Knob (Draggable and smoothly animated) */}
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#34B7F1] shadow-md pointer-events-none transition-transform group-hover/wave:scale-125"
                style={{ 
                  left: `calc(${Math.min(98, Math.max(2, progressPercent))}% - 6px)`,
                  transition: isDraggingRef.current ? 'none' : 'left 60ms linear'
                }}
              />
            </div>
          </div>

          {/* Bottom Row: Duration / Speed / Timestamp & Ticks */}
          <div className="flex items-center justify-between text-[11px] text-[#667781] dark:text-[#8696a0] pl-1 pr-0.5 font-sans">
            <div className="flex items-center gap-2">
              {/* Duration Timer */}
              <span className="tabular-nums font-medium text-[#667781] dark:text-[#8696a0]">
                {displayDuration}
              </span>

              {/* 1x / 1.5x / 2x Speed Toggle Pill */}
              {(isPlaying || playbackRate !== 1) && (
                <button
                  type="button"
                  onClick={cycleSpeed}
                  className="px-1.5 py-0.5 rounded-full bg-[#111b21]/10 dark:bg-[#111b21]/60 hover:bg-[#111b21]/20 dark:hover:bg-[#111b21] text-[#00a884] font-semibold text-[10px] border border-black/10 dark:border-white/10 transition-colors cursor-pointer"
                >
                  {playbackRate}x
                </button>
              )}

              {/* Download Voice Note Button */}
              {audioUrl && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const link = document.createElement('a');
                    const downloadUrl = audioUrl.includes('?') ? `${audioUrl}&download=1` : `${audioUrl}?download=1`;
                    link.href = downloadUrl;
                    link.download = message.media?.fileName || `voice-note-${message.id.slice(0, 10)}.ogg`;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="p-1 rounded-full text-[#667781] dark:text-[#8696a0] hover:text-[#111b21] dark:hover:text-[#e9edef] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  title="Save / Download voice note"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Timestamp & Status Checkmarks */}
            <div className="flex items-center gap-1 text-[#667781] dark:text-[#8696a0]">
              {message.pinned && (
                <Pin className="w-3 h-3 fill-current -rotate-45" />
              )}
              {message.starred && (
                <Star className="w-3 h-3 fill-current" />
              )}
              <span className="whitespace-nowrap text-[10.5px]">
                {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
              </span>

              {isOutbound && (
                message.status === 'failed' ? (
                  <span title={`Failed to send: ${message.errorMessage || 'WhatsApp API dispatch failed'}`}><AlertCircle className="w-3.5 h-3.5 text-rose-400" /></span>
                ) : (message.status === 'read' && Boolean(message.readAt || (message as any).read_at)) ? (
                  <span title={`Read by customer at ${new Date(message.readAt || (message as any).read_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}><CheckCheck className="w-3.5 h-3.5 text-[#34B7F1]" /></span>
                ) : (message.status === 'delivered' || message.status === 'read') ? (
                  <span title={message.deliveredAt ? `Delivered to customer at ${new Date(message.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "Delivered to customer"}><CheckCheck className="w-3.5 h-3.5 text-[#8696a0]" /></span>
                ) : message.status === 'sent' ? (
                  <span title={message.sentAt ? `Sent to WhatsApp at ${new Date(message.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "Sent to WhatsApp Cloud"}><Check className="w-3.5 h-3.5 text-[#8696a0]" /></span>
                ) : (
                  <span title="Sending to WhatsApp..."><Clock className="w-3.5 h-3.5 text-[#8696a0] animate-pulse" /></span>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
