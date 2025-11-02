import * as dotenv from "dotenv";
dotenv.config()
import { QuizParser } from '../QuizParser';


const sampleQuestions = `
1. What is the capital of France?
   A) London
   B) Paris
   C) Berlin
   D) Madrid

2. Which planet is known as the Red Planet?
   A) Venus
   B) Mars
   C) Jupiter
   D) Saturn

3. What is 2 + 2?
   A) 3
   B) 4
   C) 5
   D) 6
`;

async function testSplitQuestions() {
  const parser = new QuizParser(sampleQuestions, '');
  const questions = await parser.splitQuestions();
  
  console.log('Split Questions:');
  questions.forEach((q, i) => {
    console.log(`\nQuestion ${i + 1}:`);
    console.log(q);
  });
}

testSplitQuestions().catch(console.error);