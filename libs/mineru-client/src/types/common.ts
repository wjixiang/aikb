export interface ApiResponse<T = any> {
  code: number;
  msg: string;
  trace_id: string;
  data: T;
}
