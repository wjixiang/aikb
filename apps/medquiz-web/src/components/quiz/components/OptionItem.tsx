import React from 'react';
import { Check, X as XIcon, Square } from 'lucide-react';

interface OptionItemProps {
  selected: boolean;
  submitted?: boolean;
  correct?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  className?: string;
  children: React.ReactNode;
}

export const OptionItem: React.FC<OptionItemProps> = ({
  selected,
  submitted = false,
  correct,
  onClick,
  onDoubleClick,
  className = '',
  children,
}) => {
  const baseClasses =
    'flex items-center justify-between p-2 border-1 mb-1 rounded cursor-pointer ';

  let conditionalClasses = '';

  if (submitted) {
    if (selected && correct) {
      conditionalClasses =
        'bg-[hsl(var(--quiz-user-correct)/0.4)] border-2 border-[hsl(var(--quiz-user-correct))]';
    } else if (!selected && correct) {
      conditionalClasses =
        'bg-[hsl(var(--quiz-missed-correct)/0.2)] border border-[hsl(var(--quiz-missed-correct))]';
    } else if (selected && !correct) {
      conditionalClasses =
        'bg-[hsl(var(--quiz-user-incorrect)/0.2)] border-2 border-[hsl(var(--quiz-user-incorrect))]';
    } else {
      conditionalClasses =
        'bg-[hsl(var(--quiz-default-incorrect)/0.2)] border border-[hsl(var(--quiz-default-incorrect))]';
    }
  } else {
    conditionalClasses = `border ${selected ? 'bg-muted border-2 border-blue-500' : ''} hover:bg-muted hover:border-dashed`;
  }

  return (
    <div
      className={`${baseClasses} ${conditionalClasses} ${className}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {children}
      {submitted && (
        <div className="flex items-center">
          {selected &&
            (correct ? (
              <Check
                size={16}
                className="text-[hsl(var(--quiz-user-correct))] font-bold"
              />
            ) : (
              <XIcon
                size={16}
                className="text-[hsl(var(--quiz-user-incorrect))] font-bold"
              />
            ))}
          {!selected && correct && (
            <Check
              size={16}
              className="text-[hsl(var(--quiz-missed-correct))] font-bold"
            />
          )}
          {!selected && !correct && (
            <Square size={16} className="text-transparent" />
          )}
        </div>
      )}
    </div>
  );
};
