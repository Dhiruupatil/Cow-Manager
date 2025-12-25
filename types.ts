
export interface Farmer {
  id: string;
  mobile: string;
  farmName: string;
}

export interface Cow {
  id: string;
  farmerId: string;
  tagNumber: string;
  name: string;
  image?: string;
  dob: string;
}

export interface InseminationRecord {
  id: string;
  farmerId: string;
  cowId: string;
  date: string;
  isConfirmed: boolean;
  doctorName: string;
  bullName: string;
  notes?: string;
}

export type AppView = 'dashboard' | 'cows' | 'insemination' | 'pregnant' | 'assistant';
