
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Task, TaskStatus } from '../types';

interface DashboardChartsProps {
  tasks: Task[];
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({ tasks }) => {
  const stats = tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const data = [
    { name: TaskStatus.PENDING, value: stats[TaskStatus.PENDING] || 0, color: '#94a3b8' },
    { name: TaskStatus.COMPLETED, value: stats[TaskStatus.COMPLETED] || 0, color: '#22c55e' },
    { name: TaskStatus.RESCHEDULED, value: stats[TaskStatus.RESCHEDULED] || 0, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  // Group by executor
  const executorStats = tasks.reduce((acc, task) => {
    if (!acc[task.executante]) acc[task.executante] = { total: 0, completed: 0 };
    acc[task.executante].total++;
    if (task.status === TaskStatus.COMPLETED) acc[task.executante].completed++;
    return acc;
  }, {} as Record<string, { total: number, completed: number }>);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-80">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Status Geral das Atividades</h3>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">Nenhum dado disponível</div>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Resumo por Executante</h3>
        <div className="overflow-y-auto max-h-60 space-y-3">
          {/* Cast entries to correct type to fix TS errors for accessing properties on unknown type */}
          {(Object.entries(executorStats) as [string, { total: number, completed: number }][]).map(([name, stat]) => (
            <div key={name} className="flex flex-col gap-1">
              <div className="flex justify-between text-sm font-medium">
                <span className="text-gray-700">{name}</span>
                <span className="text-gray-500">{stat.completed} / {stat.total}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${(stat.completed / stat.total) * 100}%` }}
                />
              </div>
            </div>
          ))}
          {Object.keys(executorStats).length === 0 && <div className="text-center text-gray-400 py-10">Sem executantes vinculados</div>}
        </div>
      </div>
    </div>
  );
};
