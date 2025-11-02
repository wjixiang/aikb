import crypto from "crypto";
import { getChatModel } from "./provider";
import { HumanMessage } from "@langchain/core/messages";

interface BaseChunk {
  id: string;
  content: string;
  length: number;
}

interface LengthChunk extends BaseChunk {}

interface OutlineChunk {
  title: string;
  content: string;
  level: number;
}

interface PatternChunk extends BaseChunk {
  header?: string;
  name?: string;
}

interface SemanticChunk {
  id: string;
  name: string;
  summary?: string;
  content: string;
  start_pos: number;
  end_pos: number;
}

type InitialSegmentData = {
  summary?: string;
  content: string;
  start_pos: number;
  end_pos: number;
};

function splitSentences(text: string): string[] {
  const delimiters = /[.。?？!！;；\n]/;
  const sentences: string[] = [];
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    if (delimiters.test(text[i])) {
      const sentence = text.substring(start, i + 1).trim();
      if (sentence) {
        sentences.push(sentence);
      }
      start = i + 1;
    }
  }
  const lastSentence = text.substring(start).trim();
  if (lastSentence) {
    sentences.push(lastSentence);
  }
  return sentences;
}

function generateHash(content: string): string {
  return crypto.createHash("md5").update(content).digest("hex");
}

async function callLlm(prompt: string): Promise<string> {
  try {
    const chatModel = getChatModel()("gpt-4o-mini", 0.1);
    const response = await chatModel.invoke([new HumanMessage(prompt)]);
    const content = response.content;
    if (typeof content !== "string") {
      console.error("LLM response content is not a string:", content);
      return JSON.stringify(content);
    }
    return content;
  } catch (error) {
    console.error("Error calling LLM:", error);
    return "";
  }
}

