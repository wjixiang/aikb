import { b } from "baml_client";
import { ChunkResult } from "knowledgeBase/lib/chunking/chunkingTool";

interface HierarchicalChunkResult extends ChunkResult{
    level: number;
}

/**
 * Use LLM to generate outline structure for MinerU-converted markdown content
 */
export class MinerUOutliner {
    config = {
        chunkWindow: 3
    }
    async generateOutline(markdownChunks: ChunkResult[]) {
        const OutlineResult: HierarchicalChunkResult[] = [{...markdownChunks[0], level:1}]
        for (let index = 1; index < markdownChunks.length; index++) {
            const currentChunk = markdownChunks[index]
            
            // const context = markdownChunks.slice(index,index + this.config.chunkWindow).map(e=>`# ${e.title}\n\n${e.content}`).join('\n')

            const level = await b.AnalysisHierachy(`# ${currentChunk.title}\n\n${currentChunk.content.replace(`# ${currentChunk.title}`,"")}`, OutlineResult, OutlineResult[OutlineResult.length-1].level)
            console.log(level)
            OutlineResult.push({...currentChunk, level: level})
        }

        return OutlineResult
    }
}