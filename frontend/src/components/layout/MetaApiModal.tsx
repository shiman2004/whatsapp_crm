import React, { useState } from 'react';
import { 
  CheckCircle2, 
  X, 
  Send, 
  Copy, 
  Check, 
  Sparkles,
  Link2
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import { API_BASE_URL } from '../../config/api';

interface MetaApiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MetaApiModal: React.FC<MetaApiModalProps> = ({ isOpen, onClose }) => {
  const { notify } = useCrm() as any;
  const [phoneNumberId, setPhoneNumberId] = useState('1358157244046701');
  const [wabaId, setWabaId] = useState('2332922997481634');
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('meta_access_token') || '');
  const [testNumber, setTestNumber] = useState('');
  const [testMessage, setTestMessage] = useState('Hello from Royal Wellness Center! 🌿 Your consultation is confirmed.');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; msg: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [useTemplate, setUseTemplate] = useState(true);

  if (!isOpen) return null;

  const handleSaveToken = () => {
    localStorage.setItem('meta_access_token', accessToken);
    if (notify) notify('Settings Saved', 'Meta Access Token saved to local configuration', 'success');
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSendTestMessage = async () => {
    if (!testNumber) {
      alert('Please enter a recipient WhatsApp number (with country code)');
      return;
    }
    if (!accessToken) {
      alert('Please paste your Meta Access Token first');
      return;
    }

    setIsSending(true);
    setSendResult(null);

    try {
      const cleanTo = testNumber.replace(/[^0-9]/g, '');
      const payload = useTemplate ? {
        messaging_product: 'whatsapp',
        to: cleanTo,
        type: 'template',
        template: {
          name: 'hello_world',
          language: { code: 'en_US' }
        }
      } : {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanTo,
        type: 'text',
        text: { body: testMessage }
      };

      const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId || '1358157244046701'}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok && (result.messages || result.messaging_product)) {
        setSendResult({ success: true, msg: useTemplate ? '✅ Official Template (hello_world) sent and delivered to WhatsApp!' : '✅ Custom message sent via Meta Cloud API!' });
        if (notify) notify('WhatsApp Delivered', `Message successfully sent to ${testNumber}`, 'success');
      } else {
        let errMsg = result.error?.message || result.error?.error_user_msg || JSON.stringify(result.error) || 'Failed to send message';
        if (result.error?.code === 131030) {
          errMsg = '⚠️ Number Not Allowed Yet: You must add this phone number to the "To" Recipient list in your Meta Developer Portal (Step 1 -> Manage phone number list) and verify it with a 6-digit OTP code before Meta allows sending test messages to it.';
        }
        setSendResult({ success: false, msg: errMsg });
      }
    } catch (err: any) {
      setSendResult({ success: false, msg: err.message || 'Error connecting to Meta API' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111b21] border border-slate-700/80 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#202c33]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Meta WhatsApp Cloud API Live Bridge
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium border border-emerald-500/30">
                  Active
                </span>
              </h2>
              <p className="text-xs text-slate-400">Royal Wellness Center Official Connection</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          
          {/* Active Webhook Banner */}
          <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="font-semibold">Webhook Verified:</span> Receives live incoming chats automatically
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Link2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-mono">Port 3001</span>
            </div>
          </div>

          {/* Credentials Info */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-[#202c33] rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-1">Phone Number ID</span>
              <div className="flex items-center justify-between font-mono text-slate-200">
                <span className="truncate">{phoneNumberId}</span>
                <button onClick={() => handleCopy(phoneNumberId, 'phoneId')} className="text-slate-400 hover:text-white ml-2">
                  {copiedField === 'phoneId' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="p-3 bg-[#202c33] rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-1">WABA Account ID</span>
              <div className="flex items-center justify-between font-mono text-slate-200">
                <span className="truncate">{wabaId}</span>
                <button onClick={() => handleCopy(wabaId, 'wabaId')} className="text-slate-400 hover:text-white ml-2">
                  {copiedField === 'wabaId' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Access Token Input */}
          <div className="space-y-1.5 text-xs">
            <label className="text-slate-300 font-medium flex items-center justify-between">
              <span>Meta Access Token (from Step 1)</span>
              <span className="text-[10px] text-slate-400">Saved locally in browser</span>
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Paste the generated Access Token here..."
                className="flex-1 px-3 py-2 bg-[#202c33] border border-slate-700 rounded-xl text-slate-200 text-xs focus:border-emerald-500 outline-none font-mono"
              />
              <button
                onClick={handleSaveToken}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs transition-all"
              >
                Save
              </button>
            </div>
          </div>

          {/* Live Test Outbound Sender */}
          <div className="p-4 bg-[#202c33] rounded-xl border border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-whatsapp" /> Send Real WhatsApp Test Message
              </h3>
              <div className="flex items-center gap-1 bg-[#111b21] p-0.5 rounded-lg border border-slate-700/60 text-[11px]">
                <button
                  type="button"
                  onClick={() => setUseTemplate(true)}
                  className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                    useTemplate ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Official Template (hello_world)
                </button>
                <button
                  type="button"
                  onClick={() => setUseTemplate(false)}
                  className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                    !useTemplate ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Custom Text
                </button>
              </div>
            </div>
            
            <div className="space-y-2">
              <input
                type="text"
                value={testNumber}
                onChange={(e) => setTestNumber(e.target.value)}
                placeholder="Recipient phone with country code (e.g. 94770849469)"
                className="w-full px-3 py-2 bg-[#111b21] border border-slate-700 rounded-lg text-slate-200 text-xs focus:border-emerald-500 outline-none font-mono"
              />
              {!useTemplate && (
                <textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-[#111b21] border border-slate-700 rounded-lg text-slate-200 text-xs focus:border-emerald-500 outline-none resize-none"
                />
              )}
              {useTemplate && (
                <div className="p-2 rounded-lg bg-[#111b21]/70 border border-slate-700/60 text-[11px] text-slate-300">
                  <span className="font-semibold text-emerald-400">Template Mode:</span> Sends Meta's official pre-approved <code className="text-emerald-300 font-mono">hello_world</code> template. Delivers instantly to numbers registered on your Meta test list.
                </div>
              )}
            </div>

            <button
              onClick={handleSendTestMessage}
              disabled={isSending}
              className="w-full py-2 bg-whatsapp hover:bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isSending ? (
                <span>Sending via Meta Cloud API...</span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send to Recipient WhatsApp</span>
                </>
              )}
            </button>

            {sendResult && (
              <div className={`p-2.5 rounded-lg text-xs ${
                sendResult.success 
                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30' 
                  : 'bg-red-950/60 text-red-300 border border-red-500/30'
              }`}>
                {sendResult.msg}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-[#202c33] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-all"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