export default class TextSplitter {
  lengthSplit(
    text: string,
    splitLength: number,
    windowLength: number,
  ): LengthChunk[] {
    const sentences = splitSentences(text);
    const chunks: string[][] = [];
    let currentChunkSentences: string[] = [];
    let currentLength = 0;

    for (const sentence of sentences) {
      const sentenceLength = sentence.length;
      if (currentLength > 0 && currentLength + sentenceLength > splitLength) {
        if (currentChunkSentences.length > 0) {
          chunks.push([...currentChunkSentences]);
        }

        let overlapSentences: string[] = [];
        let overlapLength = 0;
        for (let i = currentChunkSentences.length - 1; i >= 0; i--) {
          const s = currentChunkSentences[i];
          const sLen = s.length;
          if (overlapLength >= windowLength && overlapSentences.length > 0)
            break;
          if (overlapLength + sLen <= splitLength) {
            overlapSentences.unshift(s);
            overlapLength += sLen;
          } else if (overlapSentences.length === 0) {
            const truncated = s.substring(0, Math.min(sLen, splitLength));
            overlapSentences.unshift(truncated);
            overlapLength += truncated.length;
            console.warn(
              `Sentence starting with "${s.substring(0, 30)}..." is longer than splitLength (${splitLength}) and has been truncated in overlap.`,
            );
            break;
          } else {
            break;
          }
        }

        if (overlapSentences.length === 0 && currentChunkSentences.length > 0) {
          const lastSentence =
            currentChunkSentences[currentChunkSentences.length - 1];
          if (lastSentence.length <= splitLength) {
            overlapSentences.push(lastSentence);
            overlapLength = lastSentence.length;
          } else {
            const truncated = lastSentence.substring(0, splitLength);
            overlapSentences.push(truncated);
            overlapLength = truncated.length;
            console.warn(
              `Sentence starting with "${lastSentence.substring(0, 30)}..." is longer than splitLength (${splitLength}) and has been truncated in overlap.`,
            );
          }
        }

        currentChunkSentences = [...overlapSentences];
        currentLength = overlapLength;

        if (sentenceLength > splitLength) {
          console.warn(
            `Sentence starting with "${sentence.substring(0, 30)}..." is longer than splitLength (${splitLength}). Adding as potentially oversized/truncated chunk.`,
          );
          if (
            chunks.length > 0 &&
            chunks[chunks.length - 1].join("\n") !==
              currentChunkSentences.join("\n")
          ) {
            const truncatedSentence = sentence.substring(0, splitLength);
            chunks.push([truncatedSentence]);
            currentChunkSentences = [];
            currentLength = 0;
            continue;
          } else {
            const truncatedSentence = sentence.substring(0, splitLength);
            currentChunkSentences = [truncatedSentence];
            currentLength = truncatedSentence.length;
          }
        } else if (currentLength + sentenceLength <= splitLength) {
          currentChunkSentences.push(sentence);
          currentLength += sentenceLength;
        } else {
          if (currentChunkSentences.length > 0) {
            if (
              chunks.length === 0 ||
              chunks[chunks.length - 1].join("\n") !==
                currentChunkSentences.join("\n")
            ) {
              chunks.push([...currentChunkSentences]);
            }
          }
          currentChunkSentences = [sentence];
          currentLength = sentenceLength;
        }
      } else {
        if (
          sentenceLength > splitLength &&
          currentChunkSentences.length === 0
        ) {
          console.warn(
            `Sentence starting with "${sentence.substring(0, 30)}..." is longer than splitLength (${splitLength}). Adding as potentially oversized/truncated chunk.`,
          );
          const truncatedSentence = sentence.substring(0, splitLength);
          chunks.push([truncatedSentence]);
          currentChunkSentences = [];
          currentLength = 0;
          continue;
        }
        currentChunkSentences.push(sentence);
        currentLength += sentenceLength;
      }
    }

    if (currentChunkSentences.length > 0) {
      if (
        chunks.length === 0 ||
        chunks[chunks.length - 1].join("\n") !==
          currentChunkSentences.join("\n")
      ) {
        chunks.push(currentChunkSentences);
      }
    }

    const result: LengthChunk[] = chunks.map((chunkSentences) => {
      const content = chunkSentences.join("\n");
      return {
        id: generateHash(content),
        content: content,
        length: content.length,
      };
    });

    return result;
  }

  private async extractOutlines(text: string): Promise<[string, number][]> {
    const prompt = `...`; // Keep original prompt
    const llmResponse = await callLlm(prompt);
    const outlines: [string, number][] = [];
    llmResponse.split("\n").forEach((line) => {
      if (line.includes(",")) {
        const parts = line.split(",");
        const title = parts[0].replace(/^- /, "").trim();
        const level = parseInt(parts[1].trim(), 10);
        if (title && !isNaN(level)) {
          outlines.push([title, level]);
        }
      }
    });
    return outlines;
  }

  private alignOutlines(outlines: [string, number][]): [string, number][] {
    const aligned: [string, number][] = [];
    const stack: number[] = [];

    for (const [title, level] of outlines) {
      while (stack.length > 0 && stack[stack.length - 1] >= level) {
        stack.pop();
      }

      let alignedLevel: number;
      if (stack.length === 0) {
        alignedLevel = 1;
      } else {
        alignedLevel = stack[stack.length - 1] + 1;
      }

      aligned.push([title, alignedLevel]);
      stack.push(alignedLevel);
    }
    return aligned;
  }

  private splitByOutlines(
    text: string,
    outlines: [string, number][],
  ): OutlineChunk[] {
    const chunks: OutlineChunk[] = [];
    let lastPos = 0;
    let parentLevel = 0;
    let parentTitle = "Start";

    for (let i = 0; i < outlines.length; i++) {
      const [title, level] = outlines[i];
      const titlePos = text.indexOf(title, lastPos);

      if (titlePos === -1) {
        console.warn(
          `Outline title "${title}" not found in text after position ${lastPos}. Skipping.`,
        );
        continue;
      }

      if (titlePos > lastPos) {
        const chunkContent = text.substring(lastPos, titlePos).trim();
        if (chunkContent) {
          chunks.push({
            title: parentTitle,
            content: chunkContent,
            level: parentLevel,
          });
        }
      }

      parentLevel = level;
      parentTitle = title;
      lastPos = titlePos + title.length;
    }

    if (lastPos < text.length) {
      const chunkContent = text.substring(lastPos).trim();
      if (chunkContent) {
        chunks.push({
          title: parentTitle,
          content: chunkContent,
          level: parentLevel,
        });
      }
    }

    return chunks;
  }

