export interface Unit {
  id: string;
  name: string;
  factor: number;
  offset?: number;
}
export interface UnitGroup {
  id: string;
  name: string;
  units: Unit[];
}
export const unitGroups: UnitGroup[] = [
  {
    id: "length",
    name: "长度",
    units: [
      { id: "m", name: "米 m", factor: 1 },
      { id: "km", name: "千米 km", factor: 1000 },
      { id: "cm", name: "厘米 cm", factor: 0.01 },
      { id: "mm", name: "毫米 mm", factor: 0.001 },
      { id: "in", name: "英寸 in", factor: 0.0254 },
      { id: "ft", name: "英尺 ft", factor: 0.3048 },
      { id: "yd", name: "码 yd", factor: 0.9144 },
      { id: "mi", name: "英里 mi", factor: 1609.344 },
    ],
  },
  {
    id: "mass",
    name: "重量",
    units: [
      { id: "kg", name: "千克 kg", factor: 1 },
      { id: "g", name: "克 g", factor: 0.001 },
      { id: "mg", name: "毫克 mg", factor: 0.000001 },
      { id: "t", name: "吨 t", factor: 1000 },
      { id: "jin", name: "市斤", factor: 0.5 },
      { id: "lb", name: "磅 lb", factor: 0.45359237 },
      { id: "oz", name: "盎司 oz", factor: 0.028349523125 },
    ],
  },
  {
    id: "temperature",
    name: "温度",
    units: [
      { id: "c", name: "摄氏度 °C", factor: 1, offset: 0 },
      { id: "f", name: "华氏度 °F", factor: 5 / 9, offset: -32 },
      { id: "k", name: "开尔文 K", factor: 1, offset: -273.15 },
    ],
  },
  {
    id: "area",
    name: "面积",
    units: [
      { id: "m2", name: "平方米 m²", factor: 1 },
      { id: "km2", name: "平方千米 km²", factor: 1e6 },
      { id: "cm2", name: "平方厘米 cm²", factor: 0.0001 },
      { id: "ha", name: "公顷 ha", factor: 1e4 },
      { id: "mu", name: "市亩", factor: 2000 / 3 },
      { id: "ft2", name: "平方英尺 ft²", factor: 0.09290304 },
    ],
  },
  {
    id: "volume",
    name: "体积",
    units: [
      { id: "l", name: "升 L", factor: 1 },
      { id: "ml", name: "毫升 mL", factor: 0.001 },
      { id: "m3", name: "立方米 m³", factor: 1000 },
      { id: "gal", name: "美制加仑 gal", factor: 3.785411784 },
      { id: "ukgal", name: "英制加仑 gal", factor: 4.54609 },
    ],
  },
  {
    id: "data",
    name: "数据容量",
    units: [
      { id: "byte", name: "字节 B", factor: 1 },
      { id: "bit", name: "比特 bit", factor: 0.125 },
      { id: "kb", name: "千字节 KB（1000 B）", factor: 1e3 },
      { id: "mb", name: "MB（1000 KB）", factor: 1e6 },
      { id: "gb", name: "GB（1000 MB）", factor: 1e9 },
      { id: "tb", name: "TB（1000 GB）", factor: 1e12 },
      { id: "kib", name: "KiB（1024 B）", factor: 1024 },
      { id: "mib", name: "MiB（1024 KiB）", factor: 1024 ** 2 },
      { id: "gib", name: "GiB（1024 MiB）", factor: 1024 ** 3 },
      { id: "tib", name: "TiB（1024 GiB）", factor: 1024 ** 4 },
    ],
  },
];
export function readNumber(value: string) {
  if (
    !value.trim() ||
    !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())
  )
    throw new Error("请输入有效数字，可使用小数或科学计数法");
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error("数值过大，请缩小后重试");
  return result;
}
export function formatNumber(value: number) {
  if (!Number.isFinite(value))
    throw new Error("结果超出可计算范围，请缩小数值");
  if (Object.is(value, -0) || value === 0) return "0";
  return String(Number(value.toPrecision(12)));
}
export function convertUnit(
  value: number,
  groupId: string,
  fromId: string,
  toId: string,
) {
  if (!Number.isFinite(value)) throw new Error("请输入有效数字");
  const group = unitGroups.find((group) => group.id === groupId);
  const from = group?.units.find((unit) => unit.id === fromId);
  const to = group?.units.find((unit) => unit.id === toId);
  if (!from || !to) throw new Error("请选择同一分类下的单位");
  if (groupId !== "temperature" && value < 0)
    throw new Error("此类单位的数值不能为负数");
  let base = (value + (from.offset || 0)) * from.factor;
  if (groupId === "temperature" && base < -273.15 - 1e-10)
    throw new Error("温度不能低于绝对零度");
  if (groupId === "temperature" && Math.abs(base + 273.15) < 1e-10)
    base = -273.15;
  const result = base / to.factor - (to.offset || 0);
  if (!Number.isFinite(result))
    throw new Error("结果超出可计算范围，请缩小数值");
  return result;
}
export type PercentageMode = "portion" | "ratio" | "change";
export function calculatePercentage(
  first: number,
  second: number,
  mode: PercentageMode,
) {
  if (![first, second].every(Number.isFinite))
    throw new Error("请输入有效数字");
  if (mode === "ratio" && second === 0) throw new Error("总数不能为 0");
  if (mode === "change" && first <= 0) throw new Error("变化率的原值需大于 0");
  const result =
    mode === "portion"
      ? first * (second / 100)
      : mode === "ratio"
        ? (first / second) * 100
        : ((second - first) / first) * 100;
  if (!Number.isFinite(result))
    throw new Error("结果超出可计算范围，请缩小数值");
  return result;
}
