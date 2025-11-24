import styled from 'styled-components';

export const QuestionTitle = styled.h2`
  font-size: 1.2rem;
  margin-bottom: 12px;
`;

export const MainQuestion = styled.h2`
  font-size: 1.2rem;
  margin-bottom: 12px;
`;

export const SubQuestion = styled.h3`
  font-size: 1rem;
  margin: 8px 0;
`;

export const OptionsList = styled.ul`
  list-style: none;
  padding: 0;
`;

export const SubmitButton = styled.button`
  padding: 8px 16px;
  border: none;
  border-radius: 4px solid #ccc;
  cursor: pointer;
`;

interface ResultProps {
  $isCorrect: boolean;
}

export const Result = styled.div<ResultProps>`
  margin-top: 16px;
  padding: 12px 16px;
  border-radius: 6px;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${(props) => (props.$isCorrect ? '#2E7D32' : '#C62828')};
  background-color: ${(props) =>
    props.$isCorrect ? 'rgba(46, 125, 50, 0.15)' : 'rgba(198, 40, 40, 0.15)'};
  border-left: 4px solid
    ${(props) => (props.$isCorrect ? '#2E7D32' : '#C62828')};
  animation: fadeIn 0.3s ease;

  &::before {
    content: ${(props) => (props.$isCorrect ? '"✓"' : '"✗"')};
    font-size: 1.2em;
    font-weight: 900;
    color: ${(props) => (props.$isCorrect ? '#2E7D32' : '#C62828')};
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

export const AnswerSection = styled.div`
  margin-top: 20px;
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 8px;
`;

export const AnswerTitle = styled.h3`
  color: #333;
  margin-bottom: 10px;
`;

export const AnalysisText = styled.p`
  color: #666;
  margin: 10px 0;
`;

export const LinksList = styled.ul`
  list-style: none;
  padding: 0;
`;

export const LinkItem = styled.li`
  margin: 5px 0;
  a {
    color: #1890ff;
    text-decoration: none;
    &:hover {
      text-decoration: underline;
    }
  }
`;

export const TopBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 3px;
  top: 0;
  width: 100%;
`;

export const InfoBar = styled.div`
  display: flex;
  align-items: center;
  padding: 3px 3px;
  top: 0;
  width: 100%;
`;

export const ToolButton = styled.div`
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  transition: background-color 0.3s ease;

  &:hover {
    background-color: rgba(0, 0, 0, 0.1);
  }
`;

export const QuizTitle = styled.div`
  margin-left: 15px;
  font-size: 18px;
  font-weight: 600;
`;

export const HideScrollbar = styled.div`
  /* Hide scrollbar for WebKit browsers */
  &::-webkit-scrollbar {
    display: none;
  }

  /* Hide scrollbar for Firefox */
  scrollbar-width: none;

  /* Ensure the element can scroll if needed */
  overflow: auto;
`;

export const GridViewTopBar = styled.div`
  padding: 12px 16px;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid #f0f0f0;
  background-color: #ffffff;
`;

export const StatsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

export const StatsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  line-height: 1.4;
`;

export const StatsLabel = styled.span`
  font-weight: 600;
  color: #333333;
`;

export const StatsValue = styled.span`
  font-weight: 500;
  color: #666666;
`;

export const ControlsSection = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
`;

export const SyncStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
`;

export const SyncInProgress = styled(SyncStatus)`
  color: #1890ff;
`;

export const SyncCompleted = styled(SyncStatus)`
  color: #52c41a;
`;

export const FilterSection = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const FilterLabel = styled.span`
  font-size: 14px;
  color: #666666;
  white-space: nowrap;
`;
