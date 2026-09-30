import React, { useState } from 'react';
import { 
  Code2, 
  ShieldCheck, 
  Database, 
  Server, 
  Cpu, 
  Radio, 
  CheckCircle2, 
  Layers, 
  Zap,
  Globe,
  Terminal,
  FileCode
} from 'lucide-react';

export const ArchitectureBlueprint: React.FC = () => {
  const [activeCodeTab, setActiveCodeTab] = useState<'controller' | 'guard' | 'statemachine' | 'processor' | 'prisma' | 'api'>('controller');

  return (
    <div className="space-y-6 flex-1 overflow-y-auto pr-1 pb-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 font-serif">System Architecture & Code Blueprint</h2>
        <p className="text-xs text-slate-400">
          Full technical reference implementation matching NestJS, PostgreSQL, Meta WhatsApp Cloud API, and BullMQ specifications
        </p>
      </div>

      {/* System Flow Diagram Card */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-4 shadow-xl">
        <h3 className="text-sm font-bold text-teal-300 flex items-center gap-2">
          <Layers className="w-4 h-4 text-gold-400" />
          <span>End-to-End Reactive Architecture Flow</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
          {/* Node 1 */}
          <div className="p-3.5 bg-slate-950 rounded-xl border border-emerald-500/40 text-center space-y-1">
            <Globe className="w-5 h-5 text-emerald-400 mx-auto" />
            <h4 className="font-bold text-slate-100">Customer WhatsApp</h4>
            <p className="text-[10px] text-slate-400">Interactive Buttons / List selections in EN, SI, TA</p>
          </div>

          {/* Node 2 */}
          <div className="p-3.5 bg-slate-950 rounded-xl border border-teal-500/40 text-center space-y-1">
            <ShieldCheck className="w-5 h-5 text-teal-400 mx-auto" />
            <h4 className="font-bold text-slate-100">Webhook Controller</h4>
            <p className="text-[10px] text-slate-400">HMAC-SHA256 signature check & 200ms Fast ACK</p>
          </div>

          {/* Node 3 */}
          <div className="p-3.5 bg-slate-950 rounded-xl border border-amber-500/40 text-center space-y-1">
            <Cpu className="w-5 h-5 text-amber-400 mx-auto" />
            <h4 className="font-bold text-slate-100">Lead Classifier & AI</h4>
            <p className="text-[10px] text-slate-400">State machine onboarding + OpenAI Intent Fallback</p>
          </div>

          {/* Node 4 */}
          <div className="p-3.5 bg-slate-950 rounded-xl border border-purple-500/40 text-center space-y-1">
            <Zap className="w-5 h-5 text-purple-400 mx-auto" />
            <h4 className="font-bold text-slate-100">BullMQ Follow-Up Worker</h4>
            <p className="text-[10px] text-slate-400">Day 1/3/5/7 nurture + Auto-stop on patient reply</p>
          </div>

          {/* Node 5 */}
          <div className="p-3.5 bg-slate-950 rounded-xl border border-sky-500/40 text-center space-y-1">
            <Radio className="w-5 h-5 text-sky-400 mx-auto animate-pulse" />
            <h4 className="font-bold text-slate-100">Socket.IO & CRM UI</h4>
            <p className="text-[10px] text-slate-400">Sub-second Lead visibility & 3-column chat</p>
          </div>
        </div>
      </div>

      {/* Code Viewer Panel */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
        {/* Code Tabs Header */}
        <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between overflow-x-auto">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveCodeTab('controller')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                activeCodeTab === 'controller'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              whatsapp.controller.ts
            </button>
            <button
              onClick={() => setActiveCodeTab('guard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                activeCodeTab === 'guard'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              whatsapp-signature.guard.ts
            </button>
            <button
              onClick={() => setActiveCodeTab('statemachine')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                activeCodeTab === 'statemachine'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              onboarding.state-machine.ts
            </button>
            <button
              onClick={() => setActiveCodeTab('processor')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                activeCodeTab === 'processor'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              followups.processor.ts
            </button>
            <button
              onClick={() => setActiveCodeTab('prisma')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                activeCodeTab === 'prisma'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              schema.prisma
            </button>
          </div>
          <span className="text-[11px] font-mono text-slate-500 hidden sm:block">TypeScript / NestJS 10</span>
        </div>

        {/* Code Content */}
        <div className="p-4 overflow-x-auto text-xs font-mono text-slate-300 leading-relaxed bg-[#0b101b]">
          {activeCodeTab === 'controller' && (
            <pre className="text-teal-200">
{`import { Controller, Get, Post, Query, Body, Res, UseGuards, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { WhatsappSignatureGuard } from './guards/whatsapp-signature.guard';
import { WhatsappWebhookPayload } from './dto/whatsapp-webhook.dto';

@Controller('webhooks/whatsapp')
export class WhatsappController {
  constructor(
    @InjectQueue('message-ingest') private readonly messageIngestQueue: Queue,
  ) {}

  /**
   * Meta Hub Verification Challenge (Handshake)
   */
  @Get()
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      return res.status(HttpStatus.OK).send(challenge);
    }
    return res.status(HttpStatus.FORBIDDEN).send('Forbidden: Token mismatch');
  }

  /**
   * Inbound Message & Status Webhook
   * Always acknowledge 200 OK within 2000ms, queue async processing
   */
  @Post()
  @UseGuards(WhatsappSignatureGuard)
  async handleInboundWebhook(@Body() payload: WhatsappWebhookPayload) {
    const wamid = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id;
    
    // Enqueue with idempotency deduplication key
    await this.messageIngestQueue.add('inbound-event', payload, {
      jobId: wamid || \`event-\${Date.now()}\`,
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
    });

    return { received: true };
  }
}`}
            </pre>
          )}

          {activeCodeTab === 'guard' && (
            <pre className="text-amber-200">
{`import { Injectable, CanActivate, ExecutionContext, RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class WhatsappSignatureGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RawBodyRequest<Request>>();
    const signature = req.headers['x-hub-signature-256'] as string;
    
    if (!signature || !process.env.WHATSAPP_APP_SECRET) {
      return false;
    }

    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', process.env.WHATSAPP_APP_SECRET)
      .update(req.rawBody || Buffer.from(''))
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }
}`}
            </pre>
          )}

          {activeCodeTab === 'statemachine' && (
            <pre className="text-sky-200">
{`export enum OnboardingStep {
  AWAITING_LANGUAGE = 'AwaitingLanguage',
  AWAITING_CATEGORY = 'AwaitingCategory',
  AWAITING_SERVICE = 'AwaitingService',
  LEAD_CREATED = 'LeadCreated',
  HUMAN_HANDLING = 'HumanHandling',
}

export class OnboardingStateMachine {
  async processInbound(customerWaId: string, inputPayload: any) {
    const session = await this.sessionRepo.findByWaId(customerWaId);

    switch (session?.state) {
      case OnboardingStep.AWAITING_LANGUAGE:
        if (['lang_en', 'lang_si', 'lang_ta'].includes(inputPayload.buttonId)) {
          const lang = inputPayload.buttonId.replace('lang_', '');
          await this.sessionRepo.update(customerWaId, { language: lang, state: OnboardingStep.AWAITING_CATEGORY });
          return this.whatsappService.sendCategoryListMessage(customerWaId, lang);
        }
        break;

      case OnboardingStep.AWAITING_CATEGORY:
        if (inputPayload.selectedRowId?.startsWith('cat_')) {
          const categoryId = inputPayload.selectedRowId;
          await this.sessionRepo.update(customerWaId, { categoryId, state: OnboardingStep.AWAITING_SERVICE });
          return this.whatsappService.sendTreatmentListMessage(customerWaId, categoryId, session.language);
        }
        break;

      case OnboardingStep.AWAITING_SERVICE:
        const treatmentId = inputPayload.selectedRowId;
        const lead = await this.leadService.createFromWhatsApp({
          waId: customerWaId,
          categoryId: session.categoryId,
          treatmentId,
          language: session.language,
        });

        // Broadcast real-time event to Super Admin WebSocket room
        this.socketGateway.emitToAdmins('lead:new', lead);
        await this.whatsappService.sendLeadConfirmation(customerWaId, session.language);
        break;
    }
  }
}`}
            </pre>
          )}

          {activeCodeTab === 'processor' && (
            <pre className="text-emerald-200">
{`import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { PrismaService } from '../database/prisma.service';

@Processor('followups-queue')
export class FollowupsProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
  ) {
    super();
  }

  async process(job: Job<{ followupId: string; leadId: string }>) {
    const followup = await this.prisma.followup.findUnique({
      where: { id: job.data.followupId },
      include: { lead: { include: { customer: true } }, template: true },
    });

    if (!followup || followup.status !== 'PENDING') {
      return; // Skipped or already cancelled
    }

    try {
      // 1. Send approved WhatsApp Template outside 24-hr window
      await this.whatsappService.sendTemplate(
        followup.lead.customer.whatsappNumber,
        followup.template.waTemplateName,
        followup.template.language,
        [followup.lead.customer.displayName, followup.lead.treatmentName]
      );

      // 2. Mark as sent
      await this.prisma.followup.update({
        where: { id: followup.id },
        data: { status: 'SENT', sentAt: new Date() },
      });
    } catch (err) {
      await this.handleFailureWithBackoff(followup, err);
    }
  }
}`}
            </pre>
          )}

          {activeCodeTab === 'prisma' && (
            <pre className="text-purple-200">
{`datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  SUPER_ADMIN
  COORDINATOR
}

enum LeadStage {
  NEW
  ASSIGNED
  CONTACTED
  INTERESTED
  FOLLOW_UP
  CONVERTED
  LOST
}

model User {
  id                  String       @id @default(uuid())
  fullName            String
  email               String       @unique
  passwordHash        String
  role                Role         @default(COORDINATOR)
  treatmentCategoryId String?
  active              Boolean      @default(true)
  createdAt           DateTime     @default(now())
  leads               Lead[]
  notes               LeadNote[]
}

model Customer {
  id                String       @id @default(uuid())
  whatsappNumber    String       @unique
  displayName       String
  preferredLanguage String       @default("en")
  createdAt         DateTime     @default(now())
  leads             Lead[]
  messages          Message[]
}

model Lead {
  id                    String       @id @default(uuid())
  customerId            String
  customer              Customer     @relation(fields: [customerId], references: [id])
  categoryId            String
  treatmentId           String
  assignedTo            String?
  coordinator           User?        @relation(fields: [assignedTo], references: [id])
  stage                 LeadStage    @default(NEW)
  source                String       @default("whatsapp")
  language              String       @default("en")
  lastCustomerMessageAt DateTime?
  createdAt             DateTime     @default(now())
  updatedAt             DateTime     @updatedAt
  messages              Message[]
  notes                 LeadNote[]
  stageHistory          LeadStageHistory[]
  followups             Followup[]

  @@index([stage])
  @@index([assignedTo])
  @@index([createdAt])
}`}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
