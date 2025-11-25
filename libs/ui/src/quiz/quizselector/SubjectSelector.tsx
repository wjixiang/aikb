import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "ui";
import { Button } from "ui";
import { Input } from "ui";
import { ScrollArea } from "ui";

interface SubjectSelectorProps {
  onSubjectSelect: (subject: string) => void;
}

export function SubjectSelector({ onSubjectSelect }: SubjectSelectorProps) {
  const [subjects, setSubjects] = useState<string[]>([]);
  const [filteredSubjects, setFilteredSubjects] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/obcors/quiz/get-subject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reqestData: {} }),
      });
      const data = await response.json();
      setSubjects(data);
      setFilteredSubjects(data);
    } catch (error) {
      console.error("Failed to fetch subjects:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      setFilteredSubjects(
        subjects.filter((subject) =>
          subject.toLowerCase().includes(searchTerm.toLowerCase()),
        ),
      );
    } else {
      setFilteredSubjects(subjects);
    }
  }, [searchTerm, subjects]);

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader>
        <CardTitle>选择科目</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 px-4 sm:px-6 flex-1 min-h-0">
        <Input
          placeholder="搜索科目..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {loading ? (
          <div className="text-center">加载中...</div>
        ) : (
          <ScrollArea className="overflow-y-auto flex-1">
            {filteredSubjects.map((subject) => (
              <Button
                key={subject}
                variant="outline"
                className="w-full"
                onClick={() => onSubjectSelect(subject)}
              >
                {subject}
              </Button>
            ))}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
