/**
 * Link statistics and analytics service
 */

import { connectToDatabase } from '@/lib/db/mongodb';
import { LinkIndexingService } from './linkIndexingService';
import { createLoggerWithPrefix } from '@/lib/console/logger';

export interface LinkStats {
  totalDocuments: number;
  totalLinks: number;
  orphanedDocuments: number;
  mostLinkedDocuments: Array<{
    documentId: string;
    title: string;
    linkCount: number;
  }>;
  recentLinks: Array<{
    sourceId: string;
    targetId: string;
    sourceTitle: string;
    targetTitle: string;
    createdAt: Date;
  }>;
  linkDistribution: {
    documentsWithLinks: number;
    documentsWithoutLinks: number;
    averageLinksPerDocument: number;
  };
}

export class LinkStatsService {
  private logger = createLoggerWithPrefix('LinkStatsService');
  private linkService = new LinkIndexingService();

  /**
   * Get comprehensive link statistics
   * @returns Link statistics
   */
  async getLinkStats(): Promise<LinkStats> {
    try {
      const { db } = await connectToDatabase();
      const documentsCollection = db.collection('knowledgeBase');
      const linksCollection = db.collection('links');

      // Get total documents
      const totalDocuments = await documentsCollection.countDocuments();

      // Get total links
      const totalLinks = await linksCollection.countDocuments({
        linkType: 'forward',
      });

      // Get documents with link metadata
      const documents = await documentsCollection
        .find({})
        .project({
          _id: 1,
          key: 1,
          title: 1,
          'metadata.linkCount': 1,
          'metadata.forwardLinks': 1,
          'metadata.backwardLinks': 1,
        })
        .toArray();

      // Calculate statistics
      const documentsWithLinks = documents.filter(
        (doc) => doc.metadata?.linkCount && doc.metadata.linkCount > 0,
      ).length;

      const orphanedDocuments = documents.filter(
        (doc) => !doc.metadata?.linkCount || doc.metadata.linkCount === 0,
      ).length;

      const averageLinksPerDocument =
        totalDocuments > 0 ? totalLinks / totalDocuments : 0;

      // Get most linked documents
      const mostLinked = await linksCollection
        .aggregate([
          { $match: { linkType: 'backward' } },
          { $group: { _id: '$targetId', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ])
        .toArray();

      const mostLinkedDocuments = await Promise.all(
        mostLinked.map(async (item) => {
          const doc = await documentsCollection.findOne({ _id: item._id });
          return {
            documentId: item._id.toString(),
            title: doc?.title || doc?.key || 'Unknown',
            linkCount: item.count,
          };
        }),
      );

      // Get recent links
      const recentLinks = await linksCollection
        .find({ linkType: 'forward' })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();

      return {
        totalDocuments,
        totalLinks,
        orphanedDocuments,
        mostLinkedDocuments,
        recentLinks: recentLinks.map((link) => ({
          sourceId: link.sourceId,
          targetId: link.targetId,
          sourceTitle: link.sourceTitle,
          targetTitle: link.targetTitle,
          createdAt: link.createdAt,
        })),
        linkDistribution: {
          documentsWithLinks,
          documentsWithoutLinks: totalDocuments - documentsWithLinks,
          averageLinksPerDocument,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get link stats', { error });
      throw error;
    }
  }

  /**
   * Get orphaned documents (no links to/from)
   * @returns Array of orphaned documents
   */
  async getOrphanedDocuments() {
    try {
      const { db } = await connectToDatabase();
      const documentsCollection = db.collection('knowledgeBase');

      const documents = await documentsCollection
        .find({
          $or: [
            { 'metadata.linkCount': { $exists: false } },
            { 'metadata.linkCount': 0 },
          ],
        })
        .sort({ lastModified: -1 })
        .toArray();

      return documents.map((doc) => ({
        id: doc._id.toString(),
        key: doc.key,
        title:
          doc.title ||
          doc.key
            .split('/')
            .pop()
            ?.replace(/\.(md|txt|markdown)$/i, ''),
        lastModified: doc.lastModified || new Date(),
      }));
    } catch (error) {
      this.logger.error('Failed to get orphaned documents', { error });
      throw error;
    }
  }

  /**
   * Get broken links (links to non-existent documents)
   * @returns Array of broken links with context
   */
  async getBrokenLinks() {
    try {
      const { db } = await connectToDatabase();
      const linksCollection = db.collection('links');
      const documentsCollection = db.collection('knowledgeBase');

      // Get all forward links
      const forwardLinks = await linksCollection
        .find({ linkType: 'forward' })
        .toArray();

      const brokenLinks = [];

      for (const link of forwardLinks) {
        const targetExists = await documentsCollection.findOne({
          $or: [
            { _id: link.targetId },
            {
              key: {
                $regex: new RegExp(
                  `^${this.escapeRegExp(link.targetTitle)}$`,
                  'i',
                ),
              },
            },
            {
              title: {
                $regex: new RegExp(
                  `^${this.escapeRegExp(link.targetTitle)}$`,
                  'i',
                ),
              },
            },
          ],
        });

        if (!targetExists) {
          brokenLinks.push({
            sourceId: link.sourceId,
            sourceTitle: link.sourceTitle,
            targetTitle: link.targetTitle,
            position: link.position,
            context: link.context,
          });
        }
      }

      return brokenLinks;
    } catch (error) {
      this.logger.error('Failed to get broken links', { error });
      throw error;
    }
  }

  /**
   * Get link activity over time
   * @param days Number of days to look back
   * @returns Link activity data
   */
  async getLinkActivity(days: number = 30) {
    try {
      const { db } = await connectToDatabase();
      const linksCollection = db.collection('links');

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const activity = await linksCollection
        .aggregate([
          {
            $match: {
              createdAt: { $gte: startDate },
              linkType: 'forward',
            },
          },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' },
              },
              count: { $sum: 1 },
            },
          },
          {
            $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 },
          },
        ])
        .toArray();

      return activity.map((item) => ({
        date: new Date(item._id.year, item._id.month - 1, item._id.day),
        count: item.count,
      }));
    } catch (error) {
      this.logger.error('Failed to get link activity', { error });
      throw error;
    }
  }

  /**
   * Escape special characters for regex
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
