import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket, connectSocket } from '../lib/socket';
import { apiFetch } from '../lib/api';
import { v4 as uuidv4 } from 'uuid';

export interface Block {
  id: string;
  type: string;
  content: string;
  properties?: any;
}

export interface BlockOperation {
  id: string;
  documentId: string;
  clientId: string;
  version: number;
  type: 'insert_block' | 'delete_block' | 'update_block' | 'move_block';
  payload: any;
}

export interface Presence {
  userId: string;
  userName: string;
  cursor: { line: number; ch: number } | null;
  selection: { anchor: number; head: number } | null;
  isTyping: boolean;
}

// Transforms a pending operation against an incoming server operation
export const transformOperation = (
  pending: BlockOperation,
  serverOp: any
): BlockOperation => {
  const transformed = { ...pending };

  // OT Index shifting logic for block insertion/deletion conflicts
  if (pending.type === 'insert_block' && serverOp.type === 'insert_block') {
    const pendingIdx = pending.payload.index;
    const serverIdx = serverOp.payload.index;

    // Shift index if server inserted a block at or before our insertion index
    if (serverIdx <= pendingIdx) {
      transformed.payload = {
        ...pending.payload,
        index: pendingIdx + 1,
      };
    }
  } else if (pending.type === 'insert_block' && serverOp.type === 'delete_block') {
    // If a block was deleted before our insertion point, shift index back
    const pendingIdx = pending.payload.index;
    const serverDeletedIdx = serverOp.payload.index; // Assuming index is passed in delete payload

    if (serverDeletedIdx !== undefined && serverDeletedIdx < pendingIdx) {
      transformed.payload = {
        ...pending.payload,
        index: Math.max(0, pendingIdx - 1),
      };
    }
  }

  // Increment version because we are adapting to the new version
  transformed.version = serverOp.version;
  return transformed;
};