  private mergeSmallChunks(
    chunks: OutlineChunk[],
    minLength: number,
    targetSize: number,
  ): OutlineChunk[] {
    if (chunks.length === 0) return [];

    const merged: OutlineChunk[] = [];
    let currentChunk: OutlineChunk | null = null;

    for (const chunk of chunks) {
      if (!currentChunk) {
        currentChunk = { ...chunk };
        continue;
      }

      const currentContentLength = currentChunk.content.length;
      const nextContentLength = chunk.content.length;

      if (
        currentContentLength < minLength ||
        currentContentLength + nextContentLength <= targetSize
      ) {
        currentChunk.content += "\n\n" + chunk.content;
        currentChunk.level = Math.min(currentChunk.level, chunk.level);
      } else {
        if (currentContentLength >= minLength) {
          merged.push(currentChunk);
        } else {
          console.warn(
            `Chunk "${currentChunk.title}" was smaller than minLength (${minLength}) and could not be merged further.`,
          );
          merged.push(currentChunk);
        }
        currentChunk = { ...chunk };
      }
    }

    if (currentChunk) {
      if (currentChunk.content.length >= minLength) {
        merged.push(currentChunk);
      } else {
        if (merged.length > 0) {
          const lastMerged = merged[merged.length - 1];
          if (
            lastMerged.content.length + currentChunk.content.length <=
            targetSize
          ) {
            lastMerged.content += "\n\n" + currentChunk.content;
            lastMerged.level = Math.min(lastMerged.level, currentChunk.level);
            console.log(
              `Merged final small chunk ("${currentChunk.title}") into the previous one ("${lastMerged.title}").`,
            );
          } else {
            console.warn(
              `Final chunk "${currentChunk.title}" was smaller than minLength (${minLength}) and could not be merged.`,
            );
            merged.push(currentChunk);
          }
        } else {
          console.warn(
            `The only chunk generated ("${currentChunk.title}") was smaller than minLength (${minLength}).`,
          );
          merged.push(currentChunk);
        }
      }
    }

    return merged;
  }

  async outlineSplit(
    text: string,
    minLength: number,
    chunkSize: number,
  ): Promise<OutlineChunk[]> {
    const rawOutlines = await this.extractOutlines(text);
    if (rawOutlines.length === 0) {
      console.warn("No outlines extracted. Returning single chunk.");
      return [{ title: "Full Text", content: text, level: 0 }];
    }
    const alignedOutlines = this.alignOutlines(rawOutlines);
    const initialChunks = this.splitByOutlines(text, alignedOutlines);
    const mergedChunks = this.mergeSmallChunks(
      initialChunks,
      minLength,
      chunkSize,
    );
    return mergedChunks;
  }

