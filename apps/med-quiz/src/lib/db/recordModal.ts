import mongoose from 'mongoose';

const PracticeRecordSchema = new mongoose.Schema({
  userid: { type: String, required: true },
  quizid: { type: String, reqired: true },
  timestamp: { type: Date, reqired: true },
  selectrecord: { type: [String] },
  correct: { type: Boolean, require: true },
});

export const PracticeRecordModal =
  mongoose.models.PracticeRecord ||
  mongoose.model('PracticeRecord', PracticeRecordSchema);
