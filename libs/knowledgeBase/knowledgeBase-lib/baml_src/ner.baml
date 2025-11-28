class NerResult {
    entity_name string
    entity_desc string
}

function NER(input: string, context: string) -> NerResult[] {
    client GLM4Air
    prompt #"
        {{_.role('user')}}
        You are a medical Named Entity Recognition (NER) expert. Your task is to extract medical entities from the given text.

        For each entity identified, provide:
        - entity_name: The exact text of the entity as it appears in the input
        - entity_desc: A brief, clear description of what the entity is

        Input text: {{ input }}

        Guidelines:
        - Be precise and extract entities exactly as they appear
        - Focus on medically relevant entities including diseases, symptoms, medications, procedures, anatomy, tests, substances, and devices
        - Avoid common words unless they have specific medical meaning in context
        - Provide accurate descriptions that would be useful for a medical knowledge base

        Please analyze the text and return a JSON array of NerResult objects.
        {{ ctx.output_format }}
    "#
}

test TestName {
  functions [NER]
  args {
    input #"
      二、 兴奋性
机体生存在一定的环境中，当环境发生变化时，机体会主动对环境的变化作出适宜的反应。在
日常生活中，当人的手接触到发烫的热水时，会马上缩回来，避开热水的烫伤；当动脉血压突然增高
时，会反射性引起血压回降到正常水平。在生理学上，这种作用于机体的内、外环境变化称为刺激
（stimulus），而机体对刺激所产生的应答性变化称为反应（response）。活组织细胞接受刺激产生反应
的能力或特性称为兴奋性（excitability）。
    "#
    context #"
      二、 兴奋性
机体生存在一定的环境中，当环境发生变化时，机体会主动对环境的变化作出适宜的反应。在
日常生活中，当人的手接触到发烫的热水时，会马上缩回来，避开热水的烫伤；当动脉血压突然增高
时，会反射性引起血压回降到正常水平。在生理学上，这种作用于机体的内、外环境变化称为刺激
（stimulus），而机体对刺激所产生的应答性变化称为反应（response）。活组织细胞接受刺激产生反应
的能力或特性称为兴奋性（excitability）。

通常机体内不同的组织细胞会对刺激所产生的反应表现出不同的形式。比如，神经细胞（包括感
受器）对刺激表现出来的反应形式是产生和传导动作电位；骨骼肌、心肌、平滑肌表现为收缩和舒张；而
各种腺体则表现为分泌。机体或细胞在接受刺激产生反应时，其表现的形式主要有两种：一种是由相对
静止变为显著的运动状态，或原有的活动由弱变强，称为兴奋（excitation）。由于可兴奋组织在发生反应之
前都会产生动作电位的变化，因此，现代生理学也将组织细胞接受刺激后产生动作电位的现象称为兴奋
（详见第二章）。另一种表现形式是由运动转为相对静止，或活动由强变弱，这称为抑制（inhibition）。
需要指出的是，刺激要引起机体的反应通常需要具备三个条件，即足够的刺激强度、足够的刺激
作用时间和适当的刺激强度 - 时间变化率。当固定刺激作用时间和刺激的强度 - 时间变化率，单独改
变刺激强度来刺激活组织细胞时，可观察到不同的刺激强度对活组织细胞反应的影响，通常我们将能
引起活组织细胞产生反应的最小刺激强度称为阈强度（threshold intensity），简称阈值（threshold）。刺
激强度低于阈值的刺激称为阈下刺激，刺激强度大于阈值的刺激称为阈上刺激，引起最大反应的最小
刺激称为最适刺激。超过最适刺激者称为强刺激或超强刺激，后者容易造成组织细胞的疲劳或伤害。
不同组织细胞的兴奋性并不相同，通常可以采用阈值的大小衡量兴奋性的高低。对于兴奋性高
的组织细胞，用较小的刺激便能使其产生兴奋，即其阈值较低。对于兴奋性较低的组织细胞，须用较
强的刺激才能让其产生兴奋，即其阈值较高。因此，阈值的大小可反映组织细胞兴奋性的高低，两者
成反比关系：
兴奋性∝1/ 阈值
    "#
  }
}
