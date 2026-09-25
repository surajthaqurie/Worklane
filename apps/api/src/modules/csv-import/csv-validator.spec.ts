import { describe, expect, it } from 'vitest';
import { validateCsvRows } from './csv-validator.js';
import type { ProjectDomainContext } from './csv-import.types.js';

describe('CSV Validator', () => {
  const mockContext: ProjectDomainContext = {
    projectId: 'p-1',
    states: [
      { id: 's-1', key: 'TODO', name: 'To Do', is_done: false, category: 'PROPOSED' },
      { id: 's-2', key: 'IN_PROGRESS', name: 'In Progress', is_done: false, category: 'IN_PROGRESS' },
      { id: 's-3', key: 'DONE', name: 'Done', is_done: true, category: 'COMPLETED' },
    ],
    defaultStateKey: 'TODO',
    areas: [
      { id: 'a-1', name: 'Frontend' },
      { id: 'a-2', name: 'Backend' },
    ],
    defaultAreaId: 'a-1',
    iterations: [
      { id: 'it-1', name: 'Sprint 1' },
      { id: 'it-2', name: 'Sprint 2' },
    ],
    members: [
      { id: 'u-1', name: 'Alice Smith', email: 'alice@worklane.dev' },
      { id: 'u-2', name: 'Bob Jones', email: 'bob@worklane.dev' },
    ],
    existingWorkItems: [
      { id: 'wi-epic', seq_no: 10, title: 'Auth Epic', type: 'EPIC' },
      { id: 'wi-feature', seq_no: 20, title: 'OAuth Feature', type: 'FEATURE' },
      { id: 'wi-story', seq_no: 30, title: 'Google Login', type: 'STORY' },
    ],
  };

  const standardMapping = {
    Title: 'title',
    Type: 'type',
    State: 'state',
    Assignee: 'assignedTo',
    Area: 'area',
    Iteration: 'iteration',
    Parent: 'parent',
    Points: 'points',
    Priority: 'priority',
    Tags: 'tags',
    StartDate: 'startDate',
    TargetDate: 'targetDate',
  };

  it('validates and accepts clean work item rows', () => {
    const rows = [
      {
        Title: 'Implement Apple Sign-In',
        Type: 'STORY',
        State: 'To Do',
        Assignee: 'alice@worklane.dev',
        Area: 'Frontend',
        Iteration: 'Sprint 1',
        Parent: 'OAuth Feature',
        Points: '5',
        Priority: 'HIGH',
        Tags: 'auth, oauth',
        StartDate: '2026-10-01',
        TargetDate: '2026-10-15',
      },
    ];

    const result = validateCsvRows(rows, standardMapping, mockContext);

    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.validRows[0].title).toBe('Implement Apple Sign-In');
    expect(result.validRows[0].type).toBe('STORY');
    expect(result.validRows[0].state).toBe('TODO');
    expect(result.validRows[0].assignedTo).toBe('u-1');
    expect(result.validRows[0].areaId).toBe('a-1');
    expect(result.validRows[0].iterationId).toBe('it-1');
    expect(result.validRows[0].parentId).toBe('wi-feature');
    expect(result.validRows[0].points).toBe(5);
    expect(result.validRows[0].priority).toBe('HIGH');
    expect(result.validRows[0].tags).toEqual(['auth', 'oauth']);
  });

  it('rejects missing or empty title', () => {
    const rows = [{ Title: '', Type: 'TASK' }];
    const result = validateCsvRows(rows, standardMapping, mockContext);

    expect(result.invalidCount).toBe(1);
    expect(result.errors.some((e) => e.field === 'title')).toBe(true);
  });

  it('rejects invalid work item type', () => {
    const rows = [{ Title: 'Invalid Type Item', Type: 'SUPER_TASK' }];
    const result = validateCsvRows(rows, standardMapping, mockContext);

    expect(result.invalidCount).toBe(1);
    expect(result.errors.some((e) => e.field === 'type')).toBe(true);
  });

  it('validates state and flags unknown state', () => {
    const rows = [{ Title: 'Unknown State Item', State: 'NON_EXISTENT_STATE' }];
    const result = validateCsvRows(rows, standardMapping, mockContext);

    expect(result.invalidCount).toBe(1);
    expect(result.errors.some((e) => e.field === 'state')).toBe(true);
  });

  it('validates user membership and rejects non-project users', () => {
    const rows = [{ Title: 'Task', Assignee: 'hacker@outside.org' }];
    const result = validateCsvRows(rows, standardMapping, mockContext);

    expect(result.invalidCount).toBe(1);
    expect(result.errors.some((e) => e.field === 'assignedTo')).toBe(true);
  });

  it('validates hierarchy rules and rejects invalid parent relationships', () => {
    // Epic cannot have a parent
    const epicWithParent = [{ Title: 'Child Epic', Type: 'EPIC', Parent: 'OAuth Feature' }];
    const epicResult = validateCsvRows(epicWithParent, standardMapping, mockContext);
    expect(epicResult.errors.some((e) => e.field === 'parent')).toBe(true);

    // Feature parent must be Epic (not Story)
    const featureWithStoryParent = [{ Title: 'Feature under Story', Type: 'FEATURE', Parent: 'Google Login' }];
    const featureResult = validateCsvRows(featureWithStoryParent, standardMapping, mockContext);
    expect(featureResult.errors.some((e) => e.field === 'parent')).toBe(true);
  });

  it('supports intra-file parent resolution referencing earlier rows in CSV', () => {
    const rows = [
      { Title: 'Mobile App Epic', Type: 'EPIC' },
      { Title: 'Push Notifications Feature', Type: 'FEATURE', Parent: 'Mobile App Epic' },
      { Title: 'Receive APNS token', Type: 'STORY', Parent: 'Push Notifications Feature' },
      { Title: 'Configure background handler', Type: 'TASK', Parent: 'Receive APNS token' },
    ];

    const result = validateCsvRows(rows, standardMapping, mockContext);

    expect(result.validCount).toBe(4);
    expect(result.invalidCount).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.validRows[1].parentRowNumber).toBe(1);
    expect(result.validRows[2].parentRowNumber).toBe(2);
    expect(result.validRows[3].parentRowNumber).toBe(3);
  });

  it('validates date logic (target date must be on or after start date)', () => {
    const rows = [
      {
        Title: 'Inverted Dates',
        StartDate: '2026-12-10',
        TargetDate: '2026-12-01',
      },
    ];

    const result = validateCsvRows(rows, standardMapping, mockContext);

    expect(result.invalidCount).toBe(1);
    expect(result.errors.some((e) => e.field === 'targetDate')).toBe(true);
  });

  it('validates numeric fields (points, remaining, completed work)', () => {
    const rows = [
      {
        Title: 'Invalid points',
        Points: '-5',
      },
    ];

    const result = validateCsvRows(rows, standardMapping, mockContext);

    expect(result.invalidCount).toBe(1);
    expect(result.errors.some((e) => e.field === 'points')).toBe(true);
  });
});
