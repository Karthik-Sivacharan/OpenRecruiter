import { tool } from 'ai';
import { z } from 'zod';
import { AgentMailClient } from 'agentmail';
import { getRecruiter } from '@/lib/config/recruiters';

const AIRTABLE_API_KEY = () => process.env.AIRTABLE_API_KEY || '';
const AIRTABLE_BASE_ID = () => process.env.AIRTABLE_BASE_ID || '';
const AIRTABLE_TABLE_ID = () => process.env.AIRTABLE_TABLE_ID || '';

function airtableUrl(): string {
  return `https://api.airtable.com/v0/${AIRTABLE_BASE_ID()}/${AIRTABLE_TABLE_ID()}`;
}

function airtableHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${AIRTABLE_API_KEY()}`,
    'Content-Type': 'application/json',
  };
}

function getClient(): AgentMailClient {
  return new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY || '' });
}

function getInboxId(): string {
  return process.env.AGENTMAIL_INBOX_ID || '';
}

// ---------------------------------------------------------------------------
// Internal: update Airtable with draft info
// ---------------------------------------------------------------------------

async function updateAirtableDraft(
  recordId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(airtableUrl(), {
    method: 'PATCH',
    headers: airtableHeaders(),
    body: JSON.stringify({
      typecast: true,
      records: [{ id: recordId, fields }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Airtable draft update error for ${recordId}: ${response.status}: ${text}`);
  }
}

// ---------------------------------------------------------------------------
// agentmailCreateDrafts — batch create drafts + update Airtable
// ---------------------------------------------------------------------------

const DraftCandidate = z.object({
  record_id: z.string().describe('Airtable record ID'),
  email: z.string().describe('Candidate email address'),
  name: z.string().describe('Candidate full name'),
  subject: z.string().describe('Email subject line (lowercase, under 50 chars)'),
  body: z.string().describe('Email body text (50-100 words, plain text)'),
});

export const agentmailCreateDrafts = tool({
  description:
    'Create email drafts in AgentMail for scored candidates and update Airtable with draft content. Only use for candidates with fit_score >= 6. Each draft gets labels for the role and Airtable record ID. Updates Airtable with Draft Email Subject, Draft Email Body, AgentMail Draft ID, and Pipeline Stage "Draft Ready".',
  inputSchema: z.object({
    candidates: z
      .array(DraftCandidate)
      .min(1)
      .max(50)
      .describe('Array of candidates with their draft email content'),
    role_slug: z
      .string()
      .describe('Short role identifier for labels, e.g. "swe-senior-stripe" or "ml-eng-eragon"'),
  }),
  execute: async ({ candidates, role_slug }) => {
    const client = getClient();
    const inboxId = getInboxId();
    const results: Array<{
      name: string;
      email: string;
      draft_id: string | null;
      status: 'created' | 'error';
      error?: string;
    }> = [];

    const recruiter = getRecruiter();

    for (const candidate of candidates) {
      try {
        const fullBody = `${candidate.body}\n\n${recruiter.signatureText}`;
        const htmlBody = candidate.body
          .split('\n')
          .map((line) => (line.trim() === '' ? '<br>' : `<p>${line}</p>`))
          .join('');
        const fullHtml = `${htmlBody}${recruiter.signatureHtml}`;

        const draft = await client.inboxes.drafts.create(inboxId, {
          to: [candidate.email],
          subject: candidate.subject,
          text: fullBody,
          html: fullHtml,
          labels: [
            'draft-ready',
            `airtable-${candidate.record_id}`,
            `role-${role_slug}`,
          ],
          clientId: `draft-${candidate.record_id}`,
        });

        const draftId = draft.draftId ?? null;

        await updateAirtableDraft(candidate.record_id, {
          'Draft Email Subject': candidate.subject,
          'Draft Email Body': candidate.body,
          'AgentMail Draft ID': draftId,
          'Pipeline Stage': 'Draft Ready',
        });

        results.push({
          name: candidate.name,
          email: candidate.email,
          draft_id: draftId as string | null,
          status: 'created',
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`AgentMail draft error for ${candidate.name}: ${message}`);
        results.push({
          name: candidate.name,
          email: candidate.email,
          draft_id: null,
          status: 'error',
          error: message,
        });
      }
    }

    const created = results.filter((r) => r.status === 'created').length;
    const failed = results.filter((r) => r.status === 'error').length;

    return { total: candidates.length, created, failed, results };
  },
});

// ---------------------------------------------------------------------------
// agentmailSendDrafts — send drafts + update Airtable
// ---------------------------------------------------------------------------

export const agentmailSendDrafts = tool({
  description:
    'Send previously created AgentMail drafts. Updates Airtable with AgentMail Thread ID, Message ID, Sent At timestamp, and Pipeline Stage "Contacted". Only call after recruiter explicitly approves sending.',
  inputSchema: z.object({
    drafts: z
      .array(
        z.object({
          record_id: z.string().describe('Airtable record ID'),
          draft_id: z.string().describe('AgentMail draft ID'),
          name: z.string().describe('Candidate name (for reporting)'),
        }),
      )
      .min(1)
      .max(50)
      .describe('Array of drafts to send'),
  }),
  execute: async ({ drafts }) => {
    const client = getClient();
    const inboxId = getInboxId();
    const results: Array<{
      name: string;
      thread_id: string | null;
      message_id: string | null;
      status: 'sent' | 'error';
      error?: string;
    }> = [];

    for (const draft of drafts) {
      try {
        const sent = await client.inboxes.drafts.send(inboxId, draft.draft_id, {});
        const threadId = sent.threadId ?? null;
        const messageId = sent.messageId ?? null;

        await updateAirtableDraft(draft.record_id, {
          'AgentMail Thread ID': threadId,
          'AgentMail Message ID': messageId,
          'Sent At': new Date().toISOString(),
          'Pipeline Stage': 'Contacted',
        });

        results.push({
          name: draft.name,
          thread_id: threadId,
          message_id: messageId,
          status: 'sent',
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`AgentMail send error for ${draft.name}: ${message}`);
        results.push({
          name: draft.name,
          thread_id: null,
          message_id: null,
          status: 'error',
          error: message,
        });
      }
    }

    const sent = results.filter((r) => r.status === 'sent').length;
    const failed = results.filter((r) => r.status === 'error').length;

    return { total: drafts.length, sent, failed, results };
  },
});
