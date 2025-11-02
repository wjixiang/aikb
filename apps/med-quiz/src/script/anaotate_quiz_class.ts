import { b } from "@/baml_client/async_client";
import { connectToDatabase } from "@/lib/db/mongodb";
import QuizStorage from "@/lib/quiz/QuizStorage";
import { quiz } from "@/types/quizData.types";
import pLimit from "p-limit";

async function annotate_quiz_class() {
  const storage = new QuizStorage();
  const { db } = await connectToDatabase();
  const cursor = db.collection<quiz>("quiz").find({
    $or: [
      { class: { $exists: false } },
      {
        class: {
          $type: "string",
          $regex: /^.{0,0}$/,
        },
      },
    ],
  });
  // console.log(await cursor.next())
  // Set concurrency limit
  const limit = pLimit(10);

  const promises = [];
  for await (const element of cursor) {
    promises.push(
      limit(async () => {
        try {
          console.log(`Processing quiz ${element._id}`);
          const theClass = await b.AnnotateClass(
            QuizStorage.formQuizContent(element, true),
          );
          await db
            .collection<quiz>("quiz")
            .updateOne({ _id: element._id }, { $set: { class: theClass } });
          console.log(`Updated quiz ${element._id} with class: ${theClass}`);
        } catch (error) {
          console.error(`Failed to process quiz ${element._id}:`, error);
        }
      }),
    );
  }

  // Wait for all promises to settle
  await Promise.all(promises);
}

annotate_quiz_class();
