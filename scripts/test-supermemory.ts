/**
 * Phase 7A: Supermemory proof of concept
 *
 * Verified API patterns:
 * - client.add() with containerTag + metadata + entityContext -> adds candidate
 * - client.search.documents() with containerTags[] -> cross-candidate search (WORKS)
 * - client.search.memories() with containerTag -> per-candidate search (WORKS)
 * - client.profile() with containerTag -> auto-built candidate profile (WORKS)
 *
 * Run: SUPERMEMORY_API_KEY=... npx tsx scripts/test-supermemory.ts
 * Run search-only: SUPERMEMORY_API_KEY=... npx tsx scripts/test-supermemory.ts --search-only
 */

import { Supermemory } from 'supermemory';

const client = new Supermemory();
const searchOnly = process.argv.includes('--search-only');

const ALL_TAGS = ['candidate-sarah-chen', 'candidate-james-park', 'candidate-maria-garcia'];

const TEST_CANDIDATES = [
  {
    containerTag: 'candidate-sarah-chen',
    content: [
      'Name: Sarah Chen',
      'Title: Staff ML Engineer',
      'Company: Stripe',
      'Skills: Python, PyTorch, TensorFlow, distributed systems, recommendation systems, MLOps',
      'Education: MIT, Computer Science, BS and MS',
      'Experience: 8 years. Google Brain (2018-2022), Stripe (2022-present)',
      'Summary: Deep expertise in recommendation systems and ML infrastructure. Led the migration of Stripe ML pipeline to Kubernetes. Published 3 papers on large-scale recommendation systems.',
      'Fit Score: 8/10 for "ML Engineer at Ramp"',
      'Fit Rationale: Strong ML infrastructure background, experience with financial data at Stripe. Gap: no direct payments fraud experience.',
      'Pipeline Stage: Scored',
      'Recruiter Notes: Had a call - very strong communicator. Wants to stay remote. Exploring AI startups specifically. Said Q2 2026 timing works better.',
    ].join('\n'),
    metadata: {
      role: 'ml-engineer-ramp',
      hiring_company: 'Ramp',
      fit_score: '8',
      stage: 'scored',
      type: 'candidate_profile',
    },
    entityContext:
      'This is a recruiting candidate profile. Extract skills, job history, education, preferences, recruiter observations, and fit assessment details.',
  },
  {
    containerTag: 'candidate-james-park',
    content: [
      'Name: James Park',
      'Title: Senior Software Engineer',
      'Company: Cloudflare',
      'Skills: Go, Rust, distributed systems, networking, Kubernetes, gRPC, protocol buffers',
      'Education: Stanford, Computer Science, BS',
      'Experience: 6 years. Amazon AWS (2020-2023), Cloudflare (2023-present)',
      'Summary: Infrastructure and networking specialist. Built Cloudflare Workers runtime improvements. Strong distributed systems fundamentals from AWS.',
      'Fit Score: 6/10 for "Backend Engineer at Notion"',
      'Fit Rationale: Strong distributed systems skills but lacked experience with collaborative real-time systems (CRDTs), which was Notion core requirement. Infrastructure focus better suited for infra-heavy roles.',
      'Pipeline Stage: Contacted',
      'Outreach: Contacted for Notion Backend role on 2026-03-15. No reply.',
    ].join('\n'),
    metadata: {
      role: 'backend-engineer-notion',
      hiring_company: 'Notion',
      fit_score: '6',
      stage: 'contacted',
      type: 'candidate_profile',
    },
    entityContext:
      'This is a recruiting candidate profile. Extract skills, job history, education, preferences, recruiter observations, and fit assessment details.',
  },
  {
    containerTag: 'candidate-maria-garcia',
    content: [
      'Name: Maria Garcia',
      'Title: Senior Product Designer',
      'Company: Figma',
      'Skills: product design, design systems, Figma, prototyping, user research, accessibility, front-end CSS',
      'Education: RISD, Industrial Design, BFA',
      'Experience: 7 years. Airbnb (2019-2022), Figma (2022-present)',
      'Summary: Design systems expert who bridges design and engineering. Built Figma component library used by 200+ designers. Strong accessibility advocate.',
      'Fit Score: 7/10 for "Product Designer at Linear"',
      'Fit Rationale: Excellent design systems background, strong portfolio. Slight gap: Linear needs more experience with developer tools UX specifically.',
      'Pipeline Stage: Replied',
      'Outreach: Contacted for Linear Product Designer role on 2026-03-20.',
      'Reply: Replied positively on 2026-03-22. Said interested but timing is off - will be open to new roles in Q2 2026.',
    ].join('\n'),
    metadata: {
      role: 'product-designer-linear',
      hiring_company: 'Linear',
      fit_score: '7',
      stage: 'replied',
      type: 'candidate_profile',
    },
    entityContext:
      'This is a recruiting candidate profile. Extract skills, job history, education, preferences, recruiter observations, and fit assessment details.',
  },
];

