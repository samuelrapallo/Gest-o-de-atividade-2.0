
export enum TaskStatus {
  PENDING = 'Pendente',
  COMPLETED = 'Concluído',
  RESCHEDULED = 'Reprogramado'
}

export interface GoogleUser {
  name: string;
  email: string;
  picture: string;
  sub: string;
}

export interface Task {
  id: string;
  atividade: string;
  ordem: string;
  data: string;
  executante: string;
  status: TaskStatus;
  observacoes: string;
  updatedAt: number;
}

export interface AppState {
  tasks: Task[];
  user: GoogleUser | null;
  viewOnly: boolean;
}
