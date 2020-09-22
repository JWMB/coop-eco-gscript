export class DateUtils {
  static getDate(date: Date): Date {
    return new Date(
      '' +
        date.getFullYear() +
        '-' +
        StringUtils.padLeft('' + (date.getMonth() + 1), '0', 2) +
        '-' +
        StringUtils.padLeft('' + date.getDate(), '0', 2)
    );
  }
  static getDateStr(d: Date): string {
    return (
      d.getFullYear() +
      '-' +
      StringUtils.padLeft((d.getMonth() + 1).toString(), '0', 2) +
      '-' +
      StringUtils.padLeft(d.getDate().toString(), '0', 2)
    );
  }
  static getFirstOfMonthStr(v: string): string {
    var d = new Date(v);
    return (
      d.getFullYear() +
      '-' +
      StringUtils.padLeft((d.getMonth() + 1).toString(), '0', 2) +
      '-01'
    );
  }
  static getFirstOfYearStr(v: string): string {
    return new Date(v).getFullYear().toString() + '-01-01';
  }
  static addMonths(date: Date, months: number): Date {
    return new Date(date.setMonth(date.getMonth() + months));
  }
  static getDayInYear(d: Date, yearIfPrecalced?: number): number {
    return Math.round(
      (d.valueOf() -
        new Date(yearIfPrecalced || d.getFullYear(), 0, 1).valueOf()) /
        1000 /
        60 /
        60 /
        24
    );
  }
}

export class StringUtils {
  static padLeft(str: string, char: string, totLen: number): string {
    let padding = '';
    for (let i = str.length; i < totLen; i++) {
      padding += char;
    }
    return padding + str;
  }
}

export interface KeyValueMap<T> {
  [key: string]: T;
}

export function toObject(
  list: any[],
  funcKeyAndValue?: (value: any, index: number, arr: any[]) => [string, any]
): KeyValueMap<any> {
  const result = <KeyValueMap<any>>{};
  if (!funcKeyAndValue) {
    funcKeyAndValue = (k) => [k[0], k[1]];
  }
  for (let i = 0; i < list.length; i++) {
    const kv = funcKeyAndValue(list[i], i, list);
    result[kv[0]] = kv[1];
  }
  return result;
}

function parseFloatInternal(value: any): number {
  return value == null ? Number.NaN : parseFloat(value.toString().replace(/\s/g, ""));
}
export function parseFloatOrDefault(value: any, defaultValue: number = 0): number {
  const result = parseFloatInternal(value);
  return isNaN(result) ? defaultValue : result;
}
export function parseFloatOrAny(value: any, defaultValue: any): any {
  const result = parseFloatInternal(value);
  return isNaN(result) ? defaultValue : result;
} 