import { WorkItemTypeRegistryService } from './work-item-types.registry.js';

describe('WorkItemTypeRegistryService', () => {
  let registry: WorkItemTypeRegistryService;

  beforeEach(() => {
    registry = new WorkItemTypeRegistryService();
  });

  it('provides all 5 core work item types', () => {
    const types = registry.getAllTypes();
    expect(types).toHaveLength(5);
    const keys = types.map((t) => t.key);
    expect(keys).toContain('EPIC');
    expect(keys).toContain('FEATURE');
    expect(keys).toContain('STORY');
    expect(keys).toContain('TASK');
    expect(keys).toContain('BUG');
  });

  it('retrieves detailed type definitions by key', () => {
    const epic = registry.getType('EPIC');
    expect(epic).not.toBeNull();
    expect(epic?.hierarchyLevel).toBe(0);
    expect(epic?.allowedParentTypes).toHaveLength(0);

    const bug = registry.getType('bug');
    expect(bug).not.toBeNull();
    expect(bug?.key).toBe('BUG');
  });

  it('validates whether a type string is registered', () => {
    expect(registry.isValidType('STORY')).toBe(true);
    expect(registry.isValidType('task')).toBe(true);
    expect(registry.isValidType('UNKNOWN_TYPE')).toBe(false);
    expect(registry.isValidType('')).toBe(false);
  });

  it('validates parent-child hierarchy relationships according to registry rules', () => {
    expect(registry.isAllowedParent('EPIC', 'FEATURE')).toBe(true);
    expect(registry.isAllowedParent('FEATURE', 'STORY')).toBe(true);
    expect(registry.isAllowedParent('STORY', 'TASK')).toBe(true);
    expect(registry.isAllowedParent('STORY', 'BUG')).toBe(true);

    // Invalid hierarchy relationships
    expect(registry.isAllowedParent('TASK', 'EPIC')).toBe(false);
    expect(registry.isAllowedParent('BUG', 'EPIC')).toBe(false);
    expect(registry.isAllowedParent('STORY', 'EPIC')).toBe(false);
  });
});