export const useDocumentSync = (documentId: string) => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [version, setVersion] = useState<number>(0);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'offline'>('connecting');

  const pendingOpsRef = useRef<BlockOperation[]>([]);
  const versionRef = useRef<number>(0);
  const blocksRef = useRef<Block[]>([]);

  // Update references to avoid closure capture issues
  useEffect(() => {
    versionRef.current = version;
    blocksRef.current = blocks;
  }, [version, blocks]);

  // Apply a single block operation locally
  const applyLocalOperation = useCallback((op: BlockOperation) => {
    setBlocks((prevBlocks) => {
      const newBlocks = [...prevBlocks];
      switch (op.type) {
        case 'insert_block': {
          const { index, block } = op.payload;
          newBlocks.splice(index, 0, block);
          break;
        }
        case 'delete_block': {
          const { blockId } = op.payload;
          return newBlocks.filter((b) => b.id !== blockId);
        }
        case 'update_block': {
          const { blockId, type, content, properties } = op.payload;
          const idx = newBlocks.findIndex((b) => b.id === blockId);
          if (idx !== -1) {
            newBlocks[idx] = {
              ...newBlocks[idx],
              type: type !== undefined ? type : newBlocks[idx].type,
              content: content !== undefined ? content : newBlocks[idx].content,
              properties: properties !== undefined ? { ...newBlocks[idx].properties, ...properties } : newBlocks[idx].properties,
            };
          }
          break;
        }
        case 'move_block': {
          const { fromIndex, toIndex } = op.payload;
          if (fromIndex >= 0 && fromIndex < newBlocks.length && toIndex >= 0 && toIndex < newBlocks.length) {
            const [moved] = newBlocks.splice(fromIndex, 1);
            newBlocks.splice(toIndex, 0, moved);
          }
          break;
        }
      }
      return newBlocks;
    });
  }, []);

  // Submit operations to the server
  const submitOperation = useCallback(
    (type: BlockOperation['type'], payload: any) => {
      const socket = getSocket();
      const clientId = socket.id || 'client-id';

      const op: BlockOperation = {
        id: uuidv4(),
        documentId,
        clientId,
        version: versionRef.current,
        type,
        payload,
      };

      // 1. Apply operation locally immediately
      applyLocalOperation(op);

      // 2. Add to pending operations queue
      pendingOpsRef.current.push(op);

      // 3. Emit via WebSockets
      if (socket.connected) {
        socket.emit('submit-operation', { documentId, operation: op });
      } else {
        setStatus('offline');
      }
    },
    [documentId, applyLocalOperation]
  );

  // Initialize and connect socket
  useEffect(() => {
    let active = true;

    // Load initial state via HTTP
    const fetchInitialDocument = async () => {
      try {
        const doc = await apiFetch(`/documents/documents/${documentId}`);
        if (!active) return;
        setBlocks(doc.content);
        setVersion(doc.version);
        setStatus('connected');

        // Connect socket
        const socket = connectSocket();

        // Join document room
        socket.emit('join-document', { documentId });

        // Setup operation broadcast listener
        socket.on('operation-broadcast', ({ operation, version: serverVersion }: { operation: any; version: number }) => {
          if (operation.clientId === socket.id) return; // Ignore self broadcast

          // Apply incoming server operation to local blocks
          applyLocalOperation(operation);
          setVersion(serverVersion);
        });

        // Setup acknowledgment listener
        socket.on('operation-acknowledged', ({ opId, version: serverVersion }: { opId: string; version: number }) => {
          // Remove acknowledged operation from pending list
          pendingOpsRef.current = pendingOpsRef.current.filter((op) => op.id !== opId);
          setVersion(serverVersion);
        });

        // Setup rejection/conflict rebase listener
        socket.on(
          'operation-rejected',
          ({
            opId,
            currentVersion,
            operationsToReplay,
          }: {
            opId: string;
            currentVersion: number;
            operationsToReplay: any[];
          }) => {
            console.warn(`[Sync Engine] Conflict detected for operation: ${opId}. Starting rebase...`);

            // 1. Rollback all pending operations from current blocks
            // (We reload authoritative state by re-playing server operations from the client's base version)
            // But since we are receiving all missing operations, we can just apply all operationsToReplay
            // to our blocks AFTER removing local pending ops, and then re-apply transformed local pending ops.

            // Get the rejected operation (it is at the front of pending queue)
            const rejectedOp = pendingOpsRef.current.find((op) => op.id === opId);
            if (!rejectedOp) return;

            // Apply all newer server operations
            setBlocks((prev) => {
              let authoritative = [...prev];

              // Rollback all pending edits by refetching/re-applying from server's state
              // To make it easy, we can apply server operations one by one:
              for (const serverOp of operationsToReplay) {
                // Check if we already applied it
                authoritative = applyOperationToContent(authoritative, serverOp);
              }

              // Transform our pending edits over the incoming server operations
              pendingOpsRef.current = pendingOpsRef.current.map((pendingOp) => {
                let transformed = { ...pendingOp };
                for (const serverOp of operationsToReplay) {
                  transformed = transformOperation(transformed, serverOp);
                }
                return transformed;
              });

              // Re-apply transformed pending operations locally
              for (const pendingOp of pendingOpsRef.current) {
                authoritative = applyOperationToContent(authoritative, pendingOp);
              }

              return authoritative;
            });

            // Update local version
            setVersion(currentVersion);

            // Re-submit the transformed operations to the server with the new base version
            pendingOpsRef.current.forEach((pendingOp) => {
              pendingOp.version = currentVersion;
              socket.emit('submit-operation', { documentId, operation: pendingOp });
            });
          }
        );

        // Presence listener
        socket.on('presence-broadcast', (presences: Presence[]) => {
          setPresence(presences.filter((p) => p.userId !== socket.id));
        });

        socket.on('disconnect', () => {
          setStatus('offline');
        });

        socket.on('connect', () => {
          setStatus('connected');
          // Re-join and replay any offline accumulated operations
          socket.emit('join-document', { documentId });
          if (pendingOpsRef.current.length > 0) {
            pendingOpsRef.current.forEach((op) => {
              socket.emit('submit-operation', { documentId, operation: op });
            });
          }
        });
      } catch (err) {
        console.error('Failed to initialize document sync:', err);
        setStatus('offline');
      }
    };

    fetchInitialDocument();

    return () => {
      active = false;
      const socket = getSocket();
      socket.off('operation-broadcast');
      socket.off('operation-acknowledged');
      socket.off('operation-rejected');
      socket.off('presence-broadcast');
      socket.off('disconnect');
      socket.off('connect');
    };
  }, [documentId, applyLocalOperation]);

  // Update cursor position presence
  const updateCursor = useCallback(
    (cursor: { line: number; ch: number } | null, selection: { anchor: number; head: number } | null) => {
      const socket = getSocket();
      if (socket.connected) {
        socket.emit('presence-update', { documentId, cursor, selection });
      }
    },
    [documentId]
  );

  // Update typing indicator presence
  const updateTyping = useCallback(
    (isTyping: boolean) => {
      const socket = getSocket();
      if (socket.connected) {
        socket.emit('typing-update', { documentId, isTyping });
      }
    },
    [documentId]
  );

  // Local helper to apply operations directly (used for server-replay loop)
  const applyOperationToContent = (content: Block[], op: any): Block[] => {
    const newContent = [...content];
    switch (op.type) {
      case 'insert_block': {
        const { index, block } = op.payload;
        newContent.splice(index, 0, block);
        break;
      }
      case 'delete_block': {
        const { blockId } = op.payload;
        return newContent.filter((b) => b.id !== blockId);
      }
      case 'update_block': {
        const { blockId, content: text, properties } = op.payload;
        const idx = newContent.findIndex((b) => b.id === blockId);
        if (idx !== -1) {
          newContent[idx] = {
            ...newContent[idx],
            content: text !== undefined ? text : newContent[idx].content,
            properties: properties !== undefined ? { ...newContent[idx].properties, ...properties } : newContent[idx].properties,
          };
        }
        break;
      }
    }
    return newContent;
  };

  return {
    blocks,
    version,
    presence,
    status,
    submitOperation,
    updateCursor,
    updateTyping,
  };
};
