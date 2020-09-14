import { Aggregation, GroupingDefinition, AggregationDefinition } from './aggregation';
import { DateUtils } from './utils';

describe('Aggregation', () => {
  it('works', () => {
    const data = [
      ['Date', 'Cost', 'Group'],
      ['2000-01-01', 5, 'a'],
      ['2000-01-05', 10, 'a'],
      ['2000-01-05', 10, 'b'],
      ['2000-02-01', 20, 'a'],
      ['2000-02-05', 30, 'a'],
      ['2000-02-05', 30, 'b'],
    ];
    const grouping: GroupingDefinition[] = [
      { name: 'Month', col: 0, func: val => DateUtils.getFirstOfMonthStr(<string>val) },
      { name: 'Group', col: 2, func: val => <string>val },
    ];
    const agg: AggregationDefinition = { name: 'Sum', col: 1, func: (curr, prev) => curr + (prev || 0) };
    const result = Aggregation.aggregateRows(data, grouping, agg, true);
    expect(result).toStrictEqual(
      { 
        "2000-01-01": {
          "a": 15,
          "b": 10
        },
        "2000-02-01": {
          "a": 50,
          "b": 30
        },
      });
      const expectedRows = [
        ["Month", "Group", "Sum"],
        ["2000-02-01", "b", 30],
        ["2000-02-01", "a", 50],
        ["2000-01-01", "b", 10],
        ["2000-01-01", "a", 15],
      ];
      expect(Aggregation.aggregatedToRows(result)).toStrictEqual(expectedRows.slice(1));
      expect(Aggregation.aggregateIntoRows(data, grouping, agg, true)).toStrictEqual(expectedRows);
  });
});
