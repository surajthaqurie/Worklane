import { Injectable } from '@nestjs/common';

export type WorkItemTypeName = 'EPIC' | 'FEATURE' | 'STORY' | 'TASK' | 'BUG';

export interface WorkItemTypeDefinition {
  key: WorkItemTypeName;
  name: string;
  description: string;
  category: 'PORTFOLIO' | 'REQUIREMENT' | 'TASK' | 'DEFECT';
  hierarchyLevel: number; // 0 = Epic, 1 = Feature, 2 = Story/Bug, 3 = Task
  allowedParentTypes: WorkItemTypeName[];
  icon: string;
  color: string;
  supportedFields: string[];
}

const DEFAULT_WORK_ITEM_TYPES: Record<WorkItemTypeName, WorkItemTypeDefinition> = {
  EPIC: {
    key: 'EPIC',
    name: 'Epic',
    description: 'High-level portfolio initiative',
    category: 'PORTFOLIO',
    hierarchyLevel: 0,
    allowedParentTypes: [],
    icon: 'Layers',
    color: '#8B5CF6',
    supportedFields: ['severity', 'start_date', 'target_date', 'custom_fields'],
  },
  FEATURE: {
    key: 'FEATURE',
    name: 'Feature',
    description: 'Distinct functionality delivering business value',
    category: 'PORTFOLIO',
    hierarchyLevel: 1,
    allowedParentTypes: ['EPIC'],
    icon: 'Grid',
    color: '#EC4899',
    supportedFields: ['severity', 'points', 'start_date', 'target_date', 'custom_fields'],
  },
  STORY: {
    key: 'STORY',
    name: 'User Story',
    description: 'Requirement from an end-user perspective',
    category: 'REQUIREMENT',
    hierarchyLevel: 2,
    allowedParentTypes: ['FEATURE', 'EPIC'],
    icon: 'BookOpen',
    color: '#3B82F6',
    supportedFields: ['severity', 'points', 'remaining_work', 'completed_work', 'start_date', 'target_date', 'custom_fields'],
  },
  TASK: {
    key: 'TASK',
    name: 'Task',
    description: 'Individual unit of work',
    category: 'TASK',
    hierarchyLevel: 3,
    allowedParentTypes: ['STORY', 'BUG', 'FEATURE'],
    icon: 'CheckSquare',
    color: '#F59E0B',
    supportedFields: ['remaining_work', 'completed_work', 'start_date', 'target_date', 'custom_fields'],
  },
  BUG: {
    key: 'BUG',
    name: 'Bug',
    description: 'Defect or issue requiring resolution',
    category: 'DEFECT',
    hierarchyLevel: 2,
    allowedParentTypes: ['STORY'],
    icon: 'Bug',
    color: '#EF4444',
    supportedFields: ['severity', 'remaining_work', 'completed_work', 'start_date', 'target_date', 'custom_fields'],
  },
};

@Injectable()
export class WorkItemTypeRegistryService {
  private readonly typeRegistry: Map<string, WorkItemTypeDefinition> = new Map();

  constructor() {
    Object.values(DEFAULT_WORK_ITEM_TYPES).forEach((def) => {
      this.typeRegistry.set(def.key, def);
    });
  }

  getAllTypes(): WorkItemTypeDefinition[] {
    return Array.from(this.typeRegistry.values());
  }

  getType(typeKey: string): WorkItemTypeDefinition | null {
    if (!typeKey) return null;
    return this.typeRegistry.get(typeKey.toUpperCase()) ?? null;
  }

  isValidType(typeKey: string): boolean {
    if (!typeKey) return false;
    return this.typeRegistry.has(typeKey.toUpperCase());
  }

  isAllowedParent(parentType: string, childType: string): boolean {
    const childDef = this.getType(childType);
    if (!childDef) return false;
    if (childDef.allowedParentTypes.length === 0) return false;
    return childDef.allowedParentTypes.includes(parentType.toUpperCase() as WorkItemTypeName);
  }

  getAllowedParentTypes(childType: string): WorkItemTypeName[] {
    const childDef = this.getType(childType);
    return childDef ? childDef.allowedParentTypes : [];
  }
}
