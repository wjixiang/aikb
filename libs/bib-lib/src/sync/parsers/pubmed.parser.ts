import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { XMLParser } from 'fast-xml-parser';
import type {
  ParsedArticle,
  ParsedJournal,
  ParsedAuthor,
  ParsedMeshHeading,
  ParsedChemical,
  ParsedGrant,
  ParsedArticleId,
} from './types.js';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: true,
  parseTagValue: true,
  trim: true,
});

export class PubmedParser {
  /**
   * Parse a gzipped PubMed XML file and yield articles
   */
  async *parseFile(filePath: string): AsyncGenerator<ParsedArticle> {
    const readStream = createReadStream(filePath);
    const gzip = createGunzip();
    const pipeline = readStream.pipe(gzip);

    let buffer = '';
    const chunkSize = 64 * 1024; // 64KB chunks

    for await (const chunk of pipeline) {
      buffer += chunk.toString();

      // Find complete PubmedArticle elements
      const articles = this.extractArticles(buffer);
      buffer = articles.remaining;

      for (const articleXml of articles.articles) {
        try {
          const parsed = this.parseArticle(articleXml);
          if (parsed) {
            yield parsed;
          }
        } catch (error) {
          console.error('Error parsing article:', error);
        }
      }
    }

    // Process remaining content
    if (buffer.trim()) {
      const articles = this.extractArticles(buffer);
      for (const articleXml of articles.articles) {
        try {
          const parsed = this.parseArticle(articleXml);
          if (parsed) {
            yield parsed;
          }
        } catch (error) {
          console.error('Error parsing article:', error);
        }
      }
    }
  }

  /**
   * Extract complete PubmedArticle elements from XML string
   */
  private extractArticles(xml: string): { articles: string[]; remaining: string } {
    const articles: string[] = [];
    const openTag = '<PubmedArticle>';
    const closeTag = '</PubmedArticle>';

    let start = 0;
    let openIndex = xml.indexOf(openTag, start);

    while (openIndex !== -1) {
      const closeIndex = xml.indexOf(closeTag, openIndex);
      if (closeIndex === -1) {
        break;
      }

      const articleXml = xml.slice(openIndex, closeIndex + closeTag.length);
      articles.push(articleXml);
      start = closeIndex + closeTag.length;
      openIndex = xml.indexOf(openTag, start);
    }

    return {
      articles,
      remaining: xml.slice(start),
    };
  }

  /**
   * Parse a single PubmedArticle XML element
   */
  private parseArticle(articleXml: string): ParsedArticle | null {
    const parsed = xmlParser.parse(articleXml);
    const pubmedArticle = parsed.PubmedArticle;

    if (!pubmedArticle) {
      return null;
    }

    const medlineCitation = pubmedArticle.MedlineCitation;
    const article = medlineCitation?.Article;
    const pubmedData = pubmedArticle.PubmedData;

    if (!medlineCitation || !article) {
      return null;
    }

    const pmid = BigInt(medlineCitation.PMID['#text'] || medlineCitation.PMID);

    // Parse DateCompleted
    let dateCompleted: Date | undefined;
    if (medlineCitation.DateCompleted) {
      const dc = medlineCitation.DateCompleted;
      dateCompleted = this.parseDate(dc.Year, dc.Month, dc.Day);
    }

    // Parse DateRevised
    let dateRevised: Date | undefined;
    if (medlineCitation.DateRevised) {
      const dr = medlineCitation.DateRevised;
      dateRevised = this.parseDate(dr.Year, dr.Month, dr.Day);
    }

    // Parse journal
    const journal = this.parseJournal(article.Journal);

    // Parse authors
    const authors = this.parseAuthors(article.AuthorList);

    // Parse publication types
    let publicationType: string | undefined;
    if (article.PublicationTypeList?.PublicationType) {
      const types = this.toArray(article.PublicationTypeList.PublicationType);
      publicationType = types.map((t: any) => t['#text'] || t).join('; ');
    }

    // Parse MeSH headings
    const meshHeadings = this.parseMeshHeadings(medlineCitation.MeshHeadingList);

    // Parse chemicals
    const chemicals = this.parseChemicals(medlineCitation.ChemicalList);

    // Parse grants
    const grants = this.parseGrants(article.GrantList);

    // Parse article IDs
    const articleIds = this.parseArticleIds(pubmedData?.ArticleIdList);

    return {
      pmid,
      articleTitle: article.ArticleTitle?.['#text'] || article.ArticleTitle || '',
      language: article.Language ? this.toString(article.Language) : undefined,
      publicationType,
      dateCompleted,
      dateRevised,
      publicationStatus: pubmedData?.PublicationStatus,
      journal,
      authors,
      meshHeadings,
      chemicals,
      grants,
      articleIds,
    };
  }

