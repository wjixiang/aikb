const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
  oid: { type: String, enum: ['A', 'B', 'C', 'D', 'E'], required: true },
  text: { type: String, required: true },
  _id: false,
});

const analysisSchema = new mongoose.Schema({
  point: { type: String, default: null },
  discuss: { type: String, default: null },
  link: { type: [String], default: [] },
});

const A1Schema = new mongoose.Schema({
  type: { type: String, enum: ['A1'], required: true },
  class: { type: String },
  unit: { type: String },
  tags: { type: [String] },
  extractedYear: { type: Number },
  question: { type: String, required: true },
  options: [optionSchema],
  answer: { type: String, enum: ['A', 'B', 'C', 'D', 'E'], required: true },
  analysis: analysisSchema,
});

const A2Schema = new mongoose.Schema({
  type: { type: String, enum: ['A2'], required: true },
  class: { type: String },
  unit: { type: String },
  tags: { type: [String] },
  extractedYear: { type: Number },
  question: { type: String, required: true },
  options: [optionSchema],
  answer: { type: String, enum: ['A', 'B', 'C', 'D', 'E'], required: true },
  analysis: analysisSchema,
});

const A3Schema = new mongoose.Schema({
  type: { type: String, enum: ['A3'], required: true },
  class: { type: String },
  unit: { type: String },
  tags: { type: [String] },
  extractedYear: { type: Number },
  mainQuestion: { type: String, required: true },
  subQuizs: [
    {
      subQuizId: { type: Number, required: true },
      question: { type: String, required: true },
      options: [optionSchema],
      answer: { type: String, enum: ['A', 'B', 'C', 'D', 'E'], required: true },
    },
  ],
  analysis: analysisSchema,
});

const XSchema = new mongoose.Schema({
  type: { type: String, enum: ['X'], required: true },
  class: { type: String },
  unit: { type: String },
  tags: { type: [String] },
  extractedYear: { type: Number },
  question: { type: String, required: true },
  options: [optionSchema],
  answer: [{ type: String, enum: ['A', 'B', 'C', 'D', 'E'], required: true }],
  analysis: analysisSchema,
});

const BSchema = new mongoose.Schema({
  type: { type: String, enum: ['B'], required: true },
  class: { type: String },
  unit: { type: String },
  tags: { type: [String] },
  extractedYear: { type: Number },
  questions: [
    {
      questionId: { type: Number, required: true },
      questionText: { type: String, required: true },
      answer: { type: String, enum: ['A', 'B', 'C', 'D', 'E'], required: true },
    },
  ],
  options: [optionSchema],
  analysis: analysisSchema,
});

const quizModal = {
  a1: mongoose.models.A1 || mongoose.model('A1', A1Schema),
  a2: mongoose.models.A2 || mongoose.model('A2', A2Schema),
  a3: mongoose.models.A3 || mongoose.model('A3', A3Schema),
  b: mongoose.models.B || mongoose.model('B', BSchema),
  x: mongoose.models.X || mongoose.model('X', XSchema),
};

export default quizModal;
