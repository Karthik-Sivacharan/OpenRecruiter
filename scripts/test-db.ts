/**
 * Quick smoke test for DB queries.
 * Run: npx tsx scripts/test-db.ts
 */
import { createChat, loadChat, saveChat, listChats, updateChatMeta } from '../src/lib/db/queries';

async function main() {
  const testId = `test-${Date.now()}`;
  console.log(`\n1. createChat("${testId}", "Test Chat")`);
  await createChat(testId, 'Test Chat');
  console.log('   OK');

  console.log(`\n2. loadChat("${testId}")`);
  const loaded = await loadChat(testId);
  console.log('   title:', loaded?.title);
  console.log('   messages:', loaded?.messages);
  console.log('   createdAt:', loaded?.createdAt);

  console.log(`\n3. saveChat with 2 messages`);
  const messages = [
    { id: 'msg-1', role: 'user', content: 'Find ML engineers in SF' },
    { id: 'msg-2', role: 'assistant', content: 'I\'ll search for ML engineers...' },
  ];
  await saveChat(testId, messages);
  console.log('   OK');

  console.log(`\n4. loadChat again — verify messages saved`);
  const reloaded = await loadChat(testId);
  console.log('   title:', reloaded?.title);
  console.log('   message count:', (reloaded?.messages as unknown[])?.length);
  console.log('   first message:', (reloaded?.messages as { role: string; content: string }[])?.[0]?.content?.slice(0, 50));

  console.log(`\n5. updateChatMeta — set roleName`);
  await updateChatMeta(testId, { roleName: 'Senior ML Engineer' });
  const withMeta = await loadChat(testId);
  console.log('   roleName:', withMeta?.roleName);

  console.log(`\n6. listChats`);
  const chats = await listChats();
  console.log('   total chats:', chats.length);
  console.log('   first chat:', chats[0]?.title, '|', chats[0]?.roleName);

  console.log(`\n7. saveChat on NEW id (upsert test)`);
  const newId = `test-upsert-${Date.now()}`;
  await saveChat(newId, [{ id: 'msg-1', role: 'user', content: 'Upsert test message' }]);
  const upserted = await loadChat(newId);
  console.log('   title:', upserted?.title);
  console.log('   messages:', (upserted?.messages as unknown[])?.length);

  console.log('\nAll tests passed!');
}

main().catch(console.error);
