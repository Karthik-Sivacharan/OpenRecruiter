export interface RecruiterProfile {
  name: string;
  fullName: string;
  title: string;
  intro: string;
  cta: string;
  signatureText: string;
  signatureHtml: string;
}

const RECRUITERS: Record<string, RecruiterProfile> = {
  'carl.x2talent@agentmail.to': {
    name: 'Carl',
    fullName: 'Carl Wheatley',
    title: 'Founder, x2talent',
    intro: 'a former product designer turned design recruiter',
    cta: 'Open to a quick conversation if this sounds interesting?',
    signatureText: 'Carl Wheatley\nFounder, x2talent\nhttps://x2talent.com | https://www.linkedin.com/in/carlcwheatley/',
    signatureHtml: '<p>Carl Wheatley<br>Founder, x2talent<br><a href="https://x2talent.com">x2talent.com</a> | <a href="https://www.linkedin.com/in/carlcwheatley/">LinkedIn</a></p>',
  },
};

const DEFAULT_RECRUITER: RecruiterProfile = {
  name: 'Team',
  fullName: 'x2talent Team',
  title: 'x2talent',
  intro: 'a recruiter at x2talent',
  cta: 'Open to a quick conversation if this sounds interesting?',
  signatureText: 'x2talent Team',
  signatureHtml: '<p>x2talent Team</p>',
};

export function getRecruiter(): RecruiterProfile {
  const inboxId = process.env.AGENTMAIL_INBOX_ID || '';
  return RECRUITERS[inboxId] ?? DEFAULT_RECRUITER;
}
