import { quiz, quizTypeID, oid, analysis } from "@/types/quizData.types";

/**
 * 验证对象是否为有效的 quiz 格式
 * @param obj 要验证的对象
 * @returns 如果对象符合 quiz 格式则返回 true，否则返回包含错误信息的对象
 */
export function validateQuiz(obj: any): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  // 基础验证：检查是否为对象且包含必要的通用字段
  if (!obj || typeof obj !== "object") {
    errors.push("输入不是有效的对象");
    return { valid: false, errors };
  }

  // 验证基本字段
  // if (typeof obj._id !== 'string') {
  //   errors.push('_id 必须是字符串类型');
  // }

  if (!isValidQuizTypeID(obj.type)) {
    errors.push(`题目类型 "${obj.type}" 无效，必须是 A1, A2, A3, B 或 X`);
  }

  if (typeof obj.class !== "string") {
    errors.push("class 必须是字符串类型");
  }

  if (typeof obj.unit !== "string") {
    errors.push("unit 必须是字符串类型");
  }

  const tagsValidation = validateTags(obj.tags);
  if (!tagsValidation.valid) {
    errors.push(...tagsValidation.errors.map((err) => `tags: ${err}`));
  }

  const analysisValidation = validateAnalysis(obj.analysis);
  if (!analysisValidation.valid) {
    errors.push(...analysisValidation.errors.map((err) => `analysis: ${err}`));
  }

  if (typeof obj.source !== "string") {
    errors.push("source 必须是字符串类型");
  }

  // 根据题目类型进行特定验证
  if (isValidQuizTypeID(obj.type)) {
    let typeSpecificValidation;

    switch (obj.type) {
      case "A1":
      case "A2":
        typeSpecificValidation = validateA1A2(obj);
        break;
      case "A3":
        typeSpecificValidation = validateA3(obj);
        break;
      case "X":
        typeSpecificValidation = validateX(obj);
        break;
      case "B":
        typeSpecificValidation = validateB(obj);
        break;
    }

    if (typeSpecificValidation && !typeSpecificValidation.valid) {
      errors.push(
        ...typeSpecificValidation.errors.map(
          (err) => `${obj.type}类型: ${err}`,
        ),
      );
    }
  }

  // 输出详细错误信息到控制台
  if (errors.length > 0) {
    console.error("题目验证失败，详细错误：");
    errors.forEach((error, index) => {
      console.error(`${index + 1}. ${error}`);
    });
    console.error(JSON.stringify(obj));
    return { valid: false, errors };
  }

  return { valid: true };
}

/**
 * 验证是否为有效的题目类型ID
 */
function isValidQuizTypeID(type: any): type is quizTypeID {
  return ["A1", "A2", "A3", "B", "X"].includes(type);
}

/**
 * 验证标签数组是否有效
 */
function validateTags(tags: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(tags)) {
    errors.push("标签必须是数组");
    return { valid: false, errors };
  }

  tags.forEach((tag, index) => {
    if (typeof tag !== "string") {
      errors.push(`标签 #${index + 1} 必须是字符串类型`);
    }
  });

  return { valid: errors.length === 0, errors };
}

/**
 * 验证分析对象是否有效
 */
