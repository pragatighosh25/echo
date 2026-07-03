import { applyOperationToContent, Block, BlockOperation } from './sync.service';

const transformOperation = (
  pending: BlockOperation,
  serverOp: any
): BlockOperation => {
  const transformed = { ...pending };

  if (pending.type === 'insert_block' && serverOp.type === 'insert_block') {
    const pendingIdx = pending.payload.index;
    const serverIdx = serverOp.payload.index;

    if (serverIdx <= pendingIdx) {
      transformed.payload = {
        ...pending.payload,
        index: pendingIdx + 1,
      };
    }
  } else if (pending.type === 'insert_block' && serverOp.type === 'delete_block') {
    const pendingIdx = pending.payload.index;
    const serverDeletedIdx = serverOp.payload.index;

    if (serverDeletedIdx !== undefined && serverDeletedIdx < pendingIdx) {
      transformed.payload = {
        ...pending.payload,
        index: Math.max(0, pendingIdx - 1),
      };
    }
  }

  transformed.version = serverOp.version;
  return transformed;
};

// Simple OT verification test runner
const runSyncTests = () => {
  console.log('==================================================');
  console.log('RUNNING CUSTOM REAL-TIME SYNC OT TESTS');
  console.log('==================================================');

  // Initial document state: 2 blocks
  let docState: Block[] = [
    { id: '1', type: 'paragraph', content: 'Block 1 content' },
    { id: '2', type: 'paragraph', content: 'Block 2 content' },
  ];

  console.log('Initial document blocks:', docState.map((b) => `[${b.id}:${b.type}] "${b.content}"`));

  // Simulation: Concurrent insertions
  // Client A wants to insert block '3' at index 1 (between Block 1 and 2)
  const clientA_op: BlockOperation = {
    id: 'op-a',
    documentId: 'doc-1',
    clientId: 'client-a',
    version: 0,
    type: 'insert_block',
    payload: {
      index: 1,
      block: { id: '3', type: 'paragraph', content: 'Block 3 (Client A)' },
    },
  };

  // Client B concurrently wants to insert block '4' at index 1 (also between Block 1 and 2)
  const clientB_op: BlockOperation = {
    id: 'op-b',
    documentId: 'doc-1',
    clientId: 'client-b',
    version: 0,
    type: 'insert_block',
    payload: {
      index: 1,
      block: { id: '4', type: 'paragraph', content: 'Block 4 (Client B)' },
    },
  };

  console.log('\n--- Scenario 1: Concurrent Insertions ---');
  console.log('Client A concurrent insert: at index 1');
  console.log('Client B concurrent insert: at index 1');

  // Server processes A first
  console.log('Server receives Client A operation first. Applying...');
  docState = applyOperationToContent(docState, clientA_op);
  const serverVersion = 1;
  console.log('Document State (Rev 1):', docState.map((b) => `[${b.id}] "${b.content}"`));

  // Server rejects Client B (since version 0 !== server version 1)
  // Client B receives Client A's applied operation, rebases its pending operation
  console.log('\nServer rejects Client B operation due to version conflict.');
  console.log('Client B transforms its pending operation against Client A\'s operation...');

  const serverOpBroadcast = { ...clientA_op, version: serverVersion };
  const clientB_transformed = transformOperation(clientB_op, serverOpBroadcast);

  console.log(`Client B transformed insertion index: ${clientB_transformed.payload.index} (shifted from 1 to 2)`);

  // Client B resubmits and server applies B's transformed operation
  console.log('Server receives Client B re-submitted transformed operation. Applying...');
  docState = applyOperationToContent(docState, clientB_transformed);
  console.log('Final converged Document State:', docState.map((b) => `[${b.id}] "${b.content}"`));

  // Verification
  const expectedOrder = ['1', '3', '4', '2'];
  const actualOrder = docState.map((b) => b.id);
  const success = JSON.stringify(actualOrder) === JSON.stringify(expectedOrder);

  if (success) {
    console.log('\n✅ TEST SUCCESSFUL: Both insertions preserved in correct converged order.');
  } else {
    console.log('\n❌ TEST FAILED: Order mismatch. Actual:', actualOrder);
  }
  console.log('==================================================\n');
};

runSyncTests();
