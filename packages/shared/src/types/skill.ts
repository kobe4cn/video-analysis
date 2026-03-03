export interface SkillItem {
  id: string;
  name: string;
  description: string | null;
  version: number;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SkillDetail extends SkillItem {
  content: string;
}

export interface CreateSkillRequest {
  name: string;
  description?: string;
  content: string;
}

export interface UpdateSkillRequest {
  name?: string;
  description?: string;
  content?: string;
}

export interface SkillVersionItem {
  id: string;
  version: number;
  content: string;
  createdAt: string;
}
