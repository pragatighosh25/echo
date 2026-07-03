import { db } from '../../services/db';
import { publishEvent } from '../../services/kafka';

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

export const applyOperationToContent = (content: Block[], op: BlockOperation): Block[] => {
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
      const { blockId, content: textContent, properties } = op.payload;
      const blockIndex = newContent.findIndex((b) => b.id === blockId);
      if (blockIndex !== -1) {
        newContent[blockIndex] = {
          ...newContent[blockIndex],
          content: textContent !== undefined ? textContent : newContent[blockIndex].content,
          properties: properties !== undefined ? { ...newContent[blockIndex].properties, ...properties } : newContent[blockIndex].properties,
        };
      }
      break;
    }
    case 'move_block': {
      const { fromIndex, toIndex } = op.payload;
      if (fromIndex >= 0 && fromIndex < newContent.length && toIndex >= 0 && toIndex < newContent.length) {
        const [movedBlock] = newContent.splice(fromIndex, 1);
        newContent.splice(toIndex, 0, movedBlock);
      }
      break;
    }
  }

  return newContent;
};

export const processDocumentOperation = async (
  documentId: string,
  op: BlockOperation
): Promise<{
  success: boolean;
  currentVersion: number;
  operationsToReplay?: any[];
}> => {
  return await db.$transaction(async (tx) => {
    const doc = await tx.document.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      throw new Error(`Document with ID ${documentId} not found`);
    }

    if (op.version !== doc.version) {
      const missingOps = await tx.documentOperation.findMany({
        where: {
          documentId,
          version: {
            gt: op.version,
          },
        },
        orderBy: { version: 'asc' },
      });

      return {
        success: false,
        currentVersion: doc.version,
        operationsToReplay: missingOps,
      };
    }

    const currentBlocks = (doc.content as unknown) as Block[];
    const updatedBlocks = applyOperationToContent(currentBlocks, op);
    const newVersion = doc.version + 1;

    const recordedOp = await tx.documentOperation.create({
      data: {
        documentId,
        version: newVersion,
        clientId: op.clientId,
        type: op.type,
        payload: op.payload,
      },
    });

    await tx.document.update({
      where: { id: documentId },
      data: {
        content: updatedBlocks as any,
        version: newVersion,
      },
    });

    await publishEvent('document.operations', doc.id, {
      documentId,
      operation: recordedOp,
      version: newVersion,
    });

    await publishEvent('activity.events', doc.id, {
      userId: op.clientId,
      action: 'DOCUMENT_EDITED',
      details: { documentId, version: newVersion, type: op.type },
    });

    await publishEvent('search.events', doc.id, {
      documentId,
      action: 'INDEX',
    });

    return {
      success: true,
      currentVersion: newVersion,
    };
  });
};
