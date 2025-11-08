import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { ObjectId } from 'mongodb';
import { createLoggerWithPrefix } from '@/lib/console/logger';
import QuizStorage, {
  PracticeRecord,
  PracticeRecordData,
} from '@/lib/quiz/QuizStorage';

const logger = createLoggerWithPrefix('PracticeAnalysisRoute');

export async function GET(request: NextRequest) {
  logger.info('GET request received');
  try {
    // 获取当前用户会话
    logger.debug('Fetching user session');
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      logger.warning('Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.email;
    if (!userId) {
      logger.warning('User ID not found in session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    logger.debug(`User ID: ${userId}`);

    // Instantiate QuizStorage
    const quizStorage = new QuizStorage();

    // 获取过去365天的日期范围（考虑到用户可能会选择查看全年数据）
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 365);
    logger.debug(
      `Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    // 先获取所有练习记录
    // logger.debug('Fetching practice records');
    const practiceRecords: PracticeRecord[] =
      await quizStorage.fetchPracticeRecords(userId, startDate, endDate);
    // logger.debug(`Fetched ${practiceRecords.length} practice records`);
    // logger.debug('Practice records:', practiceRecords);
    // Find and log the latest practice record
    const latestRecord = practiceRecords.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )[0];
    // logger.debug('Latest practice record:', latestRecord);

    // 从练习记录中提取所有题目ID
    logger.debug('Extracting quiz IDs from practice records');
    const quizIds = practiceRecords
      .filter((record) => record.quizid)
      .map((record) => {
        try {
          return new ObjectId(record.quizid);
        } catch (e) {
          return null;
        }
      })
      .filter((id: ObjectId | null) => id !== null);
    logger.debug(`Extracted ${quizIds.length} unique quiz IDs`);

    // 从单一quiz集合中查询题目
    logger.debug('Fetching quizzes based on extracted IDs');
    const quizClassMap: Record<string, string> =
      await quizStorage.createQuizSubjectMap(quizIds as ObjectId[]);
    logger.debug('Quiz ID to subject mapping created');
    // logger.debug(`${JSON.stringify(quizClassMap)}`)

    // 为每条记录找到对应的科目
    logger.debug('Assigning subjects to practice records');
    practiceRecords.forEach((record) => {
      record.subject = quizClassMap[record.quizid] || '未分类';
    });
    logger.debug('Subjects assigned to practice records');

    // 按日期和科目分组计算统计数据
    logger.debug('Grouping and calculating statistics by date and subject');
    // 正确定义类型
    interface DayStats {
      date: string;
      count: number;
      correctCount: number;
      subjectData: Record<string, { count: number; correctCount: number }>;
    }

    const dateSubjectMap: Record<string, DayStats> = {};

    practiceRecords.forEach((record) => {
      const date = new Date(record.timestamp);
      const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      if (!dateSubjectMap[dateString]) {
        dateSubjectMap[dateString] = {
          date: dateString,
          count: 0,
          correctCount: 0,
          subjectData: {},
        };
      }

      // 更新总计数据
      dateSubjectMap[dateString].count += 1;
      if (record.correct) {
        dateSubjectMap[dateString].correctCount += 1;
      }

      // 更新科目数据
      const subject = record.subject || '未分类'; // Ensure subject is not undefined
      if (!dateSubjectMap[dateString].subjectData[subject]) {
        dateSubjectMap[dateString].subjectData[subject] = {
          count: 0,
          correctCount: 0,
        };
      }

      dateSubjectMap[dateString].subjectData[subject].count += 1;
      if (record.correct) {
        dateSubjectMap[dateString].subjectData[subject].correctCount += 1;
      }
    });

    // logger.debug('Statistics calculated');
    // logger.debug('Date subject map:', dateSubjectMap);

    // 转换为数组并排序
    // logger.debug('Converting to array and sorting');
    const practiceStats = Object.values(dateSubjectMap).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    // logger.debug('Practice stats sorted by date');
    // logger.debug('Final practice stats:', practiceStats);

    logger.info('Successfully fetched practice stats');
    return NextResponse.json(practiceStats);
  } catch (error) {
    logger.error('Error fetching practice stats:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
