import { useState } from "react";
import styled from "styled-components";
import * as React from "react";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";

// 定义props接口
interface CollapsibleProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

// 为styled-components定义props接口
interface CollapsibleContentProps {
  $isopen: boolean;
}

// 创建容器组件
const Container = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => (
  <div
    className={`w-full overflow-hidden rounded-md border border-border ${className}`}
  >
    {children}
  </div>
);

// 创建可折叠的内容区域
const CollapsibleContent = styled.div<CollapsibleContentProps>`
  transition: max-height 0.3s ease-in-out;
  max-height: ${(props) => (props.$isopen ? "1000px" : "0")};
  overflow: hidden;
`;

// 创建触发器按钮
const Trigger = styled.div`
  padding: 10px;
  cursor: pointer;
  user-select: none;

  &:hover {
    background-color: var(--background-hover);
  }
`;

const Collapsible: React.FC<CollapsibleProps> = ({
  trigger,
  children,
  className,
}) => {
  const [$isopen, set$isopen] = useState<boolean>(false);

  const toggleCollapse = (): void => {
    set$isopen(!$isopen);
  };

  return (
    <Container className={className}>
      <Trigger onClick={toggleCollapse}>
        {trigger}
        <span style={{ float: "right" }}>
          {$isopen ? <ChevronsUpDown /> : <ChevronsDownUp />}
        </span>
      </Trigger>
      <CollapsibleContent $isopen={$isopen}>{children}</CollapsibleContent>
    </Container>
  );
};

export default Collapsible;
