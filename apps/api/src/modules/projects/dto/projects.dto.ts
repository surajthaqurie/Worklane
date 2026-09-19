export class CreateProjectDto {
  name: string;
  key: string;
  description?: string;
  organizationId?: string;
}

export class UpdateProjectDto {
  name?: string;
  description?: string;
  archived?: boolean;
}
