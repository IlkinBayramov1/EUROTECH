/**
 * VCMS Conditional Logic & Validation Evaluator Engine
 * Evaluates both QuestionCondition[] and DocumentCondition[] deterministically
 * using stable questionCode (e.g. Q010) and optionCode (e.g. OPT_MARITAL_MARRIED).
 */

function normalizeAnswerValue(rawAnswer) {
  if (rawAnswer === undefined || rawAnswer === null) return '';
  if (typeof rawAnswer === 'object') {
    if (Array.isArray(rawAnswer)) return rawAnswer;
    if (Array.isArray(rawAnswer.selectedOptionCodes)) return rawAnswer.selectedOptionCodes;
    if (rawAnswer.valueText !== undefined && rawAnswer.valueText !== null) return String(rawAnswer.valueText);
  }
  return rawAnswer;
}

function evaluateSingleRule(rule, answersByQuestionCode = {}) {
  const triggerCode = rule.triggerQuestionCode || rule.questionCode;
  const comparator = String(rule.comparator || 'EQUALS').toUpperCase();
  const rawExpected = rule.triggerValue !== undefined ? rule.triggerValue : rule.value;
  const actual = normalizeAnswerValue(answersByQuestionCode[triggerCode]);

  const actualArray = Array.isArray(actual)
    ? actual.map((v) => String(v).trim())
    : actual !== '' && actual !== null && actual !== undefined
      ? [String(actual).trim()]
      : [];
  const actualStr = actualArray[0] || '';

  let expectedArray = [];
  if (Array.isArray(rawExpected)) {
    expectedArray = rawExpected.map((v) => String(v).trim());
  } else if (typeof rawExpected === 'string' && rawExpected.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(rawExpected);
      if (Array.isArray(parsed)) expectedArray = parsed.map((v) => String(v).trim());
    } catch (_) {
      expectedArray = [rawExpected.trim()];
    }
  } else if (rawExpected !== undefined && rawExpected !== null) {
    expectedArray = [String(rawExpected).trim()];
  }
  const expectedStr = expectedArray[0] || '';

  switch (comparator) {
    case 'EQUALS':
      return actualArray.includes(expectedStr) || actualStr.toLowerCase() === expectedStr.toLowerCase();
    case 'NOT_EQUALS':
      return !actualArray.includes(expectedStr) && actualStr.toLowerCase() !== expectedStr.toLowerCase();
    case 'IN':
      return actualArray.some((a) => expectedArray.includes(a));
    case 'NOT_IN':
      return !actualArray.some((a) => expectedArray.includes(a));
    case 'IS_TRUE':
      return ['true', 'yes', '1', 'bəli'].includes(actualStr.toLowerCase());
    case 'IS_FALSE':
      return ['false', 'no', '0', 'xeyr'].includes(actualStr.toLowerCase());
    case 'GREATER_THAN':
      return Number(actualStr) > Number(expectedStr);
    case 'LESS_THAN':
      return Number(actualStr) < Number(expectedStr);
    case 'IS_FILLED':
      return actualArray.length > 0 && actualStr.length > 0;
    case 'IS_EMPTY':
      return actualArray.length === 0 || actualStr.length === 0;
    default:
      return false;
  }
}

