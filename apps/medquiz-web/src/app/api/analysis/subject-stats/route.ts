import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { quiz } from '@/types/quizData.types';

const isDebug = process.env.NODE_ENV !== 'production';

export async function GET() {
  try {
    const { client, db } = await connectToDatabase();

    // 调试：检查集合和样本数据
    const collections = await db.listCollections().toArray();
    // if (isDebug) console.log('Available collections:', collections.map(c => c.name));

    // 获取quiz集合样本
    // const quizSample = await db.collection('quiz').findOne({});
    // if (isDebug) console.log('Quiz sample:', quizSample);

    // 获取practicerecords集合样本
    // const recordSample = await db.collection('practicerecords').findOne({});
    // if (isDebug) console.log('Practice record sample:', recordSample);

    // 转换ObjectId格式
    const { ObjectId } = require('mongodb');

    // 获取所有题目按学科分类的总数
    const totalBySubject = await db
      .collection<quiz>('quiz')
      .aggregate([
        { $match: { class: { $exists: true, $ne: '' } } },
        { $group: { _id: '$class', total: { $sum: 1 } } },
      ])
      .toArray();

    if (isDebug) console.log('Total by subject:', totalBySubject);

    // 获取已练习题目按学科分类的数量（唯一记录）
    const practicedBySubject = await db
      .collection('practicerecords')
      .aggregate([
        { $sort: { timestamp: -1 } },
        {
          $group: {
            _id: { userid: '$userid', quizid: '$quizid' },
            latestRecord: { $first: '$$ROOT' },
          },
        },
        { $replaceRoot: { newRoot: '$latestRecord' } },
        {
          $lookup: {
            from: 'quiz',
            let: { quizIdStr: '$quizid' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: [
                      '$_id',
                      {
                        $convert: {
                          input: '$$quizIdStr',
                          to: 'objectId',
                          onError: null,
                          onNull: null,
                        },
                      },
                    ],
                  },
                },
              },
            ],
            as: 'quizData',
          },
        },
        { $unwind: '$quizData' },
        { $match: { 'quizData.class': { $exists: true, $ne: '' } } },
        { $group: { _id: '$quizData.class', practiced: { $sum: 1 } } },
      ])
      .toArray();

    if (isDebug) console.log('Practiced by subject:', practicedBySubject);

    // 合并数据，只包含有练习记录的科目
    const result = totalBySubject
      .map((subject) => {
        const practiced = practicedBySubject.find((p) => p._id === subject._id);
        const percentage =
          practiced && subject.total > 0
            ? Math.round((practiced.practiced / subject.total) * 100)
            : 0;

        return {
          subject: subject._id,
          total: subject.total,
          practiced: practiced?.practiced || 0,
          percentage,
        };
      })
      .filter((item) => item.practiced > 0); // 仅返回有练习记录的科目

    if (isDebug) console.log('Final result:', result);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching subject stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subject stats' },
      { status: 500 },
    );
  }
}
