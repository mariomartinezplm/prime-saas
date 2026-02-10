import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ExerciseProgressChart from '@/components/charts/ExerciseProgressChart';
import { format, parseISO } from 'date-fns';
import { Dumbbell, TrendingUp, BarChart3, Award } from 'lucide-react';
import api from '@/lib/api';
import type { ExerciseProgress } from '@/types';

const ExercisesEnhanced = () => {
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
    }).catch(() => { })
      .finally(() => setLoading(false));
  }, [user]);

  const filtered = selectedExercise === 'all'
    ? exercises
    : exercises.filter((e) => e.exerciseName === selectedExercise);

  // Group exercises by name for charts
  const groupedExercises: Record<string, ExerciseProgress[]> = {};
  exercises.forEach(ex => {
    if (!groupedExercises[ex.exerciseName]) {
      groupedExercises[ex.exerciseName] = [];
    }
    groupedExercises[ex.exerciseName].push(ex);
  });

  // Get top 6 exercises by frequency
  const topExercises = Object.entries(groupedExercises)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 6)
    .map(([name]) => name);

  // Calculate stats
  const totalSessions = exercises.length;
  const uniqueExercises = exerciseNames.length;
  const totalVolume = exercises.reduce((sum, ex) => {
    if (ex.sets && ex.reps && ex.weight) {
      return sum + (ex.sets * ex.reps * ex.weight);
    }
    return sum;
  }, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-1">Progreso de Ejercicios</h1>
        <p className="text-muted-foreground">Monitorea tu evolución en cada ejercicio</p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-card bg-gradient-section">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Sesiones</p>
                <p className="text-3xl font-bold text-primary">{totalSessions}</p>
              </div>
              <Dumbbell className="w-10 h-10 text-primary/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card bg-gradient-section">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Ejercicios Únicos</p>
                <p className="text-3xl font-bold text-primary">{uniqueExercises}</p>
              </div>
              <BarChart3 className="w-10 h-10 text-primary/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card bg-gradient-section">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Volumen Total</p>
                <p className="text-3xl font-bold text-primary">{(totalVolume / 1000).toFixed(1)}<span className="text-lg ml-1">ton</span></p>
              </div>
              <Award className="w-10 h-10 text-primary/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="progress" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="progress" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span>Gráficos de Progreso</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            <span>Historial</span>
          </TabsTrigger>
        </TabsList>

        {/* Progress Charts Tab */}
        <TabsContent value="progress" className="space-y-6">
          {topExercises.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2">
              {topExercises.map(exerciseName => {
                const exerciseData = groupedExercises[exerciseName]
                  .filter(ex => ex.weight)
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map(ex => ({
                    date: ex.date,
                    weight: ex.weight!,
                    reps: ex.reps,
                    sets: ex.sets,
                  }));

                return (
                  <ExerciseProgressChart
                    key={exerciseName}
                    exerciseName={exerciseName}
                    data={exerciseData}
                  />
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-20 text-center">
                <Dumbbell className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No hay ejercicios registrados
                </h3>
                <p className="text-muted-foreground">
                  Tu kinesiólogo registrará tus ejercicios durante las sesiones
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* History Table Tab */}
        <TabsContent value="history" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Historial Completo</h2>
              <p className="text-sm text-muted-foreground">Filtra por ejercicio para ver detalles</p>
            </div>
            <Select value={selectedExercise} onValueChange={setSelectedExercise}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filtrar ejercicio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los ejercicios</SelectItem>
                {exerciseNames.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No hay ejercicios para mostrar</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-card">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-gradient-section">
                        <th className="text-left p-3 text-muted-foreground font-semibold">Fecha</th>
                        <th className="text-left p-3 text-muted-foreground font-semibold">Ejercicio</th>
                        <th className="text-center p-3 text-muted-foreground font-semibold">Categoría</th>
                        <th className="text-center p-3 text-muted-foreground font-semibold">Series</th>
                        <th className="text-center p-3 text-muted-foreground font-semibold">Reps</th>
                        <th className="text-center p-3 text-muted-foreground font-semibold">Peso</th>
                        <th className="text-center p-3 text-muted-foreground font-semibold">RPE</th>
                        <th className="text-center p-3 text-muted-foreground font-semibold">1RM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((ex, idx) => (
                        <tr key={ex._id} className={`border-b border-border/50 hover:bg-gradient-section transition-colors ${idx % 2 === 0 ? 'bg-background' : ''}`}>
                          <td className="p-3 font-medium">{format(parseISO(ex.date), 'dd/MM/yyyy')}</td>
                          <td className="p-3 font-semibold text-foreground">{ex.exerciseName}</td>
                          <td className="p-3 text-center capitalize">
                            <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs">
                              {ex.category}
                            </span>
                          </td>
                          <td className="p-3 text-center font-medium">{ex.sets || '-'}</td>
                          <td className="p-3 text-center font-medium">{ex.reps || '-'}</td>
                          <td className="p-3 text-center font-bold text-primary">{ex.weight ? `${ex.weight} ${ex.weightUnit}` : '-'}</td>
                          <td className="p-3 text-center">{ex.rpe ? `${ex.rpe}/10` : '-'}</td>
                          <td className="p-3 text-center font-bold text-secondary">
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
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ExercisesEnhanced;
