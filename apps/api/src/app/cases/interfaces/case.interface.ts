import {
  CaseSource,
  Priority,
  Stages,
  UserStatus,
  UserType,
} from '../../../../../../../ewu_task/libs/database/src/lib/generated/prisma/client';

export interface ICaseAssignee {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  type: UserType;
  status: UserStatus;
}

export interface ICaseStage {
  id: number;
  stageTitle: string;
}

export const CASE_DISPLAY_PROPERTIES = [
  { key: 'id', label: 'Case ID', selected: true },

  { key: 'subjectName', label: 'Subject Name', selected: true },
  { key: 'age', label: 'Age', selected: false },

  { key: 'incidentType', label: 'Incident Type', selected: true },
  { key: 'incidentDate', label: 'Incident Date', selected: true },

  { key: 'caseSummary', label: 'Case Summary', selected: false },

  { key: 'address911', label: '911 Address', selected: false },
  { key: 'callTime911', label: '911 Call Time', selected: false },

  { key: 'state', label: 'State', selected: true },
  { key: 'city', label: 'City', selected: true },
  { key: 'zip', label: 'ZIP Code', selected: false },

  { key: 'arrestDate', label: 'Arrest Date', selected: false },

  { key: 'assignee', label: 'Assignees', selected: true },

  { key: 'stageId', label: 'Stage ID', selected: false },
  { key: 'stage', label: 'Stage', selected: true },

  { key: 'dueDate', label: 'Due Date', selected: true },

  { key: 'casePriority', label: 'Case Priority', selected: true },

  { key: 'caseSource', label: 'Case Source', selected: true },

  { key: 'priority', label: 'Priority', selected: true },

  { key: 'createdAt', label: 'Created At', selected: true },
  { key: 'updatedAt', label: 'Updated At', selected: false },
] as const;

export type CaseDisplayPropertyKey = (typeof CASE_DISPLAY_PROPERTIES)[number]['key'];

export interface ICaseDisplayProperty {
  key: CaseDisplayPropertyKey;
  label: string;
  selected: boolean;
}

export interface ICaseDisplayResult {
  id?: string;
  subjectName?: string;
  age?: number | null;
  incidentType?: string;
  incidentDate?: Date;
  caseSummary?: string | null;
  address911?: string | null;
  callTime911?: string | null;
  state?: string;
  city?: string;
  zip?: string | null;
  arrestDate?: Date | null;
  assignee?: ICaseAssignee[];
  stageId?: number | null;
  stage?: Stages | null;
  dueDate?: Date | null;
  casePriority?: string | null;
  caseSource?: CaseSource;
  priority?: Priority;
  createdAt?: Date;
}

export interface IGroupedCasesByStage {
  stageId: number | null;
  stageTitle: string | null;
  caseCount: number;
  cases: ICaseDisplayResult[];
}

export interface ICreateCaseRequest {
  subjectName: string;
  age?: number | null;
  incidentType: string;
  incidentDate: Date;
  caseSummary: string | null;
  address911?: string | null;
  callTime911?: string | null;
  state: string;
  city: string;
  zip: string | null;
  arrestDate?: Date | null;
  assigneeIds: number[];
  stageId?: number | null;
  dueDate?: Date | null;
  casePriority: string | null;
  caseSource: CaseSource;
  priority: Priority;
}

export interface IUpdateCaseRequest {
  subjectName?: string;
  age?: number | null;
  incidentType?: string;
  incidentDate?: Date;
  caseSummary?: string | null;
  address911?: string | null;
  callTime911?: string | null;
  state?: string;
  city?: string;
  zip?: string | null;
  arrestDate?: Date | null;
  assigneeIds?: number[];
  stageId?: number | null;
  dueDate?: Date | null;
  casePriority?: string | null;
  caseSource?: CaseSource;
  priority?: Priority;
}

export interface ICaseMutationResult {
  id: string;
  subjectName: string;
  age: number | null;
  incidentType: string;
  incidentDate: Date;
  caseSummary: string | null;
  address911: string | null;
  callTime911: string | null;
  state: string;
  city: string;
  zip: string | null;
  arrestDate: Date | null;
  assignee: ICaseAssignee[];
  stageId: number | null;
  stage: Stages | null;
  dueDate: Date | null;
  createdAt: Date;
  casePriority: string | null;
  caseSource: CaseSource;
  priority: Priority;
}
