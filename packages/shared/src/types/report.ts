export interface ReportItem {
  id: string;
  videoId: string;
  videoTitle: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReportDetail extends ReportItem {
  content: string;
}

export interface ReportVersionItem {
  id: string;
  version: number;
  createdAt: string;
}

export interface ReportVersionDetail extends ReportVersionItem {
  content: string;
  skillId: string | null;
  modelId: string | null;
  prompt: string | null;
}

export interface ReviseReportRequest {
  additionalRequirements: string;
}
