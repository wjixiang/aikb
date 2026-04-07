import type { FastifyPluginAsync } from 'fastify';
import { ItemService } from './item.service.js';
import { AttachmentService } from './attachment.service.js';
import { itemRoutes } from './routes/item-routes.js';
import { attachmentRoutes } from './routes/attachment-routes.js';
import type { BibItemPluginOptions } from './types.js';

export const bibItemPlugin: FastifyPluginAsync<BibItemPluginOptions> = async (
  fastify,
  options,
) => {
  const {
    itemRepository,
    attachmentRepository,
    storage,
    keyPrefix = 'attachments',
    presignTtl = 3600,
    notFoundError = (entity, id) =>
      new Error(`${entity} with id ${id} not found`),
  } = options;

  const itemService = new ItemService(
    itemRepository,
    storage,
    notFoundError,
  );
  const attachmentService = new AttachmentService(
    attachmentRepository,
    storage,
    { keyPrefix, presignTtl, notFoundError },
  );

  fastify.decorate('itemService', itemService);
  fastify.decorate('attachmentService', attachmentService);

  fastify.register(itemRoutes);
  fastify.register(attachmentRoutes);
};
