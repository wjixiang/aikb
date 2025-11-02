import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { EssayPracticeRecord, EssayGradeResult } from "@/lib/db/essayModels";
import { b } from "@/baml_client";
import { uploadToS3 } from "@/lib/services/s3Service";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const questionPrompt = formData.get("questionPrompt") as string;
    const gradingCriteriaType = formData.get("gradingCriteriaType") as string;
    const essayText = formData.get("essayText") as string;
    const essayImage = formData.get("essayImage") as File;

    if (!questionPrompt) {
      return NextResponse.json(
        { error: "Question prompt is required" },
        { status: 400 },
      );
    }

    if (!essayText && !essayImage) {
      return NextResponse.json(
        { error: "Either essay text or image is required" },
        { status: 400 },
      );
    }

    let imageUrl: string | undefined;
    let finalEssayText = essayText;

    // Handle image upload if provided
    if (essayImage) {
      const buffer = Buffer.from(await essayImage.arrayBuffer());
      const fileName = `essays/${session.user.id}/${Date.now()}-${essayImage.name}`;
      imageUrl = await uploadToS3(buffer, fileName, essayImage.type);
    }

    // Get grading criteria
    const gradingCriteria = await b.GetGradingCriteriaSet(
      gradingCriteriaType || "academic",
    );

    // Grade the essay
    let gradeResult: EssayGradeResult;

    if (essayImage) {
      // Convert image to base64 for BAML
      const buffer = Buffer.from(await essayImage.arrayBuffer());
      const base64Image = buffer.toString("base64");

      const bamlResult = await b.GradeEssayImage(
        {
          essay_image: {
            mediaType: essayImage.type,
            base64: base64Image,
          } as any,
          question_prompt: questionPrompt,
          grading_criteria: [gradingCriteriaType || "academic"],
          user_id: session.user.id,
          submission_time: new Date().toISOString(),
        },
        gradingCriteria,
      );

      gradeResult = mapBamlResultToEssayGrade(bamlResult);
    } else if (essayText) {
      const bamlResult = await b.GradeEssayText(
        {
          essay_text: essayText,
          question_prompt: questionPrompt,
          grading_criteria: [gradingCriteriaType || "academic"],
          user_id: session.user.id,
          submission_time: new Date().toISOString(),
        },
        gradingCriteria,
      );

      gradeResult = mapBamlResultToEssayGrade(bamlResult);
    } else {
      return NextResponse.json(
        { error: "No essay content provided" },
        { status: 400 },
      );
    }

    // Save to database
    const { db } = await connectToDatabase();

    const practiceRecord: EssayPracticeRecord = {
      userId: session.user.id,
      questionPrompt,
      essayText: finalEssayText,
      essayImageUrl: imageUrl,
      gradingCriteria: [gradingCriteriaType || "academic"],
      gradeResult,
      submissionTime: new Date(),
      feedbackRead: false,
      savedToFavorites: false,
    };

    const result = await db
      .collection("essay_practice_records")
      .insertOne(practiceRecord);

    return NextResponse.json({
      success: true,
      recordId: result.insertedId,
      gradeResult,
    });
  } catch (error) {
    console.error("Error submitting essay:", error);
    return NextResponse.json(
      { error: "Failed to process essay submission" },
      { status: 500 },
    );
  }
}

function mapBamlResultToEssayGrade(bamlResult: any): EssayGradeResult {
  return {
    overallScore: bamlResult.overall_score,
    criteriaScores: bamlResult.criteria_scores.map((cs: any) => ({
      criteriaName: cs.criteria_name,
      score: cs.score,
      feedback: cs.feedback,
      maxScore: cs.max_score || 100,
    })),
    detailedFeedback: bamlResult.detailed_feedback,
    grammarCorrections: bamlResult.grammar_corrections.map((gc: any) => ({
      originalText: gc.original_text,
      correctedText: gc.corrected_text,
      explanation: gc.explanation,
      positionStart: gc.position_start,
      positionEnd: gc.position_end,
    })),
    vocabularySuggestions: bamlResult.vocabulary_suggestions.map((vs: any) => ({
      originalWord: vs.original_word,
      suggestedWord: vs.suggested_word,
      explanation: vs.explanation,
      positionStart: vs.position_start,
      positionEnd: vs.position_end,
    })),
    structureAnalysis: {
      introductionScore: bamlResult.structure_analysis.introduction_score,
      bodyParagraphsScore: bamlResult.structure_analysis.body_paragraphs_score,
      conclusionScore: bamlResult.structure_analysis.conclusion_score,
      coherenceScore: bamlResult.structure_analysis.coherence_score,
      transitionScore: bamlResult.structure_analysis.transition_score,
    },
    improvementSuggestions: bamlResult.improvement_suggestions,
    gradingTime: new Date(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");

    const { db } = await connectToDatabase();

    const records = await db
      .collection("essay_practice_records")
      .find({ userId: session.user.id })
      .sort({ submissionTime: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    const total = await db
      .collection("essay_practice_records")
      .countDocuments({ userId: session.user.id });

    return NextResponse.json({
      records,
      total,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error("Error fetching essay records:", error);
    return NextResponse.json(
      { error: "Failed to fetch essay records" },
      { status: 500 },
    );
  }
}
