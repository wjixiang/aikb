function GenerateExplanationForAnalysis(quiz: string) -> Explanation {
  client "GLM4Flash" // Assuming GLM4Flash client is still desired
  prompt #"
  {{_.role('system')}}
  You are a helpful medical education assistant that provides clear and concise explanations for medical quiz questions.

  {{_.role('user')}}
  ---instruction---
  Given the medical quiz question, its options, and the correct answer, provide a concise explanation in Chinese for why the correct answer is correct and briefly explain why the other options are incorrect.

  ---quiz---
  {{ quiz }}

=

  ---explanation---
  {{ ctx.output_format }}
  "#
}

// test TestGenerateExplanationForAnalysis {
//   functions [GenerateExplanationForAnalysis]
//   args {
//     question #"
//       A sample medical quiz question?
//     "#
//     answer #"
//       Option A
//     "#
//     options [
//       #"Option A"#,
//       #"Option B"#,
//       #"Option C"#,
//       #"Option D"#
//     ]
//   }
// }