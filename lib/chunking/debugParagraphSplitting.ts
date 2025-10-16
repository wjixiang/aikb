// 调试段落切分问题
import { chunkTextAdvanced } from './chunkingTool';

const plainText = `这是一段没有标题的普通文本。
它包含多个段落，但没有使用markdown的H1标题格式。
这种情况下，H1策略可能不是最佳选择。`;

console.log('原始文本:');
console.log(JSON.stringify(plainText));
console.log('\n原始文本长度:', plainText.length);

console.log('\n按换行符分割:');
const lines = plainText.split('\n');
console.log('行数:', lines.length);
lines.forEach((line, i) => {
  console.log(`行 ${i}: "${line}" (长度: ${line.length})`);
});

console.log('\n按段落分割 (\\n\\s*\\n):');
const paragraphs = plainText.split(/\n\s*\n/);
console.log('段落数:', paragraphs.length);
paragraphs.forEach((para, i) => {
  console.log(`段落 ${i}: "${para}" (长度: ${para.length})`);
});

console.log('\n修剪后的段落:');
const trimmedParagraphs = paragraphs
  .map((p) => p.trim())
  .filter((p) => p.length > 0);
console.log('修剪后段落数:', trimmedParagraphs.length);
trimmedParagraphs.forEach((para, i) => {
  console.log(`段落 ${i}: "${para}" (长度: ${para.length})`);
});

console.log('\n使用chunkTextAdvanced:');
const chunks = chunkTextAdvanced(plainText, 'paragraph');
console.log('生成的块数:', chunks.length);
chunks.forEach((chunk, i) => {
  console.log(`块 ${i}: "${chunk.content}" (长度: ${chunk.content.length})`);
});
