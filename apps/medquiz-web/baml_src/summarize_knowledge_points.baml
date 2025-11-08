class KnowledgePoints {
    knowledgePoint string @description(#"
        知识点的名称，它通常是一个医学领域实体的属性
    "#)
    description string @description(#"
        知识点的描述
    "#)
}

function SummarizeKnowledgePoint(quiz_content:string, quiz_explanation:string) -> KnowledgePoints[] {
    client "GLM4Flash"
    prompt #"
    {{_.role('system')}}
    You are a medical education assistant. Your task is to analyze a medical quiz question and its explanation to identify the key knowledge points required to understand the question and arrive at the correct answer.

    {{_.role('user')}}
    ---instruction---
    Given the medical quiz content (question and options) and the provided explanation, extract the essential medical knowledge points. These knowledge points should be fundamental concepts, definitions, or relationships that are directly relevant to the quiz and its explanation. 
    List these knowledge points in Chinese.
    You should only extract the key knowledge points.

    ---quiz content---
    {{ quiz_content }}

    ---explanation---
    {{ quiz_explanation }}

    ---knowledge points---
    {{ ctx.output_format }}
    "#
}

test TestSummarizeKnowledgePoint {
  functions [SummarizeKnowledgePoint]
  args {
    quiz_content #"
      2020U3-55 用阈下刺激即可诱发心肌细胞产生期前收缩的兴奋性周期时相是
        A. A. 绝对不应期
        B. B. 相对不应期
        C. C. 低常期
        D. D. 局部反应期
        E. E. 超常期
      Answer: E
    "#
    quiz_explanation #"
    9版生理学P43）<img>“相对不应期过后，有的细胞还会出现兴奋性轻度增高的时期，此期称为超常期。此时电压门控钠（或钙）通道已基本复活，但膜电位尚未完全回到静息电位，距离阈电位水平较近，因而只需阈下刺激就能使膜去极化达到阈电位而再次兴奋”（E对）。
      由于离子通道已基本复活，但膜电位尚未完全恢复静息电位，给予阈下刺激就能使膜去极化达到阈电位而再次兴奋的时相即为超常期（E对）。绝对不应期（A错） 是指兴奋发生过程中离子通道完全关闭，无论给予何种刺激，都不能诱发心肌细胞产生新的兴奋。相对不应期（B错）是指绝对不应期后，兴奋逐渐恢复，离子通道部分开放，需给予大于原来阈值的刺激强度才可以发生兴奋。低常期（C错）是指超常期后细胞出现的兴奋性轻度降低的时期，需要阈上刺激才可以弓|起再次兴奋。局部反应期（D错）是指阈下刺激不引起细胞或者组织产生动作电位，但它可以引起受刺激的膜局部出现一个较小的膜的去极化反应。
    "#
  }
}