  private parseJournal(journal: any): ParsedJournal | undefined {
    if (!journal) return undefined;

    const journalIssue = journal.JournalIssue;
    let pubYear: number | undefined;
    let pubDate: string | undefined;

    if (journalIssue?.PubDate) {
      const pubDateObj = journalIssue.PubDate;
      pubYear = pubDateObj.Year ? Number(pubDateObj.Year) : undefined;
      if (pubDateObj.Year || pubDateObj.Month) {
        pubDate = [pubDateObj.Month, pubDateObj.Year].filter(Boolean).join(' ');
      }
    }

    // Get ISSN (both print and electronic)
    const issnList = this.toArray(journal.ISSN);
    let issn: string | undefined;
    let issnElectronic: string | undefined;

    for (const issnItem of issnList) {
      const issnStr = issnItem['#text'] || issnItem;
      const issnType = issnItem['@_IssnType'];
      if (issnType === 'Electronic') {
        issnElectronic = issnStr;
      } else {
        issn = issnStr;
      }
    }

    return {
      issn,
      issnElectronic,
      volume: journalIssue?.Volume ? String(journalIssue.Volume) : undefined,
      issue: journalIssue?.Issue ? String(journalIssue.Issue) : undefined,
      pubDate,
      pubYear,
      title: journal.Title,
      isoAbbreviation: journal.ISOAbbreviation,
    };
  }

  private parseAuthors(authorList: any): ParsedAuthor[] {
    if (!authorList) return [];

    const authors = this.toArray(authorList.Author);
    return authors
      .filter((a: any) => a.LastName || a.ForeName)
      .map((a: any) => ({
        lastName: a.LastName,
        foreName: a.ForeName,
        initials: a.Initials,
      }));
  }

  private parseMeshHeadings(meshList: any): ParsedMeshHeading[] {
    if (!meshList) return [];

    const headings = this.toArray(meshList.MeshHeading);
    return headings.map((h: any) => ({
      descriptorName: h.DescriptorName?.['#text'] || h.DescriptorName,
      qualifierName: h.QualifierName?.['#text'] || h.QualifierName,
      ui: h.DescriptorName?.['@_UI'] || h.QualifierName?.['@_UI'],
      majorTopicYN:
        h.DescriptorName?.['@_MajorTopicYN'] === 'Y' ||
        h.QualifierName?.['@_MajorTopicYN'] === 'Y',
    }));
  }

  private parseChemicals(chemicalList: any): ParsedChemical[] {
    if (!chemicalList) return [];

    const chemicals = this.toArray(chemicalList.Chemical);
    return chemicals.map((c: any) => ({
      registryNumber: c.RegistryNumber,
      nameOfSubstance: c.NameOfSubstance?.['#text'] || c.NameOfSubstance,
    }));
  }

  private parseGrants(grantList: any): ParsedGrant[] {
    if (!grantList) return [];

    const grants = this.toArray(grantList.Grant);
    return grants.map((g: any) => ({
      grantId: g.GrantID,
      agency: g.Agency,
      country: g.Country,
    }));
  }

  private parseArticleIds(articleIdList: any): ParsedArticleId[] {
    if (!articleIdList) return [];

    const ids = this.toArray(articleIdList.ArticleId);
    return ids.map((id: any) => {
      const idType = id['@_IdType'] || 'pubmed';
      const value = id['#text'] || id;

      switch (idType) {
        case 'pubmed':
          return { pubmed: BigInt(value) };
        case 'doi':
          return { doi: value };
        case 'pii':
          return { pii: value };
        case 'pmc':
          return { pmc: value };
        default:
          return { otherId: value, otherIdType: idType };
      }
    });
  }

  private parseDate(year: any, month: any, day: any): Date | undefined {
    if (!year) return undefined;
    const y = Number(year);
    const m = month ? this.monthToNumber(month) : 1;
    const d = day ? Number(day) : 1;
    return new Date(y, m - 1, d);
  }

  private monthToNumber(month: string): number {
    const months: Record<string, number> = {
      Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
      Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
    };
    return months[month] || 1;
  }

  private toArray(value: any): any[] {
    if (Array.isArray(value)) return value;
    if (value === undefined || value === null) return [];
    return [value];
  }

  private toString(value: any): string {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.join('; ');
    return String(value || '');
  }
}
