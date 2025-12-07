// Simple chat function for the library chatbot
function ChatResponse(message: string) -> string {
  client GLM4Plus // Set OPENAI_API_KEY to use this client.
  prompt #"
    {{_.role("system")}}
    You are a helpful library assistant. Respond to the user's message in a friendly and helpful way.
    
    {{_.role("user")}}
    {{ message }}
    
    {{ ctx.output_format }}
  "#
}