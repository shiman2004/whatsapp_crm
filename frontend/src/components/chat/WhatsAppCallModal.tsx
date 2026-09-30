import React, { useState, useEffect } from 'react';
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Clock, 
  User, 
  Shield, 
  CheckCircle2,
  FileText
} from 'lucide-react';
import { Lead } from '../../types';
import { useCrm } from '../../context/CrmContext';

interface CallModalProps {
  lead: Lead;
  onClose: () => void;
}

export const WhatsAppCallModal: React.FC<CallModalProps> = ({ lead, onClose }) => {
  const { sendMessage } = useCrm();
  const [callStatus, setCallStatus] = useState<'ringing' | 'connected' | 'ended'>('ringing');
  const [seconds, setSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [callNotes, setCallNotes] = useState('');

  // Call timer
  useEffect(() => {
    let timer: any;
    if (callStatus === 'ringing') {
      const ringTimer = setTimeout(() => {
        setCallStatus('connected');
      }, 2500);
      return () => clearTimeout(ringTimer);
    } else if (callStatus === 'connected') {
      timer = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [callStatus]);

  const handleEndCall = () => {
    setCallStatus('ended');
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const durationStr = `${mins > 0 ? `${mins}m ` : ''}${secs}s`;

    // Log call as a message
    sendMessage(
      lead.id,
      `📞 WhatsApp Business Voice Call completed (${durationStr}). Notes: ${callNotes || 'Consultation details discussed.'}`,
      'coordinator'
    );

    setTimeout(onClose, 1000);
  };

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-teal-500/40 rounded-3xl max-w-sm w-full p-6 text-center space-y-6 shadow-2xl relative overflow-hidden animate-slide-up">
        {/* Top Encryption Badge */}
        <div className="flex items-center justify-center gap-1 text-[11px] text-teal-300 font-medium">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>End-to-End Encrypted WhatsApp Call</span>
        </div>

        {/* Patient Photo & Info */}
        <div className="space-y-3">
          <div className="relative inline-block">
            <img
              src={lead.customer?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
              alt={lead.customer?.displayName}
              className="w-24 h-24 rounded-full object-cover border-4 border-teal-500/50 shadow-xl mx-auto"
            />
            {callStatus === 'ringing' && (
              <span className="w-6 h-6 rounded-full bg-emerald-400 border-2 border-slate-900 absolute bottom-0 right-0 animate-ping"></span>
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">{lead.customer?.displayName}</h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{lead.customer?.whatsappNumber}</p>
          </div>
        </div>

        {/* Status / Timer */}
        <div className="py-2">
          {callStatus === 'ringing' && (
            <div className="text-sm font-semibold text-gold-400 animate-pulse">
              Ringing patient WhatsApp...
            </div>
          )}
          {callStatus === 'connected' && (
            <div className="space-y-1">
              <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-mono font-bold inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                {formatTime(seconds)}
              </span>
              <p className="text-[10px] text-slate-400">High-Definition Voice Stream</p>
            </div>
          )}
          {callStatus === 'ended' && (
            <div className="text-sm font-semibold text-rose-400">
              Call Disconnected
            </div>
          )}
        </div>

        {/* Call Notes input during active call */}
        {callStatus === 'connected' && (
          <div className="text-left space-y-1 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <label className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
              <FileText className="w-3 h-3 text-teal-400" />
              <span>Call Consultation Summary</span>
            </label>
            <input
              type="text"
              value={callNotes}
              onChange={(e) => setCallNotes(e.target.value)}
              placeholder="e.g. Confirmed Saturday 2 PM slot with consultant..."
              className="w-full bg-transparent text-xs text-slate-200 outline-none placeholder-slate-600"
            />
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all ${
              isMuted ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            onClick={handleEndCall}
            className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-950/60 transition-transform active:scale-95"
            title="End Call"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
