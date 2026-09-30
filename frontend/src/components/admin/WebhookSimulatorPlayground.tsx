import React, { useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import { 
  Terminal, 
  Send, 
  CheckCircle2, 
  ShieldCheck, 
  RefreshCw, 
  Code2, 
  Radio, 
  Sparkles,
  Zap
} from 'lucide-react';

export const WebhookSimulatorPlayground: React.FC = () => {
  const { leads, sendMessage, updateTemplate, templates } = useCrm();
  const [selectedEventType, setSelectedEventType] = useState<'inbound_msg' | 'delivery_receipt' | 'template_approved'>('inbound_msg');
  const [targetLeadId, setTargetLeadId] = useState<string>(leads[0]?.id || '');
  const [customText, setCustomText] = useState('Hi doctor, can I know the recovery time for hair transplant?');
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);

  const selectedLead = leads.find(l => l.id === targetLeadId) || leads[0];

  // Generate simulated raw Meta Webhook Payload JSON
  const getSimulatedPayload = () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const phone = selectedLead?.customer?.whatsappNumber.replace('+', '') || '94771234567';
    const name = selectedLead?.customer?.displayName || 'Patient Name';

    if (selectedEventType === 'inbound_msg') {
      return {
        object: 'whatsapp_business_account',
        entry: [{
          id: 'WABA_198273645012',
          changes: [{
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '+94 11 234 5678',
                phone_number_id: 'PHONE_ID_ROYAL_WELLNESS'
              },
              contacts: [{
                profile: { name },
                wa_id: phone
              }],
              messages: [{
                from: phone,
                id: `wamid.HBg${Date.now()}`,
                timestamp: timestamp.toString(),
                text: { body: customText },
                type: 'text'
              }]
            },
            field: 'messages'
          }]
        }]
      };
    }

    if (selectedEventType === 'delivery_receipt') {
      return {
        object: 'whatsapp_business_account',
        entry: [{
          id: 'WABA_198273645012',
          changes: [{
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '+94 11 234 5678',
                phone_number_id: 'PHONE_ID_ROYAL_WELLNESS'
              },
              statuses: [{
                id: 'wamid.HBg104',
                status: 'read',
                timestamp: timestamp.toString(),
                recipient_id: phone,
                conversation: {
                  id: 'conv_123456',
                  origin: { type: 'service' }
                }
              }]
            },
            field: 'messages'
          }]
        }]
      };
    }

    // Template approved event
    return {
      object: 'whatsapp_business_account',
      entry: [{
        id: 'WABA_198273645012',
        changes: [{
          value: {
            event: 'APPROVED',
            message_template_id: 'tpl_meta_987123',
            message_template_name: 'royal_wellness_laser_v1',
            message_template_language: 'en',
            reason: 'Template complies with Meta Business Messaging Policy'
          },
          field: 'message_template_status_update'
        }]
      }]
    };
  };

  const simulatedPayload = getSimulatedPayload();

  const handleDispatch = () => {
    setDispatchStatus('Verifying HMAC-SHA256 signature...');
    setTimeout(() => {
      setDispatchStatus('200 OK — Enqueued to BullMQ message-ingest queue');
      
      if (selectedEventType === 'inbound_msg' && selectedLead) {
        // Send inbound message
        sendMessage(selectedLead.id, customText, 'system');
      }

      setTimeout(() => setDispatchStatus(null), 4000);
    }, 600);
  };

  return (
    <div className="space-y-6 flex-1 overflow-y-auto pr-1 pb-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 font-serif flex items-center gap-2">
          <Terminal className="w-5 h-5 text-teal-400" />
          <span>Meta WhatsApp Webhook Simulator & Sandbox</span>
        </h2>
        <p className="text-xs text-slate-400">
          Dispatch mock inbound payloads, test HMAC-SHA256 signature verification, and inspect raw event handling
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Config Column */}
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 space-y-4 shadow-lg">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Event Configuration
          </h3>

          {/* Event type picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Webhook Event Type</label>
            <div className="space-y-1">
              <button
                onClick={() => setSelectedEventType('inbound_msg')}
                className={`w-full p-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
                  selectedEventType === 'inbound_msg'
                    ? 'bg-teal-950/40 border-teal-500/50 text-teal-200'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                📥 Inbound Customer Message
              </button>
              <button
                onClick={() => setSelectedEventType('delivery_receipt')}
                className={`w-full p-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
                  selectedEventType === 'delivery_receipt'
                    ? 'bg-teal-950/40 border-teal-500/50 text-teal-200'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                ✓✓ Message Read Receipt (Status)
              </button>
              <button
                onClick={() => setSelectedEventType('template_approved')}
                className={`w-full p-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
                  selectedEventType === 'template_approved'
                    ? 'bg-teal-950/40 border-teal-500/50 text-teal-200'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                ⭐ Meta Template Approved Event
              </button>
            </div>
          </div>

          {/* Target Lead Selector */}
          {selectedEventType !== 'template_approved' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Target Lead</label>
              <select
                value={targetLeadId}
                onChange={(e) => setTargetLeadId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-teal-500"
              >
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.customer?.displayName} ({l.customer?.whatsappNumber})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Custom Inbound Message Body */}
          {selectedEventType === 'inbound_msg' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Message Body</label>
              <textarea
                rows={3}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 outline-none focus:border-teal-500 resize-none"
              />
            </div>
          )}

          {/* Dispatch Button */}
          <div className="pt-2">
            <button
              onClick={handleDispatch}
              className="w-full py-2.5 bg-whatsapp hover:bg-emerald-400 text-slate-950 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <Send className="w-4 h-4" />
              <span>POST /webhooks/whatsapp</span>
            </button>
          </div>

          {/* Dispatch Feedback */}
          {dispatchStatus && (
            <div className="p-2.5 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{dispatchStatus}</span>
            </div>
          )}
        </div>

        {/* Right Code Payload Viewer */}
        <div className="lg:col-span-2 bg-slate-950 rounded-2xl border border-slate-800 p-5 space-y-3 shadow-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-teal-400" />
              <span className="text-xs font-mono font-bold text-slate-200">
                HTTP Headers & Raw Inbound JSON Payload
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] text-teal-400">
              Content-Type: application/json
            </span>
          </div>

          {/* Security Headers Simulation */}
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-400 space-y-1">
            <p><strong className="text-amber-400">X-Hub-Signature-256:</strong> sha256=9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08</p>
            <p><strong className="text-teal-400">User-Agent:</strong> Facebook-Graph-API/v20.0</p>
          </div>

          {/* JSON Payload */}
          <div className="bg-[#0b101b] p-4 rounded-xl border border-slate-800 font-mono text-xs text-teal-200 overflow-x-auto max-h-96">
            <pre>{JSON.stringify(simulatedPayload, null, 2)}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};