async function addCandidates() {
  console.log('1. Adding 3 test candidates...\n');
  for (const candidate of TEST_CANDIDATES) {
    const result = await client.add({
      content: candidate.content,
      containerTag: candidate.containerTag,
      metadata: candidate.metadata,
      entityContext: candidate.entityContext,
    });
    console.log(`   Added ${candidate.containerTag}: id=${result.id}, status=${result.status}`);
  }
  console.log('\n   Waiting 20s for processing...\n');
  await new Promise((resolve) => setTimeout(resolve, 20000));
}

async function runSearches() {
  // Cross-container search (talent pool matching)
  console.log('2. CROSS-CONTAINER: "backend engineer distributed systems Go fintech"...\n');
  const jdSearch = await client.search.documents({
    q: 'backend engineer with distributed systems and Go experience for a fintech company',
    containerTags: ALL_TAGS,
    limit: 10,
  });
  console.log(`   Found ${jdSearch.total} results (${jdSearch.timing}ms):`);
  for (const r of jdSearch.results) {
    console.log(`   - [${r.score.toFixed(3)}] ${r.title ?? r.documentId}`);
    console.log(`     metadata: ${JSON.stringify(r.metadata)}`);
    for (const c of r.chunks) {
      console.log(`     chunk (${c.score.toFixed(3)}): ${c.content.slice(0, 120)}...`);
    }
  }

  // Cross-container: design query
  console.log('\n3. CROSS-CONTAINER: "design systems accessibility product designer"...\n');
  const designSearch = await client.search.documents({
    q: 'design systems accessibility product designer',
    containerTags: ALL_TAGS,
    limit: 10,
  });
  console.log(`   Found ${designSearch.total} results (${designSearch.timing}ms):`);
  for (const r of designSearch.results) {
    console.log(`   - [${r.score.toFixed(3)}] ${r.title ?? r.documentId}`);
  }

  // Per-candidate memory search
  console.log('\n4. PER-CANDIDATE: Search within candidate-james-park...\n');
  const jamesSearch = await client.search.memories({
    q: 'skills and experience',
    containerTag: 'candidate-james-park',
    limit: 5,
    threshold: 0,
  });
  console.log(`   Found ${jamesSearch.total} results (${jamesSearch.timing}ms):`);
  for (const r of jamesSearch.results) {
    console.log(`   - [${r.similarity.toFixed(3)}] ${r.memory ?? '(empty)'}`);
  }

  // Cross-container: who replied positively
  console.log('\n5. CROSS-CONTAINER: "replied positively interested open to new roles"...\n');
  const replySearch = await client.search.documents({
    q: 'candidate who replied positively and is interested and open to new roles',
    containerTags: ALL_TAGS,
    limit: 10,
  });
  console.log(`   Found ${replySearch.total} results (${replySearch.timing}ms):`);
  for (const r of replySearch.results) {
    console.log(`   - [${r.score.toFixed(3)}] ${r.title ?? r.documentId}`);
  }

  // Profiles
  console.log('\n6. PROFILES:');
  for (const tag of ALL_TAGS) {
    const profile = await client.profile({ containerTag: tag });
    console.log(`\n   ${tag}:`);
    console.log(`   Static: ${profile.profile.static.join(' | ')}`);
    console.log(`   Dynamic: ${profile.profile.dynamic.slice(0, 3).join(' | ')}`);
  }
}

async function main() {
  console.log('=== Phase 7A: Supermemory Proof of Concept ===\n');

  if (!searchOnly) {
    await addCandidates();
  } else {
    console.log('(--search-only mode, skipping add)\n');
  }

  await runSearches();

  console.log('\n\n=== Results Summary ===');
  console.log('- Cross-container search: use client.search.documents({ containerTags: [...] })');
  console.log('- Per-candidate search: use client.search.memories({ containerTag: "..." })');
  console.log('- Candidate profile: use client.profile({ containerTag: "..." })');
  console.log('- search.memories without containerTag does NOT search globally');
}

main().catch(console.error);
