"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface EssayGradeResult {
  overallScore: number;
  criteriaScores: Array<{
    criteriaName: string;
    score: number;
    feedback: string;
    maxScore: number;
  }>;
  detailedFeedback: string;
  grammarCorrections: Array<{
    originalText: string;
    correctedText: string;
    explanation: string;
    positionStart: number;
    positionEnd: number;
  }>;
  vocabularySuggestions: Array<{
    originalWord: string;
    suggestedWord: string;
    explanation: string;
    positionStart: number;
    positionEnd: number;
  }>;
  structureAnalysis: {
    introductionScore: number;
    bodyParagraphsScore: number;
    conclusionScore: number;
    coherenceScore: number;
    transitionScore: number;
  };
  improvementSuggestions: string[];
}

interface EssayRecord {
  _id: string;
  questionPrompt: string;
  essayText?: string;
  essayImageUrl?: string;
  gradingCriteria: string[];
  gradeResult: EssayGradeResult;
  submissionTime: string;
}

const GRADING_CRITERIA_OPTIONS = [
  {
    value: "academic",
    label: "Academic Essay",
    description: "University-level academic writing",
  },
  {
    value: "ielts",
    label: "IELTS Writing",
    description: "IELTS Task 2 essay criteria",
  },
  {
    value: "toefl",
    label: "TOEFL Writing",
    description: "TOEFL independent writing",
  },
  {
    value: "general",
    label: "General English",
    description: "General English writing",
  },
  {
    value: "business",
    label: "Business English",
    description: "Professional business writing",
  },
];

export default function EssayGraderPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [questionPrompt, setQuestionPrompt] = useState("");
  const [essayText, setEssayText] = useState("");
  const [gradingCriteria, setGradingCriteria] = useState("academic");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gradeResult, setGradeResult] = useState<EssayGradeResult | null>(null);
  const [history, setHistory] = useState<EssayRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/auth/signin");
    }
  }, [session, status, router]);

  useEffect(() => {
    if (session) {
      fetchHistory();
    }
  }, [session]);

  const fetchHistory = async () => {
    try {
      const response = await fetch("/api/essay/submit");
      if (response.ok) {
        const data = await response.json();
        setHistory(data.records || []);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionPrompt || (!essayText && !imageFile)) {
      alert("Please provide both question prompt and essay content");
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append("questionPrompt", questionPrompt);
    formData.append("gradingCriteriaType", gradingCriteria);
    if (essayText) formData.append("essayText", essayText);
    if (imageFile) formData.append("essayImage", imageFile);

    try {
      const response = await fetch("/api/essay/submit", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setGradeResult(data.gradeResult);
        fetchHistory();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to submit essay");
      }
    } catch (error) {
      console.error("Error submitting essay:", error);
      alert("Failed to submit essay");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setQuestionPrompt("");
    setEssayText("");
    setImageFile(null);
    setImagePreview(null);
    setGradeResult(null);
  };

  if (status === "loading") {
    return (
      <div className="flex justify-center items-center h-screen">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">English Essay Grader</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Submission Form */}
        <div className="bg-background rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Submit Your Essay</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Question/Prompt
              </label>
              <textarea
                value={questionPrompt}
                onChange={(e) => setQuestionPrompt(e.target.value)}
                className="w-full p-3 border rounded-md"
                rows={3}
                placeholder="Enter the essay question or prompt..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Grading Criteria
              </label>
              <select
                value={gradingCriteria}
                onChange={(e) => setGradingCriteria(e.target.value)}
                className="w-full p-3 border rounded-md"
              >
                {GRADING_CRITERIA_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} - {option.description}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Essay Text
              </label>
              <textarea
                value={essayText}
                onChange={(e) => setEssayText(e.target.value)}
                className="w-full p-3 border rounded-md"
                rows={10}
                placeholder="Type or paste your essay here..."
                disabled={!!imageFile}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Or Upload Image
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="w-full p-3 border rounded-md"
                disabled={!!essayText}
              />
              {imagePreview && (
                <div className="mt-2">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-w-full h-48 object-contain rounded"
                  />
                </div>
              )}
            </div>

            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? "Grading..." : "Submit for Grading"}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
              >
                Reset
              </button>
            </div>
          </form>
        </div>

        {/* Results */}
        {gradeResult && (
          <div className="bg-background rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Grading Results</h2>

            <div className="mb-4">
              <div className="text-3xl font-bold text-blue-600">
                {gradeResult.overallScore}/100
              </div>
              <div className="text-sm text-gray-600">Overall Score</div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Criteria Scores</h3>
              {gradeResult.criteriaScores.map((criteria, index) => (
                <div key={index} className="border-l-4 border-blue-500 pl-4">
                  <div className="flex justify-between">
                    <span className="font-medium">{criteria.criteriaName}</span>
                    <span className="text-blue-600">
                      {criteria.score}/{criteria.maxScore}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {criteria.feedback}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <h3 className="font-semibold mb-2">Detailed Feedback</h3>
              <p className="text-sm text-gray-700">
                {gradeResult.detailedFeedback}
              </p>
            </div>

            <div className="mt-6">
              <h3 className="font-semibold mb-2">Improvement Suggestions</h3>
              <ul className="list-disc list-inside space-y-1">
                {gradeResult.improvementSuggestions.map((suggestion, index) => (
                  <li key={index} className="text-sm text-gray-700">
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* History */}
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Practice History</h2>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-blue-600 hover:text-blue-800"
          >
            {showHistory ? "Hide" : "Show"} History
          </button>
        </div>

        {showHistory && (
          <div className="bg-background rounded-lg shadow-md p-6">
            {history.length === 0 ? (
              <p className="text-gray-500">No practice records yet.</p>
            ) : (
              <div className="space-y-4">
                {history.map((record) => (
                  <div
                    key={record._id}
                    className="border-b pb-4 last:border-b-0"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{record.questionPrompt}</h4>
                        <p className="text-sm text-gray-600">
                          Score: {record.gradeResult.overallScore}/100 |
                          Criteria: {record.gradingCriteria.join(", ")}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(record.submissionTime).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => setGradeResult(record.gradeResult)}
                        className="text-blue-600 text-sm hover:text-blue-800"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
