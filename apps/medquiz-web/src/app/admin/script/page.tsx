"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Param {
  name: string;
  type: "string" | "number" | "boolean";
  label: string;
  required?: boolean;
  defaultValue?: any;
  options?: string[];
  showIf?: (params: Record<string, any>) => boolean;
}

interface Script {
  name: string;
  description: string;
  params: Param[];
}

const scripts: Script[] = [
  {
    name: "KDBsync",
    description: "同步知识数据库",
    params: [],
  },
  {
    name: "batchAnnotateQuiz",
    description: "批量注释题目",
    params: [
      {
        name: "command",
        type: "string",
        label: "命令",
        options: ["batch", "single", "list"],
        required: true,
      },
      {
        name: "concurrency",
        type: "number",
        label: "并发数",
        defaultValue: 100,
      },
      { name: "class", type: "string", label: "科目筛选" },
      { name: "source", type: "string", label: "来源筛选" },
      {
        name: "quizId",
        type: "string",
        label: "题目ID",
        showIf: (params) => params.command === "single",
      },
      {
        name: "quizIds",
        type: "string",
        label: "题目ID列表(逗号分隔)",
        showIf: (params) => params.command === "list",
      },
    ],
  },
  {
    name: "ner-cli",
    description: "命名实体识别",
    params: [
      { name: "text", type: "string", label: "文本", required: true },
      {
        name: "schemaDir",
        type: "string",
        label: "Schema目录",
        required: true,
      },
      {
        name: "engine",
        type: "string",
        label: "引擎",
        options: ["llm", "stanford"],
      },
    ],
  },
  {
    name: "syncMongoToKDB",
    description: "MongoDB同步到知识库",
    params: [
      { name: "collection", type: "string", label: "集合名", required: true },
      { name: "batchSize", type: "number", label: "批量大小", defaultValue: 1 },
      {
        name: "target",
        type: "string",
        label: "目标",
        options: ["milvus", "neo4j", "both"],
      },
    ],
  },
  {
    name: "testGraphRAG",
    description: "测试Graph RAG",
    params: [
      { name: "question", type: "string", label: "问题", required: true },
    ],
  },
  {
    name: "testQuizAnalysisChain",
    description: "测试题目分析链",
    params: [
      { name: "query", type: "string", label: "查询", required: true },
      { name: "verbose", type: "boolean", label: "详细输出" },
    ],
  },
];

export default function ScriptRunnerPage() {
  const [selectedScript, setSelectedScript] = useState("");
  const [params, setParams] = useState<Record<string, any>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");

  const currentScript = scripts.find((s) => s.name === selectedScript) as
    | Script
    | undefined;

  const handleParamChange = (name: string, value: any) => {
    setParams((prev) => ({ ...prev, [name]: value }));
  };

  const executeScript = async () => {
    if (!selectedScript) return;

    setIsRunning(true);
    setOutput("");
    setError("");

    try {
      const response = await fetch("/api/admin/scripts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          script: selectedScript,
          args: Object.entries(params).map(
            ([key, value]) => `--${key}=${value}`,
          ),
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setOutput(data.output);
      } else {
        setError(data.error || "执行脚本出错");
        setOutput(data.output || "");
      }
    } catch (err) {
      setError("网络请求失败");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>脚本执行器</CardTitle>
          <CardDescription>选择并执行系统脚本</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="script">选择脚本</Label>
            <Select value={selectedScript} onValueChange={setSelectedScript}>
              <SelectTrigger>
                <SelectValue placeholder="选择脚本..." />
              </SelectTrigger>
              <SelectContent>
                {scripts.map((script) => (
                  <SelectItem key={script.name} value={script.name}>
                    {script.name} - {script.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {currentScript && (
            <div className="grid gap-4">
              <h3 className="text-lg font-medium">参数</h3>
              {currentScript.params.map((param) => (
                <div key={param.name} className="grid gap-2">
                  <Label htmlFor={param.name}>{param.label}</Label>
                  {param.type === "boolean" ? (
                    <input
                      type="checkbox"
                      id={param.name}
                      checked={params[param.name] || false}
                      onChange={(e) =>
                        handleParamChange(param.name, e.target.checked)
                      }
                    />
                  ) : param.options ? (
                    <Select
                      value={params[param.name] || ""}
                      onValueChange={(value) =>
                        handleParamChange(param.name, value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={`选择${param.label}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {param.options.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    (!param.showIf || param.showIf(params)) && (
                      <Input
                        type={param.type}
                        id={param.name}
                        value={params[param.name] || ""}
                        onChange={(e) =>
                          handleParamChange(
                            param.name,
                            param.type === "number"
                              ? Number(e.target.value)
                              : e.target.value,
                          )
                        }
                        placeholder={
                          param.defaultValue
                            ? `默认: ${param.defaultValue}`
                            : ""
                        }
                      />
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col items-start gap-4">
          <Button
            onClick={executeScript}
            disabled={isRunning || !selectedScript}
          >
            {isRunning ? "执行中..." : "执行脚本"}
          </Button>

          {output && (
            <div className="w-full">
              <h3 className="text-lg font-medium mb-2">输出</h3>
              <pre className="bg-gray-100 p-4 rounded-md whitespace-pre-wrap">
                {output}
              </pre>
            </div>
          )}

          {error && (
            <div className="w-full text-red-500">
              <h3 className="text-lg font-medium mb-2">错误</h3>
              <pre className="bg-red-50 p-4 rounded-md whitespace-pre-wrap">
                {error}
              </pre>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
