

function AnnotateClass(quiz_content:string) -> "生理学" | "病理学" | "生物化学" | "内科学" | "外科学" {
    client GLM4Plus
    prompt #"
        {{_.role("user")}}

        请你根据传入试题的内容，判断试题所归属的考察科目。
        科目必须是 "生理学" | "病理学" | "生物化学" | "内科学" | "外科学" 其中的一个。

        ---试题---
        {{quiz_content}}
        ---
        {{ ctx.output_format }}
    "#
}