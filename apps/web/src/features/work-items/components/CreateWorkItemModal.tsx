'use client';

import React from 'react';
import { useCreateWorkItem } from '../hooks/useWorkItems';
import { useWorkItemStates } from '../hooks/useWorkItemStates';
import { Modal } from '@/shared/components/ui/Modal';
import { WorkItemForm } from './WorkItemForm';
import { CreateWorkItemDto } from '@/shared/types/work-items';

export interface CreateWorkItemModalProps {
  projectId: string;
  teamId?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CreateWorkItemModal({ projectId, teamId, isOpen, onClose }: CreateWorkItemModalProps) {
  const createWorkItem = useCreateWorkItem(projectId);
  const { data: states = [] } = useWorkItemStates(projectId);

  const handleSubmit = (values: CreateWorkItemDto) => {
    const initialState = states[0]?.key || 'TODO';
    createWorkItem.mutate(
      {
        ...values,
        state: initialState,
        ...(teamId ? { teamId } : {}),
      },
      {
        onSuccess: () => onClose(),
      }
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Work Item">
      <WorkItemForm
        onSubmit={handleSubmit}
        onCancel={onClose}
        isSubmitting={createWorkItem.isPending}
        initialValues={{ teamId }}
      />
    </Modal>
  );
}
