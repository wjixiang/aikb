import { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { MultiColumnFilter } from './MultiColumnFilter';
import type { FilterColumn } from './MultiColumnFilter';

const meta: Meta<typeof MultiColumnFilter> = {
  title: 'Components/MultiColumnFilter',
  component: MultiColumnFilter,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    onColumnChange: { action: 'column changed' },
    onClearFilters: { action: 'filters cleared' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// 基础示例
export const Basic: Story = {
  args: {
    columns: [
      {
        id: 'category',
        title: '分类',
        options: [
          { id: '1', label: '内科', value: 'internal' },
          { id: '2', label: '外科', value: 'surgery' },
          { id: '3', label: '儿科', value: 'pediatrics' },
          { id: '4', label: '妇产科', value: 'obstetrics' },
          { id: '5', label: '神经科', value: 'neurology' },
        ],
        selectedValues: [],
      },
      {
        id: 'difficulty',
        title: '难度',
        options: [
          { id: '1', label: '简单', value: 'easy' },
          { id: '2', label: '中等', value: 'medium' },
          { id: '3', label: '困难', value: 'hard' },
        ],
        selectedValues: [],
      },
    ],
  },
};

// 带选中值的示例
export const WithSelectedValues: Story = {
  args: {
    columns: [
      {
        id: 'category',
        title: '分类',
        options: [
          { id: '1', label: '内科', value: 'internal' },
          { id: '2', label: '外科', value: 'surgery' },
          { id: '3', label: '儿科', value: 'pediatrics' },
          { id: '4', label: '妇产科', value: 'obstetrics' },
          { id: '5', label: '神经科', value: 'neurology' },
        ],
        selectedValues: ['internal', 'surgery'],
      },
      {
        id: 'difficulty',
        title: '难度',
        options: [
          { id: '1', label: '简单', value: 'easy' },
          { id: '2', label: '中等', value: 'medium' },
          { id: '3', label: '困难', value: 'hard' },
        ],
        selectedValues: ['medium'],
      },
      {
        id: 'topic',
        title: '主题',
        options: [
          { id: '1', label: '心血管', value: 'cardiovascular' },
          { id: '2', label: '呼吸系统', value: 'respiratory' },
          { id: '3', label: '消化系统', value: 'digestive' },
          { id: '4', label: '神经系统', value: 'nervous' },
        ],
        selectedValues: [],
      },
    ],
  },
};

// 加载状态示例
export const Loading: Story = {
  args: {
    columns: [
      {
        id: 'category',
        title: '分类',
        options: [],
        selectedValues: [],
        isLoading: true,
      },
      {
        id: 'difficulty',
        title: '难度',
        options: [
          { id: '1', label: '简单', value: 'easy' },
          { id: '2', label: '中等', value: 'medium' },
          { id: '3', label: '困难', value: 'hard' },
        ],
        selectedValues: [],
      },
    ],
  },
};

// 多级过滤器示例
export const MultiLevel: Story = {
  args: {
    columns: [
      {
        id: 'subject',
        title: '学科',
        options: [
          { id: '1', label: '解剖学', value: 'anatomy' },
          { id: '2', label: '生理学', value: 'physiology' },
          { id: '3', label: '病理学', value: 'pathology' },
          { id: '4', label: '药理学', value: 'pharmacology' },
        ],
        selectedValues: ['anatomy', 'physiology'],
      },
      {
        id: 'system',
        title: '系统',
        options: [
          { id: '1', label: '心血管系统', value: 'cardiovascular' },
          { id: '2', label: '呼吸系统', value: 'respiratory' },
          { id: '3', label: '消化系统', value: 'digestive' },
          { id: '4', label: '神经系统', value: 'nervous' },
        ],
        selectedValues: ['cardiovascular'],
      },
      {
        id: 'difficulty',
        title: '难度',
        options: [
          { id: '1', label: '简单', value: 'easy' },
          { id: '2', label: '中等', value: 'medium' },
          { id: '3', label: '困难', value: 'hard' },
        ],
        selectedValues: [],
      },
      {
        id: 'type',
        title: '题型',
        options: [
          { id: '1', label: '单选题', value: 'single' },
          { id: '2', label: '多选题', value: 'multiple' },
          { id: '3', label: '判断题', value: 'truefalse' },
          { id: '4', label: '填空题', value: 'fillblank' },
        ],
        selectedValues: [],
      },
    ],
  },
};

// 交互式示例
export const Interactive: Story = {
  render: function InteractiveStory() {
    const [columns, setColumns] = useState<FilterColumn[]>([
      {
        id: 'category',
        title: '分类',
        options: [
          { id: '1', label: '内科', value: 'internal' },
          { id: '2', label: '外科', value: 'surgery' },
          { id: '3', label: '儿科', value: 'pediatrics' },
          { id: '4', label: '妇产科', value: 'obstetrics' },
          { id: '5', label: '神经科', value: 'neurology' },
        ],
        selectedValues: [],
      },
      {
        id: 'difficulty',
        title: '难度',
        options: [
          { id: '1', label: '简单', value: 'easy' },
          { id: '2', label: '中等', value: 'medium' },
          { id: '3', label: '困难', value: 'hard' },
        ],
        selectedValues: [],
      },
    ]);

    const handleColumnChange = (columnId: string, selectedValues: string[]) => {
      setColumns((prevColumns) =>
        prevColumns.map((col) =>
          col.id === columnId ? { ...col, selectedValues } : col,
        ),
      );
    };

    const handleClearFilters = () => {
      setColumns((prevColumns) =>
        prevColumns.map((col) => ({ ...col, selectedValues: [] })),
      );
    };

    return (
      <MultiColumnFilter
        columns={columns}
        onColumnChange={handleColumnChange}
        onClearFilters={handleClearFilters}
      />
    );
  },
};
