export const worldCities = [
  { name: "北京", zone: "Asia/Shanghai" },
  { name: "东京", zone: "Asia/Tokyo" },
  { name: "新加坡", zone: "Asia/Singapore" },
  { name: "新德里", zone: "Asia/Kolkata" },
  { name: "迪拜", zone: "Asia/Dubai" },
  { name: "伦敦", zone: "Europe/London" },
  { name: "巴黎", zone: "Europe/Paris" },
  { name: "纽约", zone: "America/New_York" },
  { name: "洛杉矶", zone: "America/Los_Angeles" },
  { name: "悉尼", zone: "Australia/Sydney" },
  { name: "奥克兰", zone: "Pacific/Auckland" },
  { name: "UTC", zone: "UTC" },
];
export function zonedTime(value: number, zone: string) {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
    timeZoneName: "shortOffset",
  }).formatToParts(value);
  const get = (name: string) =>
    parts.find((part) => part.type === name)?.value || "";
  return {
    date: get("year") + "-" + get("month") + "-" + get("day"),
    time: get("hour") + ":" + get("minute") + ":" + get("second"),
    weekday: get("weekday"),
    offset: get("timeZoneName").replace("GMT", "UTC"),
  };
}
export function durationText(milliseconds: number, fraction = false) {
  const value = Math.max(0, Math.floor(milliseconds));
  const seconds = Math.floor(value / 1000);
  const pad = (number: number) => String(number).padStart(2, "0");
  return (
    pad(Math.floor(seconds / 3600)) +
    ":" +
    pad(Math.floor(seconds / 60) % 60) +
    ":" +
    pad(seconds % 60) +
    (fraction ? "." + pad(Math.floor((value % 1000) / 10)) : "")
  );
}