function validateAnalysis(analysis: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!analysis || typeof analysis !== "object") {
    errors.push("分析必须是对象类型");
    return { valid: false, errors };
  }

  if (analysis.point !== null && typeof analysis.point !== "string") {
    errors.push("point 必须是字符串类型或 null");
  }

  if (analysis.discuss !== null && typeof analysis.discuss !== "string") {
    errors.push("discuss 必须是字符串类型或 null");
  }

  if (!Array.isArray(analysis.link)) {
    errors.push("link 必须是数组");
  } else {
    analysis.link.forEach((link: any, index: number) => {
      if (typeof link !== "string") {
        errors.push(`link #${index + 1} 必须是字符串类型`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 验证选项数组是否有效
 */
function validateOptions(options: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(options)) {
    errors.push("选项必须是数组");
    return { valid: false, errors };
  }

  options.forEach((option, index) => {
    if (typeof option !== "object" || option === null) {
      errors.push(`选项 #${index + 1} 必须是对象类型`);
      return;
    }

    if (!isValidOid(option.oid)) {
      errors.push(
        `选项 #${index + 1} 的 oid "${option.oid}" 无效，必须是 A, B, C, D 或 E`,
      );
    }

    if (typeof option.text !== "string") {
      errors.push(`选项 #${index + 1} 的 text 必须是字符串类型`);
    }
  });

  return { valid: errors.length === 0, errors };
}

/**
 * 验证选项ID是否有效
 */
function isValidOid(oid: any): oid is oid {
  return ["A", "B", "C", "D", "E"].includes(oid);
}

/**
 * 验证 A1 或 A2 类型题目
 */
function validateA1A2(obj: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof obj.question !== "string") {
    errors.push("question 必须是字符串类型");
  }

  const optionsValidation = validateOptions(obj.options);
  if (!optionsValidation.valid) {
    errors.push(...optionsValidation.errors);
  }

  if (!isValidOid(obj.answer)) {
    errors.push(`answer "${obj.answer}" 无效，必须是 A, B, C, D 或 E`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 验证 A3 类型题目
 */
function validateA3(obj: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof obj.mainQuestion !== "string") {
    errors.push("mainQuestion 必须是字符串类型");
  }

  if (!Array.isArray(obj.subQuizs)) {
    errors.push("subQuizs 必须是数组");
    return { valid: false, errors };
  }

  obj.subQuizs.forEach(
    (
      subQuiz: {
        subQuizId: any;
        question: any;
        options: any;
        answer: any;
      } | null,
      index: number,
    ) => {
      if (typeof subQuiz !== "object" || subQuiz === null) {
        errors.push(`子题目 #${index + 1} 必须是对象类型`);
        return;
      }

      if (typeof subQuiz.subQuizId !== "number") {
        errors.push(`子题目 #${index + 1} 的 subQuizId 必须是数字类型`);
      }

      if (typeof subQuiz.question !== "string") {
        errors.push(`子题目 #${index + 1} 的 question 必须是字符串类型`);
      }

      const optionsValidation = validateOptions(subQuiz.options);
      if (!optionsValidation.valid) {
        errors.push(
          ...optionsValidation.errors.map(
            (err) => `子题目 #${index + 1}: ${err}`,
          ),
        );
      }

      if (!isValidOid(subQuiz.answer)) {
        errors.push(
          `子题目 #${index + 1} 的 answer "${subQuiz.answer}" 无效，必须是 A, B, C, D 或 E`,
        );
      }
    },
  );

  return { valid: errors.length === 0, errors };
}

/**
 * 验证 X 类型题目
 */
function validateX(obj: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof obj.question !== "string") {
    errors.push("question 必须是字符串类型");
  }

  const optionsValidation = validateOptions(obj.options);
  if (!optionsValidation.valid) {
    errors.push(...optionsValidation.errors);
  }

  if (!Array.isArray(obj.answer)) {
    errors.push("answer 必须是数组");
    return { valid: false, errors };
  }

  obj.answer.forEach((ans: any, index: number) => {
    if (!isValidOid(ans)) {
      errors.push(`answer #${index + 1} "${ans}" 无效，必须是 A, B, C, D 或 E`);
    }
  });

  return { valid: errors.length === 0, errors };
}

/**
 * 验证 B 类型题目
 */
function validateB(obj: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(obj.questions)) {
    errors.push("questions 必须是数组");
    return { valid: false, errors };
  }

  obj.questions.forEach(
    (
      question: { questionId: any; questionText: any; answer: any } | null,
      index: number,
    ) => {
      if (typeof question !== "object" || question === null) {
        errors.push(`问题 #${index + 1} 必须是对象类型`);
        return;
      }

      if (typeof question.questionId !== "number") {
        errors.push(`问题 #${index + 1} 的 questionId 必须是数字类型`);
      }

      if (typeof question.questionText !== "string") {
        errors.push(`问题 #${index + 1} 的 questionText 必须是字符串类型`);
      }

      if (!isValidOid(question.answer)) {
        errors.push(
          `问题 #${index + 1} 的 answer "${question.answer}" 无效，必须是 A, B, C, D 或 E`,
        );
      }
    },
  );

  const optionsValidation = validateOptions(obj.options);
  if (!optionsValidation.valid) {
    errors.push(...optionsValidation.errors);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 向后兼容的函数，保持原有 API
 */
export function isQuizType(obj: any): obj is quiz {
  const validation = validateQuiz(obj);
  return validation.valid;
}
