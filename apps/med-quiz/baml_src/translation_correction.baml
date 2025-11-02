class TranslationCorrection {
  score int @description(#"
    between 0~10
  "#)
  correction string 
  suggestions string
  grammar_teach string
  fullTrans string
}

function CorrectTranslation(original: string, translation: string, context: string) -> TranslationCorrection {
  client "QWen3"
  prompt #"
  {{_.role('system')}}
  You are a helpful language tutor that provides corrections and suggestions for English-Chinese translations.

  {{_.role('user')}}
  ---instruction---
  Given an original English sentence and a student's Chinese translation, provide:
  1. A detailed correction pointing out any errors
  2. Suggested improvements
  3. Explain the key grammars as detailed as possible
  4. Provide standard translation, pay attention to bind the context
  5. Use 中文 as responsing language

  ---original---
  {{ original }}

  ---translation---
  {{ translation }}

  ---context---
  {{context}}

  ---correction---
  {{ ctx.output_format }}
  "#
}

test TestCorrectTranslation {
  functions [CorrectTranslation]
  args {
    original "The patient presented with fever and headache for three days."
    translation "患者出现发烧和头疼三天了。"
  }
}