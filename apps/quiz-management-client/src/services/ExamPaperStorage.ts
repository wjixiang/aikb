import * as fs from 'fs';
import * as path from 'path';
import { ExamPaper, IExamPaperStorage } from '../types/examPaper.types';

/**
 * 基于文件系统的试卷存储实现
 */
export class FileExamPaperStorage implements IExamPaperStorage {
  private readonly storageDir: string;
  private readonly indexFile: string;

  constructor(storageDir: string = './data/examPapers') {
    this.storageDir = storageDir;
    this.indexFile = path.join(storageDir, 'index.json');
    this.ensureStorageDirectory();
  }

  /**
   * 确保存储目录存在
   */
  private ensureStorageDirectory(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  /**
   * 读取索引文件
   */
  private readIndex(): Record<string, ExamPaper> {
    try {
      if (!fs.existsSync(this.indexFile)) {
        return {};
      }
      const data = fs.readFileSync(this.indexFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to read index file:', error);
      return {};
    }
  }

  /**
   * 写入索引文件
   */
  private writeIndex(index: Record<string, ExamPaper>): void {
    try {
      fs.writeFileSync(this.indexFile, JSON.stringify(index, null, 2));
    } catch (error) {
      console.error('Failed to write index file:', error);
      throw new Error('Failed to save exam paper index');
    }
  }

  /**
   * 保存试卷数据到单独文件
   */
  private saveExamPaperFile(examPaper: ExamPaper): void {
    const filePath = path.join(this.storageDir, `${examPaper.id}.json`);
    try {
      fs.writeFileSync(filePath, JSON.stringify(examPaper, null, 2));
    } catch (error) {
      console.error('Failed to save exam paper file:', error);
      throw new Error('Failed to save exam paper file');
    }
  }

  /**
   * 从单独文件读取试卷数据
   */
  private readExamPaperFile(id: string): ExamPaper | null {
    const filePath = path.join(this.storageDir, `${id}.json`);
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }
      const data = fs.readFileSync(filePath, 'utf8');
      const examPaper = JSON.parse(data);
      // 确保日期字段是Date对象
      examPaper.createdAt = new Date(examPaper.createdAt);
      examPaper.updatedAt = new Date(examPaper.updatedAt);
      return examPaper;
    } catch (error) {
      console.error('Failed to read exam paper file:', error);
      return null;
    }
  }

  /**
   * 删除试卷文件
   */
  private deleteExamPaperFile(id: string): void {
    const filePath = path.join(this.storageDir, `${id}.json`);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('Failed to delete exam paper file:', error);
    }
  }

  /**
   * 保存试卷
   */
  async save(examPaper: ExamPaper): Promise<ExamPaper> {
    const index = this.readIndex();
    
    // 如果是更新，保留原有的创建时间
    if (index[examPaper.id]) {
      examPaper.createdAt = new Date(index[examPaper.id].createdAt);
    } else {
      examPaper.createdAt = new Date();
    }
    
    examPaper.updatedAt = new Date();
    
    // 保存到索引和单独文件
    index[examPaper.id] = examPaper;
    this.writeIndex(index);
    this.saveExamPaperFile(examPaper);
    
    return examPaper;
  }

  /**
   * 根据ID查找试卷
   */
  async findById(id: string): Promise<ExamPaper | null> {
    return this.readExamPaperFile(id);
  }

  /**
   * 查找所有试卷
   */
  async findAll(): Promise<ExamPaper[]> {
    const index = this.readIndex();
    return Object.values(index).map(examPaper => ({
      ...examPaper,
      createdAt: new Date(examPaper.createdAt),
      updatedAt: new Date(examPaper.updatedAt)
    }));
  }

  /**
   * 更新试卷
   */
  async update(id: string, updates: Partial<ExamPaper>): Promise<ExamPaper> {
    const existingExamPaper = await this.findById(id);
    if (!existingExamPaper) {
      throw new Error(`Exam paper with id ${id} not found`);
    }
    
    const updatedExamPaper: ExamPaper = {
      ...existingExamPaper,
      ...updates,
      id, // 确保ID不被覆盖
      createdAt: existingExamPaper.createdAt, // 保留原创建时间
      updatedAt: new Date()
    };
    
    return this.save(updatedExamPaper);
  }

  /**
   * 删除试卷
   */
  async delete(id: string): Promise<boolean> {
    const index = this.readIndex();
    if (!index[id]) {
      return false;
    }
    
    // 从索引中删除
    delete index[id];
    this.writeIndex(index);
    
    // 删除单独文件
    this.deleteExamPaperFile(id);
    
    return true;
  }
}