function evaluateConditionSet({ conditions = [], conditionalJson = null, baseRequired = false }, answersByQuestionCode = {}) {
  let rules = [];
  let operator = 'AND';
  let action = 'SHOW_AND_REQUIRE';

  if (Array.isArray(conditions) && conditions.length > 0) {
    operator = String(conditions[0].groupOperator || 'AND').toUpperCase();
    action = String(conditions[0].action || 'SHOW_AND_REQUIRE').toUpperCase();
    rules = conditions;
  } else if (conditionalJson && Array.isArray(conditionalJson.rules) && conditionalJson.rules.length > 0) {
    operator = String(conditionalJson.operator || 'AND').toUpperCase();
    action = String(conditionalJson.action || 'SHOW_AND_REQUIRE').toUpperCase();
    rules = conditionalJson.rules;
  }

  if (rules.length === 0) {
    return {
      isVisible: true,
      isRequired: Boolean(baseRequired),
      matched: true,
    };
  }

  const results = rules.map((r) => evaluateSingleRule(r, answersByQuestionCode));
  const matched = operator === 'OR' ? results.some(Boolean) : results.every(Boolean);

  if (action === 'SHOW') {
    return { isVisible: matched, isRequired: matched ? Boolean(baseRequired) : false, matched };
  }
  if (action === 'HIDE') {
    return { isVisible: !matched, isRequired: !matched ? Boolean(baseRequired) : false, matched };
  }
  if (action === 'REQUIRE') {
    return { isVisible: true, isRequired: matched ? true : Boolean(baseRequired), matched };
  }
  if (action === 'MAKE_OPTIONAL') {
    return { isVisible: true, isRequired: matched ? false : Boolean(baseRequired), matched };
  }
  // Default: SHOW_AND_REQUIRE
  return {
    isVisible: matched,
    isRequired: matched ? true : false,
    matched,
  };
}

function validateQuestionValue(questionConfig, value) {
  const errors = [];
  const valStr = value === undefined || value === null ? '' : typeof value === 'string' ? value.trim() : String(value);

  const validations = questionConfig.validations || [];
  for (const v of validations) {
    if (!valStr) continue;
    const ruleType = String(v.ruleType || '').toUpperCase();
    const ruleVal = String(v.ruleValue || '');
    const errMsg = v.errorMessageEn || v.errorMessageAz || `Validation failed: ${ruleType}`;

    if (ruleType === 'MIN_LENGTH' && valStr.length < Number(ruleVal)) {
      errors.push(errMsg);
    } else if (ruleType === 'MAX_LENGTH' && valStr.length > Number(ruleVal)) {
      errors.push(errMsg);
    } else if (ruleType === 'REGEX') {
      try {
        const re = new RegExp(ruleVal);
        if (!re.test(valStr)) errors.push(errMsg);
      } catch (_) {}
    } else if (ruleType === 'MIN_VALUE' && Number(valStr) < Number(ruleVal)) {
      errors.push(errMsg);
    } else if (ruleType === 'MAX_VALUE' && Number(valStr) > Number(ruleVal)) {
      errors.push(errMsg);
    } else if (ruleType === 'FUTURE_DATE') {
      const d = new Date(valStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (isNaN(d.getTime()) || d < today) errors.push(errMsg);
    } else if (ruleType === 'PAST_DATE') {
      const d = new Date(valStr);
      const today = new Date();
      if (isNaN(d.getTime()) || d > today) errors.push(errMsg);
    } else if (ruleType === 'PASSPORT_VALIDITY_MONTHS') {
      const months = Number(ruleVal) || 3;
      const d = new Date(valStr);
      const minExpiry = new Date();
      minExpiry.setMonth(minExpiry.getMonth() + months);
      if (isNaN(d.getTime()) || d < minExpiry) {
        errors.push(v.errorMessageEn || `Passport must be valid for at least ${months} months.`);
      }
    }
  }
  return errors;
}

function detectCircularConditions(allConfigsWithConditions) {
  // Graph: node = questionCode, edges = triggerQuestionCode
  const adj = new Map();
  for (const cfg of allConfigsWithConditions) {
    const qCode = cfg.questionCode;
    const triggers = (cfg.conditions || []).map((c) => c.triggerQuestionCode).filter(Boolean);
    adj.set(qCode, triggers);
  }

  const visited = new Set();
  const inStack = new Set();

  function dfs(node) {
    if (inStack.has(node)) return true;
    if (visited.has(node)) return false;
    visited.add(node);
    inStack.add(node);
    const neighbors = adj.get(node) || [];
    for (const next of neighbors) {
      if (dfs(next)) return true;
    }
    inStack.delete(node);
    return false;
  }

  for (const node of adj.keys()) {
    if (dfs(node)) return true;
  }
  return false;
}

module.exports = {
  evaluateSingleRule,
  evaluateConditionSet,
  validateQuestionValue,
  detectCircularConditions,
};
