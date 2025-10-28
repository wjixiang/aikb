class BamlMdOutline {
    level int
    title string
}

function AnalysisHierachy(currentParagraph: string, outline: BamlMdOutline[], endLevel: int) -> int {
    client QWenFlash
    prompt #"
        {{_.role('system')}}
        You are an expert document structure analyzer specializing in determining hierarchical relationships in Chinese academic documents. Your task is to analyze the hierarchical level of a given paragraph in relation to an existing outline.

        {{_.role('user')}}
        Analyze the hierarchical relationship between the given markdown paragraph and the current outline structure. Determine the most appropriate outline level for the given paragraph based on:

        1. **Chinese document hierarchy patterns** - Recognize common Chinese hierarchical markers:
           - 第X章/第X节 (Chapter/Section level)
           - 一、二、三、... (First level subtopics)
           - （一）（二）（三）... (Second level subtopics)
           - 1. 2. 3. ... (Third level subtopics)
           - (1) (2) (3) ... (Fourth level subtopics)

        2. **Content semantics** - How the paragraph relates conceptually to existing sections
        3. **Structural logic** - Whether it's a main topic, subtopic, or sub-subtopic
        4. **Document flow** - How it fits within the overall document organization

        **IMPORTANT HIERARCHY RULES:**
        - Items with the same type of marker should be at the same level
        - "第X节" and "一、" are typically at the same hierarchical level
        - "（一）" and "（二）" should be at the same level
        - Do not create unnecessary deep nesting
        - Maintain consistent indentation for items with similar markers

        THE LEVEL **SHOULD NOT** LARGER THAN {{endLevel+1}}
        If the paragraph should be at the same level as an existing item, use that same level number.
        If it should be nested under an existing item, use a higher number (deeper hierarchy).
        If it should contain existing items, use a lower number (higher hierarchy).

        ---current outline---
        {% for item in outline %}
        {{ "  " * item.level }}- h{{item.level }}: {{ item.title }}
        {% endfor %}


        ---paragraph---
        {{currentParagraph}}

        Return only a single integer representing the hierarchical level for the given paragraph.
        ****!!!DO NOT RETURN ANY CONTENT EXCEPT INTEGER!!!****
        {{ ctx.output_format }}
    "#
}