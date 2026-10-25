self.onmessage = (
  event: MessageEvent<{ pattern: string; flags: string; text: string }>,
) => {
  try {
    const { pattern, flags, text } = event.data;
    const regex = new RegExp(pattern, flags);
    const matches: { value: string; index: number; groups: string[] }[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        value: match[0],
        index: match.index,
        groups: match.slice(1),
      });
      if (!regex.global || matches.length >= 1000) break;
      if (match[0] === "") {
        const code = text.codePointAt(regex.lastIndex);
        regex.lastIndex +=
          regex.unicode && code !== undefined && code > 0xffff ? 2 : 1;
      }
    }
    self.postMessage({ matches, limited: matches.length >= 1000 });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "表达式有误",
    });
  }
};
