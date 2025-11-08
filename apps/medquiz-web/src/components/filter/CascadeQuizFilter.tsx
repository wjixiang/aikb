import { quizSelector } from "@/types/quizSelector.types";
import { Separator } from "../ui/separator";

interface CascadeQuizFilterProps {

}

export default function CascadeQuizFilter(params:CascadeQuizFilterProps) {
    
}

interface QuizFilterColumnProps {
    selectorName: string;
    value: string[];
    onSelectedValueChange: (selectedValue: string[]) => void;
}

export function QuizFilterColumn({
    selectorName,       
    onSelectedValueChange,
    value
}:QuizFilterColumnProps) {
    return <div className="w-10">
        <div>
            {selectorName}
        </div>

        <div>
            {value.map((e, index) => (
                <div key={index}>
                    {e}
                    <Separator className="w-full"/>
                </div>
            ))}
        </div>

    </div>
}