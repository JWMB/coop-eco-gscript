import { DateUtils, StringUtils, toObject } from './utils';

describe('DateUtils', () => {
  it('addMonths works', () => {
    expect(DateUtils.addMonths(new Date('2000-12-01'), 1)).toStrictEqual(
      new Date('2001-01-01')
    );
    expect(
      DateUtils.getDate(new Date('2001-01-01T08:00:00.000Z'))
    ).toStrictEqual(new Date('2001-01-01'));
    expect(DateUtils.getDateStr(new Date('2001-01-01T08:00:00.000Z'))).toBe(
      '2001-01-01'
    );
    expect(DateUtils.getDayInYear(new Date('2000-01-29'))).toBe(28); // ???
    expect(DateUtils.getFirstOfMonthStr('2000-01-29')).toBe('2000-01-01');
    expect(DateUtils.getFirstOfYearStr('2000-05-29')).toBe('2000-01-01');
    //   expect(isNumberParseable(1892)).toBe(true);
  });

  // it('returns `false` for values non parseable to number', () => {
  //   expect(isNumberParseable('A8sa')).toBe(false);
  //   expect(isNumberParseable('18L')).toBe(false);
  // });
});

describe('StringUtils', () => {
  it('works', () => {
    expect(StringUtils.padLeft('as', ' ', 4)).toBe('  as');
  });
});

describe('toObject', () => {
  it('works', () => {
    expect(
      toObject(
        [
          [1, 'a'],
          [2, 'b']
        ],
        l => [l[1], l[0]]
      )
    ).toStrictEqual({ a: 1, b: 2 });
  });
});
