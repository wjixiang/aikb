import { b } from 'baml_client';
import { ChunkResult } from 'lib/chunking/chunkingTool';

interface HierarchicalChunkResult extends ChunkResult {
  level: number;
  title: string; // Make title required to match BamlMdOutline
}

/**
 * Use LLM to generate outline structure for MinerU-converted markdown content
 */
export class MinerUOutliner {
  config = {
    chunkWindow: 3,
  };
  async generateOutline(markdownChunks: ChunkResult[]) {
    const OutlineResult: HierarchicalChunkResult[] = [
      {
        ...markdownChunks[0],
        level: 1,
        title:
          markdownChunks[0].title || `Section ${markdownChunks[0].index + 1}`,
      },
    ];
    for (let index = 1; index < markdownChunks.length; index++) {
      const currentChunk = markdownChunks[index];
      const chunkTitle =
        currentChunk.title || `Section ${currentChunk.index + 1}`;

      // const context = markdownChunks.slice(index,index + this.config.chunkWindow).map(e=>`# ${e.title}\n\n${e.content}`).join('\n')

      const level = await b.AnalysisHierachy(
        `# ${chunkTitle}\n\n${currentChunk.content.replace(`# ${currentChunk.title}`, '')}`,
        OutlineResult,
        OutlineResult[OutlineResult.length - 1].level,
      );
      console.log(level);
      OutlineResult.push({
        ...currentChunk,
        level: level,
        title: chunkTitle,
      });
    }

    return OutlineResult;
  }
}
