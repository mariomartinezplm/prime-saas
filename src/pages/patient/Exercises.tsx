import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO } from 'date-fns';
import api from '@/lib/api';
import type { ExerciseProgress } from '@/types';

const Exercises = () => {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<ExerciseProgress[]>([]);
  const [exerciseNames, setExerciseNames] = useState<string[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.get(`/exercises/patient/${user.id}`),
      api.get(`/exercises/list/${user.id}`),
    ]).then(([exRes, listRes]) => {
      setExercises(exRes.data.data.exercises || []);
      setExerciseNames(listRes.data.data.exercises || []);
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const filtered = selectedExercise === 'all'
    ? exercises
    : exercises.filter((e) => e.exerciseName === selectedExercise);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ejercicios</h1>
          <p className="text-muted-foreground">Historial de cargas y repeticiones</p>
        </div>
        <Select value={selectedExercise} onValueChange={setSelectedExercise}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar ejercicio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {exerciseNames.map((name) => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No tienes ejercicios registrados</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-muted-foreground">Fecha</th>
                    <th className="text-left p-3 text-muted-foreground">Ejercicio</th>
                    <th className="text-center p-3 text-muted-foreground">Categoría</th>
                    <th className="text-center p-3 text-muted-foreground">Series</th>
                    <th className="text-center p-3 text-muted-foreground">Reps</th>
                    <th className="text-center p-3 text-muted-foreground">Peso</th>
                    <th className="text-center p-3 text-muted-foreground">RPE</th>
                    <th className="text-center p-3 text-muted-foreground">1RM</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ex) => (
                    <tr key={ex._id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="p-3">{format(parseISO(ex.date), 'dd/MM/yyyy')}</td>
                      <td className="p-3 font-medium">{ex.exerciseName}</td>
                      <td className="p-3 text-center capitalize text-muted-foreground">{ex.category}</td>
                      <td className="p-3 text-center">{ex.sets || '-'}</td>
                      <td className="p-3 text-center">{ex.reps || '-'}</td>
                      <td className="p-3 text-center">{ex.weight ? `${ex.weight} ${ex.weightUnit}` : '-'}</td>
                      <td className="p-3 text-center">{ex.rpe || '-'}</td>
                      <td className="p-3 text-center text-secondary font-medium">
                        {ex.oneRepMax ? `${ex.oneRepMax.toFixed(1)} kg` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Exercises;
