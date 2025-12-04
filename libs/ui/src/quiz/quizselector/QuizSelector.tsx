import { useState } from 'react';
import { SubjectSelector } from './SubjectSelector';
import { UnitSelector } from './UnitSelector';
import { quiz, QuizWithUserAnswer } from '@/types/quizData.types';

// Sorting function to order quizzes by type: A1/A2 -> A3 -> B -> X
const sortQuizzesByType = (
  quizzes: QuizWithUserAnswer[],
): QuizWithUserAnswer[] => {
  const typeOrder: Record<string, number> = {
    A1: 0,
    A2: 0,
    A3: 1,
    B: 2,
    X: 3,
  };

  return [...quizzes].sort((a, b) => {
    const orderA = typeOrder[a.type] ?? 999;
    const orderB = typeOrder[b.type] ?? 999;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return 0; // Maintain original order for same types
  });
};

type Props = {
  setQuizzes: (quizzes: quiz[]) => void;
};

export function QuizSelector({ setQuizzes }: Props) {
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubjectSelect = (subject: string) => {
    setSelectedSubject(subject);
    setSelectedUnit(null);
  };

  const handleUnitSelect = async (unit: string) => {
    setSelectedUnit(unit);
    setLoading(true);
    try {
      const response = await fetch('/api/obcors/quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selector: {
            cls: [selectedSubject],
            unit: [unit],
            quizNum: 999,
            mode: [],
            source: [],
            extractedYear: [],
          },
        }),
      });
      const data = await response.text();
      setQuizzes(sortQuizzesByType(JSON.parse(data)));
    } catch (error) {
      console.error('Failed to fetch quizzes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackFromUnit = () => {
    setSelectedSubject(null);
    setSelectedUnit(null);
    setQuizzes([]);
  };

  return (
    <div className="w-full">
      {selectedSubject && !selectedUnit ? (
        <UnitSelector
          subject={selectedSubject}
          onUnitSelect={handleUnitSelect}
          onBack={handleBackFromUnit}
        />
      ) : (
        <SubjectSelector onSubjectSelect={handleSubjectSelect} />
      )}
    </div>
  );
}