  private findPatternMatches(
    text: string,
    pattern: RegExp,
    groupMapping: { [key: string]: number },
  ): Record<string, string>[] {
    const matches: Record<string, string>[] = [];
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const matchedGroups: Record<string, string> = {};
      let hasContent = false;
      for (const key in groupMapping) {
        const groupIndex = groupMapping[key];
        if (
          groupIndex >= 0 &&
          groupIndex < match.length &&
          match[groupIndex] !== undefined
        ) {
          matchedGroups[key] = match[groupIndex].trim();
          if (key === "content" && matchedGroups[key]) {
            hasContent = true;
          }
        } else {
          matchedGroups[key] = "";
        }
      }
      if (hasContent) {
        matches.push(matchedGroups);
      } else {
        console.warn(
          `Match found, but 'content' group was missing or empty. Skipping match: ${match[0].substring(0, 50)}...`,
        );
      }

      if (match.index === pattern.lastIndex) {
        pattern.lastIndex++;
      }
    }
    return matches;
  }

  private createInitialChunks(
    matches: Record<string, string>[],
  ): PatternChunk[] {
    return matches.map((match) => {
      const content = match["content"] || "";
      return {
        id: generateHash(content),
        header: match["header"],
        name: match["name"],
        content: content,
        length: content.length,
      };
    });
  }

  private applySlidingWindow(
    chunks: PatternChunk[],
    chunkSize: number,
    windowSize: number,
  ): PatternChunk[] {
    const finalChunks: PatternChunk[] = [];

    for (const chunk of chunks) {
      if (chunk.length <= chunkSize) {
        finalChunks.push(chunk);
        continue;
      }

      const content = chunk.content;
      const sentences = splitSentences(content);
      const windowChunks: PatternChunk[] = [];
      let currentChunkSentences: string[] = [];
      let currentLength = 0;

      for (const sentence of sentences) {
        const sentenceLength = sentence.length;

        if (currentLength > 0 && currentLength + sentenceLength > chunkSize) {
          if (currentChunkSentences.length > 0) {
            const currentContent = currentChunkSentences.join("\n");
            windowChunks.push({
              id: generateHash(currentContent),
              header: chunk.header,
              name: `${chunk.name || "part"}-p${windowChunks.length + 1}`,
              content: currentContent,
              length: currentContent.length,
            });
          }

          let overlapSentences: string[] = [];
          let overlapLength = 0;
          for (let i = currentChunkSentences.length - 1; i >= 0; i--) {
            const s = currentChunkSentences[i];
            const sLen = s.length;
            if (overlapLength >= windowSize && overlapSentences.length > 0)
              break;

            if (overlapLength + sLen <= chunkSize) {
              overlapSentences.unshift(s);
              overlapLength += sLen;
            } else if (overlapSentences.length === 0) {
              const truncated = s.substring(0, Math.min(sLen, chunkSize));
              overlapSentences.unshift(truncated);
              overlapLength += truncated.length;
              console.warn(
                `Sentence starting with "${s.substring(0, 30)}..." is longer than chunkSize (${chunkSize}) and has been truncated in overlap.`,
              );
              break;
            } else {
              break;
            }
          }

          if (
            overlapSentences.length === 0 &&
            currentChunkSentences.length > 0
          ) {
            const lastSentence =
              currentChunkSentences[currentChunkSentences.length - 1];
            if (lastSentence.length <= chunkSize) {
              overlapSentences.push(lastSentence);
              overlapLength = lastSentence.length;
            } else {
              const truncated = lastSentence.substring(0, chunkSize);
              overlapSentences.push(truncated);
              overlapLength = truncated.length;
              console.warn(
                `Sentence starting with "${lastSentence.substring(0, 30)}..." is longer than chunkSize (${chunkSize}) and has been truncated in overlap.`,
              );
            }
          }

          currentChunkSentences = [...overlapSentences];
          currentLength = overlapLength;

          if (sentenceLength > chunkSize) {
            console.warn(
              `Sentence starting with "${sentence.substring(0, 30)}..." is longer than chunkSize (${chunkSize}). Adding as potentially oversized/truncated chunk.`,
            );
            if (
              windowChunks.length > 0 &&
              windowChunks[windowChunks.length - 1].content !==
                currentChunkSentences.join("\n")
            ) {
              const truncatedSentence = sentence.substring(0, chunkSize);
              windowChunks.push({
                id: generateHash(truncatedSentence),
                header: chunk.header,
                name: `${chunk.name || "part"}-p${windowChunks.length + 1}`,
                content: truncatedSentence,
                length: truncatedSentence.length,
              });
              currentChunkSentences = [];
              currentLength = 0;
              continue;
            } else {
              const truncatedSentence = sentence.substring(0, chunkSize);
              currentChunkSentences = [truncatedSentence];
              currentLength = truncatedSentence.length;
            }
          } else if (currentLength + sentenceLength <= chunkSize) {
            currentChunkSentences.push(sentence);
            currentLength += sentenceLength;
          } else {
            if (currentChunkSentences.length > 0) {
              const currentContent = currentChunkSentences.join("\n");
              if (
                windowChunks.length === 0 ||
                windowChunks[windowChunks.length - 1].content !== currentContent
              ) {
                windowChunks.push({
                  id: generateHash(currentContent),
                  header: chunk.header,
                  name: `${chunk.name || "part"}-p${windowChunks.length + 1}`,
                  content: currentContent,
                  length: currentContent.length,
                });
              }
            }
            currentChunkSentences = [sentence];
            currentLength = sentenceLength;
          }
        } else {
          if (
            sentenceLength > chunkSize &&
            currentChunkSentences.length === 0
          ) {
            console.warn(
              `Sentence starting with "${sentence.substring(0, 30)}..." is longer than chunkSize (${chunkSize}). Adding as potentially oversized/truncated chunk.`,
            );
            const truncatedSentence = sentence.substring(0, chunkSize);
            windowChunks.push({
              id: generateHash(truncatedSentence),
              header: chunk.header,
              name: `${chunk.name || "part"}-p${windowChunks.length + 1}`,
              content: truncatedSentence,
              length: truncatedSentence.length,
            });
            currentChunkSentences = [];
            currentLength = 0;
            continue;
          }

          currentChunkSentences.push(sentence);
          currentLength += sentenceLength;
        }
      }

      if (currentChunkSentences.length > 0) {
        const content = currentChunkSentences.join("\n");
        if (
          windowChunks.length === 0 ||
          windowChunks[windowChunks.length - 1].content !== content
        ) {
          windowChunks.push({
            id: generateHash(content),
            header: chunk.header,
            name: `${chunk.name || "part"}-p${windowChunks.length + 1}`,
            content: content,
            length: content.length,
          });
        }
      }
      finalChunks.push(...windowChunks);
    }

    return finalChunks;
  }

  patternSplit(
    text: string,
    pattern: RegExp,
    groupMapping: { [key: string]: number; content: number },
    chunkSize: number,
    windowSize: number,
  ): PatternChunk[] {
    if (!pattern.global) {
      console.warn(
        "Pattern regex should have the global 'g' flag for patternSplit. Adding it.",
      );
      try {
        pattern = new RegExp(
          pattern.source,
          pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g",
        );
      } catch (e) {
        console.error(
          "Failed to add global flag to regex. Proceeding with original.",
          e,
        );
      }
    }
    const matches = this.findPatternMatches(text, pattern, groupMapping);
    if (matches.length === 0) {
      console.warn(
        "No matches found for the pattern. Returning the whole text as one chunk.",
      );
      const content = text;
      return [
        {
          id: generateHash(content),
          content: content,
          length: content.length,
          name: "Full Text (No Pattern Match)",
        },
      ];
    }
    const initialChunks = this.createInitialChunks(matches);
    const finalChunks = this.applySlidingWindow(
      initialChunks,
      chunkSize,
      windowSize,
    );
    return finalChunks;
  }

  private async analyzeSemanticSegments(
    text: string,
    language: string,
  ): Promise<[number, string][]> {
    const prompt = `...`; // Keep original prompt
    const llmResponse = await callLlm(prompt);
    const segments: [number, string][] = [];

    try {
      const jsonResponse = JSON.parse(llmResponse);
      if (Array.isArray(jsonResponse)) {
        jsonResponse.forEach((item) => {
          if (typeof item.start_pos === "number" && item.summary) {
            segments.push([item.start_pos, item.summary]);
          }
        });
        return segments;
      }
    } catch (e) {
      llmResponse.split("\n").forEach((line) => {
        line = line.trim();
        if (line.startsWith("-")) {
          line = line.substring(1).trim();
        }
        if (line.includes(",")) {
          const parts = line.split(",", 2);
          const posStr = parts[0].trim();
          const summary = parts[1]?.trim() || "";
          const pos = parseInt(posStr, 10);
          if (!isNaN(pos)) {
            segments.push([pos, summary]);
          }
        }
      });
    }

    segments.sort((a, b) => a[0] - b[0]);
    return segments;
  }

  private generateSemanticId(
    content: string,
    start: number,
    end: number,
  ): string {
    const uniqueStr = `${content.substring(0, 10)}${start}${end}`;
    return generateHash(uniqueStr);
  }

  private initialSegmentation(
    text: string,
    segments: [number, string][],
  ): InitialSegmentData[] {
    const chunks: InitialSegmentData[] = [];
    let lastPos = 0;

    if (segments.length === 0 || segments[0][0] !== 0) {
      const firstActualStart =
        segments.length > 0 ? segments[0][0] : text.length;
      if (firstActualStart > 0) {
        const initialContent = text.substring(0, firstActualStart).trim();
        if (initialContent) {
          chunks.push({
            summary: "Initial section",
            content: initialContent,
            start_pos: 0,
            end_pos: firstActualStart,
          });
        }
      }
    }

    for (let i = 0; i < segments.length; i++) {
      const start = segments[i][0];
      const end = i + 1 < segments.length ? segments[i + 1][0] : text.length;
      const summary = segments[i][1];

      if (start >= end || start >= text.length) continue;

      const chunkContent = text
        .substring(start, Math.min(end, text.length))
        .trim();

      if (chunkContent) {
        chunks.push({
          summary: summary,
          content: chunkContent,
          start_pos: start,
          end_pos: end,
        });
      }
    }

    return chunks;
  }

  async semanticSplit(
    text: string,
    chunkSize: number,
    language: string,
  ): Promise<SemanticChunk[]> {
    return this._recursiveSemanticSplit(text, chunkSize, language, 0);
  }

  private async _recursiveSemanticSplit(
    text: string,
    chunkSize: number,
    language: string,
    globalOffset: number,
    depth: number = 0,
    parentName: string = "",
  ): Promise<SemanticChunk[]> {
    if (!text || text.length === 0) {
      return [];
    }

    if (depth > 10) {
      console.warn(
        `Maximum recursion depth (10) reached. Returning text as single chunk.`,
      );
      return [
        {
          id: this.generateSemanticId(
            text,
            globalOffset,
            globalOffset + text.length,
          ),
          name: parentName
            ? `${parentName}.trunc`
            : `Segment@${globalOffset}.trunc`,
          summary: "Recursion depth limit reached",
          content: text,
          start_pos: globalOffset,
          end_pos: globalOffset + text.length,
        },
      ];
    }

    const finalChunks: SemanticChunk[] = [];

    if (text.length <= chunkSize) {
      const trimmedText = text.trim();
      if (trimmedText) {
        const startPos = globalOffset;
        const endPos = globalOffset + trimmedText.length;
        const name = parentName
          ? `${parentName}.${depth}`
          : `Segment@${startPos}`;

        finalChunks.push({
          id: this.generateSemanticId(trimmedText, startPos, endPos),
          name: name,
          summary: "",
          content: trimmedText,
          start_pos: startPos,
          end_pos: endPos,
        });
      }
      return finalChunks;
    }

    try {
      const segments = await this.analyzeSemanticSegments(text, language);
      const initialChunks = this.initialSegmentation(text, segments);

      // If segments didn't actually split the text (all in one chunk), fall back
      if (initialChunks.length === 1 && initialChunks[0].content === text) {
        return this._fallbackSplit(
          text,
          chunkSize,
          globalOffset,
          depth,
          parentName,
        );
      }

      for (let i = 0; i < initialChunks.length; i++) {
        const chunk = initialChunks[i];
        const currentGlobalStart = globalOffset + chunk.start_pos;
        const currentName = chunk.summary
          ? `${parentName ? parentName + "." : ""}${chunk.summary.replace(/\s+/g, "_")}`
          : `seg${i + 1}`;

        if (chunk.content.length > chunkSize) {
          const subChunks = await this._recursiveSemanticSplit(
            chunk.content,
            chunkSize,
            language,
            currentGlobalStart,
            depth + 1,
            currentName,
          );
          finalChunks.push(...subChunks);
        } else if (chunk.content.trim()) {
          const trimmedContent = chunk.content.trim();
          const endPos = currentGlobalStart + trimmedContent.length;
          finalChunks.push({
            id: this.generateSemanticId(
              trimmedContent,
              currentGlobalStart,
              endPos,
            ),
            name: currentName,
            summary: chunk.summary || "",
            content: trimmedContent,
            start_pos: currentGlobalStart,
            end_pos: endPos,
          });
        }
      }

      // If we didn't make progress in splitting, fall back
      if (
        finalChunks.length === 0 ||
        (finalChunks.length === 1 && finalChunks[0].content === text)
      ) {
        return this._fallbackSplit(
          text,
          chunkSize,
          globalOffset,
          depth,
          parentName,
        );
      }

      return finalChunks;
    } catch (error) {
      console.error(
        `Error in recursive semantic split at depth ${depth}:`,
        error,
      );
      return this._fallbackSplit(
        text,
        chunkSize,
        globalOffset,
        depth,
        parentName,
      );
    }
  }

  private async _fallbackSplit(
    text: string,
    chunkSize: number,
    globalOffset: number,
    depth: number,
    parentName: string,
  ): Promise<SemanticChunk[]> {
    const finalChunks: SemanticChunk[] = [];
    const sentences = splitSentences(text);
    let currentContent = "";
    let currentStart = 0;

    for (const sentence of sentences) {
      const sentenceStartIndex = text.indexOf(sentence, currentStart);
      if (sentenceStartIndex === -1) {
        console.warn(`Could not find sentence in text segment.`);
        continue;
      }

      if (
        currentContent.length + sentence.length > chunkSize &&
        currentContent
      ) {
        const chunkStartPos = globalOffset + currentStart;
        const chunkEndPos = chunkStartPos + currentContent.length;
        finalChunks.push({
          id: this.generateSemanticId(
            currentContent,
            chunkStartPos,
            chunkEndPos,
          ),
          name: `${parentName || "section"}.${depth}.${finalChunks.length + 1}`,
          summary: "Sentence-based Split",
          content: currentContent,
          start_pos: chunkStartPos,
          end_pos: chunkEndPos,
        });
        currentContent = sentence;
        currentStart = sentenceStartIndex;
      } else {
        if (!currentContent) {
          currentStart = sentenceStartIndex;
        }
        currentContent += (currentContent ? "\n" : "") + sentence;
      }
    }

    if (currentContent) {
      const chunkStartPos = globalOffset + currentStart;
      const chunkEndPos = chunkStartPos + currentContent.length;
      finalChunks.push({
        id: this.generateSemanticId(currentContent, chunkStartPos, chunkEndPos),
        name: `${parentName || "section"}.${depth}.${finalChunks.length + 1}`,
        summary: "Sentence-based Split",
        content: currentContent,
        start_pos: chunkStartPos,
        end_pos: chunkEndPos,
      });
    }

    // Ensure no chunks exceed the size limit
    return finalChunks.map((chunk) => {
      if (chunk.content.length > chunkSize) {
        const truncated = chunk.content.substring(0, chunkSize);
        return {
          ...chunk,
          content: truncated,
          end_pos: chunk.start_pos + truncated.length,
        };
      }
      return chunk;
    });
  }
}
