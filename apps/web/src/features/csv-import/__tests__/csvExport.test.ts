import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  escapeCsvCell,
  formatErrorReportCsv,
  getSampleTemplateCsv,
  downloadCsvFile,
  downloadErrorReport,
  downloadSampleTemplate,
} from '../utils/csvExport';
import type { CsvRowError } from '../types';

describe('csvExport utils', () => {
  describe('escapeCsvCell', () => {
    it('returns empty string for null and undefined', () => {
      expect(escapeCsvCell(null)).toBe('');
      expect(escapeCsvCell(undefined)).toBe('');
    });

    it('returns unquoted string for simple alphanumeric text', () => {
      expect(escapeCsvCell('Hello')).toBe('Hello');
      expect(escapeCsvCell(123)).toBe('123');
    });

    it('wraps and escapes values containing comma, quotes, or newlines', () => {
      expect(escapeCsvCell('hello, world')).toBe('"hello, world"');
      expect(escapeCsvCell('hello "world"')).toBe('"hello ""world"""');
      expect(escapeCsvCell('line 1\nline 2')).toBe('"line 1\nline 2"');
    });
  });

  describe('formatErrorReportCsv', () => {
    it('returns empty string when there are no errors', () => {
      expect(formatErrorReportCsv([], [{ Title: 'Item' }])).toBe('');
    });

    it('formats errors and maps raw row values properly', () => {
      const errors: CsvRowError[] = [
        {
          row: 1,
          field: 'priority',
          message: 'priority must be LOW, MEDIUM, HIGH, or URGENT',
          rawValue: 'SUPER_HIGH',
        },
        {
          row: 2,
          field: 'title',
          message: 'title is required',
          rawValue: '',
        },
      ];

      const rawRows = [
        { Title: 'Fix login, auth issue', Priority: 'SUPER_HIGH' },
        { Title: '', Priority: 'LOW' },
      ];

      const csv = formatErrorReportCsv(errors, rawRows);
      const lines = csv.split('\r\n');

      expect(lines[0]).toBe('Row Number,Failed Field,Error Reason,Failed Value,Title,Priority');
      expect(lines[1]).toBe('1,priority,"priority must be LOW, MEDIUM, HIGH, or URGENT",SUPER_HIGH,"Fix login, auth issue",SUPER_HIGH');
      expect(lines[2]).toBe('2,title,title is required,,,LOW');
    });

    it('handles errors pointing to missing row index gracefully', () => {
      const errors: CsvRowError[] = [
        {
          row: 99,
          field: 'general',
          message: 'Unknown row error',
        },
      ];
      const rawRows = [{ Title: 'First' }];

      const csv = formatErrorReportCsv(errors, rawRows);
      expect(csv).toContain('99,general,Unknown row error,,');
    });
  });

  describe('getSampleTemplateCsv', () => {
    it('returns valid CSV template containing standard Worklane columns and example records', () => {
      const template = getSampleTemplateCsv();
      expect(template).toContain('Title,Type,State,Priority,Points,Assignee,Area,Iteration,Parent,Tags,StartDate,TargetDate,Description');
      expect(template).toContain('"Setup Authentication","STORY","To Do","HIGH",5');
      expect(template).toContain('"Fix mobile overflow bug","BUG"');
    });
  });

  describe('DOM download interactions', () => {
    let originalWindow: typeof window;
    let originalDocument: typeof document;
    let originalUrl: typeof URL;
    let clicked = false;
    let downloadedFilename = '';

    beforeEach(() => {
      originalWindow = global.window;
      originalDocument = global.document;
      originalUrl = global.URL;

      clicked = false;
      downloadedFilename = '';

      const mockLink = {
        setAttribute: vi.fn((key: string, val: string) => {
          if (key === 'download') downloadedFilename = val;
        }),
        click: vi.fn(() => {
          clicked = true;
        }),
      };

      const mockDoc = {
        createElement: vi.fn(() => mockLink),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn(),
        },
      };

      // @ts-expect-error Mocking browser globals in node
      global.window = {};
      // @ts-expect-error Mocking browser globals in node
      global.document = mockDoc;
      // @ts-expect-error Mocking URL
      global.URL = {
        createObjectURL: vi.fn(() => 'blob:mock-url'),
        revokeObjectURL: vi.fn(),
      };
    });

    afterEach(() => {
      global.window = originalWindow;
      global.document = originalDocument;
      global.URL = originalUrl;
    });

    it('downloadCsvFile creates link, triggers click, and cleans up', () => {
      downloadCsvFile('a,b\n1,2', 'data.csv');
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(clicked).toBe(true);
      expect(downloadedFilename).toBe('data.csv');
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('downloadErrorReport triggers download when errors are present', () => {
      downloadErrorReport(
        [{ row: 1, field: 'title', message: 'required' }],
        [{ Title: '' }],
      );
      expect(clicked).toBe(true);
      expect(downloadedFilename).toMatch(/worklane-import-errors-\d{4}-\d{2}-\d{2}\.csv/);
    });

    it('downloadSampleTemplate triggers template download', () => {
      downloadSampleTemplate();
      expect(clicked).toBe(true);
      expect(downloadedFilename).toBe('worklane-import-template.csv');
    });
  });
});
