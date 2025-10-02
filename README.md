# AIKB

A knowledge management system intergated with agent

## Knowledge Data Construction
- Entity: 
    - Serve as anchor point of every knowledge information 
- Knowledge
    - Scopes/property of entity
    - Allow subdivition

### 自然语言描述记录
所有的实体与知识均具有abstract属性，会更具当前自身信息进行整体总结，用于语义检索与用户返回

### 关系建立方式：实体-知识关系的交替连接
所有知识信息均被统一处理为`实体-->知识-->实体`的图结构，用于快速的图检索与知识网络数据

**案例1** 
原始信息：肾病综合征的临床表现可总结为“三高一低”：大量蛋白尿、低蛋白血症、水肿和高脂血症

处理结果：
- entity: 肾病综合征
    - knowledge: 临床表现
        - entity1: 大量蛋白尿 
        - entity2: 低蛋白血症
        - entity3: 水肿
        - entity4: 高脂血症

## 知识创建过程

## Target
- [ ] Replicate basic functions of common knowledge managment system (e.g. Obsidian)   
