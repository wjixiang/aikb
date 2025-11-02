import * as get_forecast from "./tools/get_weather_tool";

// Define a type for tool handlers
type ToolHandler = (args: any) => Promise<any>;

const registry = new Map<string, { meta: any; run: ToolHandler }>();
registry.set(get_forecast.meta.name, get_forecast);

export const listTools = () => Array.from(registry.values()).map((t) => t.meta);
export const callTool = async (name: string, args: any) => {
  const tool = registry.get(name);
  if (!tool) throw new Error(`Tool ${name} not found`);
  return await tool.run(args);
};
