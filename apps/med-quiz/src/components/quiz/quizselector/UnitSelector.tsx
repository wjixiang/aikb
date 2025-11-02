import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { quizSelector } from "@/types/quizSelector.types";

interface UnitSelectorProps {
  subject: string;
  onUnitSelect: (unit: string) => void;
  onBack: () => void;
}

export function UnitSelector({
  subject,
  onUnitSelect,
  onBack,
}: UnitSelectorProps) {
  const [units, setUnits] = useState<string[]>([]);
  const [filteredUnits, setFilteredUnits] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchUnits = async () => {
    setLoading(true);
    try {
      const selector: quizSelector = {
        cls: [subject],
        mode: [],
        quizNum: 0,
        unit: [],
        source: [],
        extractedYear: [],
        email: "",
      };

      const response = await fetch("/api/obcors/quiz/get-unit", {
        method: "POST",
        body: JSON.stringify(selector),
      });
      const data = await response.json();
      setUnits(data);
      setFilteredUnits(data);
      return data;
    } catch (error) {
      console.error("Failed to fetch units:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnits();
  }, [subject]);

  useEffect(() => {
    if (searchTerm) {
      setFilteredUnits(
        units.filter((unit) =>
          unit.toLowerCase().includes(searchTerm.toLowerCase()),
        ),
      );
    } else {
      setFilteredUnits(units);
    }
  }, [searchTerm, units]);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CardTitle>{subject} - 选择章节</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 px-4 sm:px-6">
        <Input
          placeholder="搜索章节..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {loading ? (
          <div className="text-center">加载中...</div>
        ) : (
          filteredUnits.map((unit) => (
            <Button
              key={unit}
              variant="outline"
              className="w-full"
              onClick={() => onUnitSelect(unit)}
            >
              {unit}
            </Button>
          ))
        )}
      </CardContent>
    </Card>
  );
}
