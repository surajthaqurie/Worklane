import { describe, expect, it } from 'vitest';
import { detectDelimiter, parseCsv, parseCsvRaw, suggestFieldMapping } from './csv-parser.js';

describe('CSV Parser', () => {
  it('detects comma, semicolon, and tab delimiters', () => {
    expect(detectDelimiter('title,type,state\nTask 1,TASK,TODO')).toBe(',');
    expect(detectDelimiter('title;type;state\nTask 1;TASK;TODO')).toBe(';');
    expect(detectDelimiter('title\ttype\tstate\nTask 1\tTASK\tTODO')).toBe('\t');
  });

  it('parses standard RFC 4180 CSV with quotes, commas, and escaped quotes', () => {
    const csv = `Title,Description,Points
"Task with, comma","Description with ""escaped"" quotes",5
"Multi-line
task","Line 1
Line 2",8
Simple Task,Normal description,3`;

    const result = parseCsvRaw(csv);

    expect(result).toHaveLength(4); // header + 3 rows
    expect(result[0]).toEqual(['Title', 'Description', 'Points']);
    expect(result[1]).toEqual(['Task with, comma', 'Description with "escaped" quotes', '5']);
    expect(result[2][0]).toBe('Multi-line\ntask');
    expect(result[2][1]).toBe('Line 1\nLine 2');
    expect(result[3]).toEqual(['Simple Task', 'Normal description', '3']);
  });

  it('infers field mapping from common header aliases', () => {
    const headers = [
      'Task Title',
      'Issue Type',
      'Status',
      'Assignee',
      'Story Points',
      'Sprint',
      'Component',
      'Due Date',
    ];

    const mapping = suggestFieldMapping(headers);

    expect(mapping['Task Title']).toBe('title');
    expect(mapping['Issue Type']).toBe('type');
    expect(mapping['Status']).toBe('state');
    expect(mapping['Assignee']).toBe('assignedTo');
    expect(mapping['Story Points']).toBe('points');
    expect(mapping['Sprint']).toBe('iteration');
    expect(mapping['Component']).toBe('area');
    expect(mapping['Due Date']).toBe('targetDate');
  });

  it('parseCsv returns structured result with sample rows and suggested mappings', () => {
    const csv = `Title,Type,Points\nStory A,STORY,5\nBug B,BUG,3`;
    const result = parseCsv(csv);

    expect(result.headers).toEqual(['Title', 'Type', 'Points']);
    expect(result.totalRows).toBe(2);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].Title).toBe('Story A');
    expect(result.rows[1].Title).toBe('Bug B');
    expect(result.suggestedMapping['Title']).toBe('title');
    expect(result.suggestedMapping['Type']).toBe('type');
  });
});
