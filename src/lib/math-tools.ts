export function calculate(expression: string, degreesMode = true) {
  if (!expression.trim() || expression.length > 500)
    throw new Error("请输入 1–500 字符的算式");
  const source = expression
    .replace(/\s+/g, "")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/π/g, "pi");
  const tokens =
    source.match(
      /(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[a-z]+|[()+\-*/^!%]/gi,
    ) || [];
  if (tokens.join("") !== source) throw new Error("算式包含不支持的字符");
  let cursor = 0,
    depth = 0;
  const factor = degreesMode ? Math.PI / 180 : 1;
  const functions: Record<string, (n: number) => number> = {
    sqrt: Math.sqrt,
    abs: Math.abs,
    ln: Math.log,
    log: Math.log10,
    sin: (n) => Math.sin(n * factor),
    cos: (n) => Math.cos(n * factor),
    tan: (n) => {
      if (Math.abs(Math.cos(n * factor)) < 1e-14)
        throw new Error("该角度的正切不存在");
      return Math.tan(n * factor);
    },
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
  };
  function primary(): number {
    if (++depth > 64) throw new Error("括号或函数嵌套过深");
    const token = tokens[cursor++];
    let value: number;
    if (token === "(") {
      value = sum();
      if (tokens[cursor++] !== ")") throw new Error("括号不匹配");
    } else if (token === "pi" || token === "e")
      value = token === "pi" ? Math.PI : Math.E;
    else if (token && Object.hasOwn(functions, token)) {
      if (tokens[cursor++] !== "(")
        throw new Error("函数请使用括号，例如 sqrt(9)");
      value = functions[token]!(sum());
      if (tokens[cursor++] !== ")") throw new Error("函数括号不匹配");
    } else {
      value = Number(token);
      if (!token || !Number.isFinite(value))
        throw new Error("数字或函数有误：" + (token || "算式末尾"));
    }
    depth--;
    return value;
  }
  function postfix(): number {
    let value = primary();
    while (["!", "%"].includes(tokens[cursor] || "")) {
      if (tokens[cursor++] === "%") value /= 100;
      else {
        if (!Number.isInteger(value) || value < 0 || value > 170)
          throw new Error("阶乘仅支持 0–170 的整数");
        let total = 1;
        for (let n = 2; n <= value; n++) total *= n;
        value = total;
      }
    }
    return value;
  }
  function power(): number {
    const left = postfix();
    if (tokens[cursor] === "^") {
      cursor++;
      return left ** unary();
    }
    return left;
  }
  function unary(): number {
    if (tokens[cursor] === "+") {
      cursor++;
      return unary();
    }
    if (tokens[cursor] === "-") {
      cursor++;
      return -unary();
    }
    return power();
  }
  function product(): number {
    let value = unary();
    while (tokens[cursor] === "*" || tokens[cursor] === "/") {
      const op = tokens[cursor++],
        right = unary();
      if (op === "/" && right === 0) throw new Error("除数不能为 0");
      value = op === "*" ? value * right : value / right;
    }
    return value;
  }
  function sum(): number {
    let value = product();
    while (tokens[cursor] === "+" || tokens[cursor] === "-") {
      const op = tokens[cursor++],
        right = product();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  }
  const value = sum();
  if (cursor !== tokens.length)
    throw new Error("缺少运算符或括号不匹配，乘法请明确输入 *");
  if (!Number.isFinite(value))
    throw new Error("结果超出范围，或函数输入不在实数定义域内");
  return Number(value.toPrecision(14));
}
export function describeNumbers(input: string) {
  const tokens = input
    .trim()
    .split(/[\s,，;；]+/)
    .filter(Boolean);
  if (!tokens.length || tokens.length > 10000)
    throw new Error("请输入 1–10,000 个数，以空格、逗号或换行分隔");
  const values = tokens.map((t) => {
    if (
      !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(t) ||
      !Number.isFinite(Number(t))
    )
      throw new Error("无法识别数值：" + t);
    return Number(t);
  });
  let sum = 0,
    correction = 0,
    mean = 0,
    m2 = 0;
  values.forEach((n, i) => {
    const y = n - correction,
      t = sum + y;
    correction = t - sum - y;
    sum = t;
    const delta = n - mean;
    mean += delta / (i + 1);
    m2 += delta * (n - mean);
  });
  values.sort((a, b) => a - b);
  const count = values.length;
  const result = {
    count,
    sum,
    mean,
    median:
      count % 2
        ? values[(count - 1) / 2]!
        : values[count / 2 - 1]! / 2 + values[count / 2]! / 2,
    min: values[0]!,
    max: values[count - 1]!,
    variance: Math.max(0, m2 / count),
    sampleVariance: count > 1 ? Math.max(0, m2 / (count - 1)) : null,
    std: Math.sqrt(Math.max(0, m2 / count)),
  };
  if (Object.values(result).some((v) => v !== null && !Number.isFinite(v)))
    throw new Error("数值过大，统计结果超出可计算范围");
  return result;
}
const DAY = 86400000;
export function dateNumber(text: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error("请填写完整日期");
  const time = Date.parse(text + "T00:00:00Z");
  if (
    !Number.isFinite(time) ||
    new Date(time).toISOString().slice(0, 10) !== text ||
    text < "1900-01-01" ||
    text > "2100-12-31"
  )
    throw new Error("日期需有效且位于 1900–2100 年");
  return time;
}
export function workingDays(
  start: string,
  end: string,
  offset: number | null,
  holidays: string,
  makeup: string,
  includeStart = true,
  includeEnd = true,
) {
  const parseSet = (text: string) => {
    const values = text.split(/[\s,，]+/).filter(Boolean);
    if (values.length > 2000) throw new Error("自定义日期最多 2,000 个");
    return new Set(values.map(dateNumber));
  };
  const off = parseSet(holidays),
    on = parseSet(makeup);
  if ([...off].some((d) => on.has(d)))
    throw new Error("同一天不能同时设为休息和补班");
  const isWork = (day: number) =>
    on.has(day) ||
    (!off.has(day) && ![0, 6].includes(new Date(day).getUTCDay()));
  const first = dateNumber(start);
  if (offset !== null) {
    if (!Number.isInteger(offset) || Math.abs(offset) > 10000)
      throw new Error("增减工作日需为 -10,000 至 10,000 的整数");
    let current = first,
      remaining = Math.abs(offset);
    while (remaining) {
      current += (offset < 0 ? -1 : 1) * DAY;
      if (isWork(current)) remaining--;
    }
    const date = new Date(current).toISOString().slice(0, 10);
    dateNumber(date);
    return date;
  }
  const last = dateNumber(end);
  if (last < first || last - first > 36600 * DAY)
    throw new Error("结束日期不能早于开始日期，范围最多 100 年");
  let count = 0;
  for (let day = first; day <= last; day += DAY)
    if (
      (includeStart || day !== first) &&
      (includeEnd || day !== last) &&
      isWork(day)
    )
      count++;
  return count;
}
