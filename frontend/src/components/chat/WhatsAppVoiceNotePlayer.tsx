import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Mic, Pin, Star, Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import { WhatsAppAvatar } from './WhatsAppAvatar';
import { Message } from '../../types';

interface WhatsAppVoiceNotePlayerProps {
  message: Message;
  senderName?: string;
  senderAvatar?: string;
  isOutbound: boolean;
}

// WhatsApp-like randomized bar heights (32 bars for realistic audio waveform)
const WAVEFORM_HEIGHTS = [
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isLoaded, setIsLoaded] = useState(false);

  const audioUrl = message.media?.url || '';

  // Setup audio listener
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
      setIsLoaded(true);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

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

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const progressRatio = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = progressRatio * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
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
    if (!secs || isNaN(secs) || !isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const displayDuration = isPlaying || currentTime > 0 ? formatTime(currentTime) : formatTime(duration || 0);

  return (
    <div className="w-full min-w-[260px] max-w-[340px] py-1 select-none">
      {/* Hidden native audio element */}
      <audio 
        ref={audioRef} 
        src={audioUrl} 
        preload="metadata" 
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
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#00a884] border border-[#111b21] flex items-center justify-center shadow-md">
            <Mic className="w-2.5 h-2.5 text-black stroke-[3]" />
          </div>
        </div>

        {/* 2. Middle & Right: Controls, Waveform, Timers */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
          {/* Top Row: Play/Pause Button + Waveform Track */}
          <div className="flex items-center gap-2">
            {/* Play/Pause Button */}
            <button
              onClick={togglePlay}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#8696a0] hover:text-[#e9edef] active:scale-95 transition-all shrink-0"
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
              className="flex-1 h-8 flex items-center gap-[2.5px] cursor-pointer relative group/wave py-1"
              onClick={handleWaveformClick}
              title="Seek audio"
            >
              {WAVEFORM_HEIGHTS.map((height, idx) => {
                const barProgress = (idx / (WAVEFORM_HEIGHTS.length - 1)) * 100;
                const isPassed = barProgress <= progressPercent;

                return (
                  <div
                    key={idx}
                    className={`w-[3px] rounded-full transition-colors ${
                      isPassed 
                        ? 'bg-[#53bdeb]' // Active blue/cyan WhatsApp played color
                        : isOutbound ? 'bg-[#8696a0]/50' : 'bg-[#8696a0]/40'
                    }`}
                    style={{ height: `${height}px` }}
                  />
                );
              })}

              {/* Scrubber Knob */}
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#53bdeb] shadow-md pointer-events-none transition-all"
                style={{ left: `calc(${Math.min(98, Math.max(2, progressPercent))}% - 5px)` }}
              />
            </div>
          </div>

          {/* Bottom Row: Duration / Speed / Timestamp & Ticks */}
          <div className="flex items-center justify-between text-[11px] text-[#8696a0] pl-1 pr-0.5 font-sans">
            <div className="flex items-center gap-2">
              {/* Duration Timer */}
              <span className="tabular-nums font-medium text-[#8696a0]">
                {displayDuration === '0:00' && !isLoaded ? '0:01' : displayDuration}
              </span>

              {/* 1x / 1.5x / 2x Speed Toggle Pill */}
              {(isPlaying || playbackRate !== 1) && (
                <button
                  onClick={cycleSpeed}
                  className="px-1.5 py-0.5 rounded-full bg-[#111b21]/60 hover:bg-[#111b21] text-[#00a884] font-semibold text-[10px] border border-white/10 transition-colors"
                >
                  {playbackRate}x
                </button>
              )}
            </div>

            {/* Timestamp & Status Checkmarks */}
            <div className="flex items-center gap-1">
              {message.pinned && (
                <Pin className="w-3 h-3 fill-[#8696a0] text-[#8696a0] -rotate-45" />
              )}
              {message.starred && (
                <Star className="w-3 h-3 fill-[#8696a0] text-[#8696a0]" />
              )}
              <span className="whitespace-nowrap text-[10.5px]">
                {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
              </span>

              {isOutbound && (
                message.status === 'read' ? (
                  <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                ) : message.status === 'delivered' ? (
                  <CheckCheck className="w-3.5 h-3.5 text-[#8696a0]" />
                ) : message.status === 'sent' ? (
                  <Check className="w-3.5 h-3.5 text-[#8696a0]" />
                ) : (
                  <Clock className="w-3 h-3 text-[#8696a0]" />
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
