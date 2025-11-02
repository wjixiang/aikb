// tools/weather.ts
export const meta = {
  name: "get_forecast",
  description: "获取城市天气预报",
  parameters: {
    type: "object",
    properties: {
      location: { type: "string" },
    },
    required: ["location"],
  },
} as const;

export async function run({ location }: { location: string }) {
  // 这里可以是任何同步/异步逻辑
  return { location, temperature: 26, condition: "sunny" };
}
