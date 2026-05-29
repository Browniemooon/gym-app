import React, { useState, useEffect } from 'react';
import { 
  Dumbbell, 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  Upload, 
  Sparkles 
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  UserProfile, 
  Workout, 
  DailyWorkout, 
  Exercise, 
  MemberWorkoutProgress, 
  UserRole, 
  OperationType 
} from '../types';
import { cn } from '../lib/utils';
import { handleFirestoreError } from '../lib/firestoreUtils';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Modal } from './ui/Modal';

// Mock presets for loading
const WORKOUT_PRESETS: Partial<Workout>[] = [
  {
    title: "Classic PPL - Push",
    description: "Focus on Chest, Shoulders, and Triceps",
    splitType: "PPL",
  },
  {
    title: "Classic PPL - Pull",
    description: "Focus on Back and Biceps",
    splitType: "PPL",
  },
  {
    title: "Classic PPL - Legs",
    description: "Focus on Quads, Hamstrings, and Calves",
    splitType: "PPL",
  }
];

interface WorkoutManagementProps {
  user: UserProfile;
}

export const WorkoutManagement = ({ user }: WorkoutManagementProps) => {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);
  const [progress, setProgress] = useState<MemberWorkoutProgress | null>(null);
  const [activeDay, setActiveDay] = useState(new Date().toLocaleDateString('en-US', { weekday: 'long' }));
  
  const splitTypes = ['Full Body', 'Upper/Lower', 'PPL', 'Bro Split', 'HIIT', 'Functional', 'Calisthenics'];
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    splitType: Workout['splitType'];
    dailyWorkouts: DailyWorkout[];
    isDefault: boolean;
  }>({
    title: '',
    description: '',
    splitType: 'Full Body',
    dailyWorkouts: days.map(day => ({ day, title: '', exercises: [], restDay: false })),
    isDefault: false
  });

  const [savingPlan, setSavingPlan] = useState(false);

  useEffect(() => {
    if (!user.gymId) return;
    const q = query(collection(db, 'workouts'), where('gymId', '==', user.gymId));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Workout));
      data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setWorkouts(data);
    });
  }, [user.gymId]);

  useEffect(() => {
    if (user.role !== UserRole.MEMBER) return;
    const today = new Date().toISOString().split('T')[0];
    const q = query(
      collection(db, 'workoutProgress'), 
      where('memberId', '==', user.id || user.uid || ''),
      where('gymId', '==', user.gymId || ''),
      where('date', '==', today)
    );
    return onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setProgress({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as any);
      } else {
        setProgress(null);
      }
    });
  }, [user.id, user.uid, user.gymId, user.role]);

  const handleSave = async () => {
    if (!formData.title) return;
    try {
      setSavingPlan(true);
      const data = {
        ...formData,
        gymId: user.gymId || 'system',
        createdAt: editingWorkout?.createdAt || Date.now(),
        createdBy: user.uid
      };

      if (editingWorkout) {
        await updateDoc(doc(db, 'workouts', editingWorkout.id), data);
      } else {
        await addDoc(collection(db, 'workouts'), data);
      }
      setIsAdding(false);
      setEditingWorkout(null);
      resetForm();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, 'workouts');
    } finally {
      setSavingPlan(false);
    }
  };

  const addExerciseToForm = (dayIndex: number) => {
    const newDaily = [...formData.dailyWorkouts];
    newDaily[dayIndex].exercises.push({
      id: Math.random().toString(36).substring(2, 9),
      name: '',
      sets: '',
      reps: '',
      rest: '',
      notes: ''
    });
    setFormData({ ...formData, dailyWorkouts: newDaily });
  };

  const removeExerciseFromForm = (dayIndex: number, exerciseIndex: number) => {
    const newDaily = [...formData.dailyWorkouts];
    newDaily[dayIndex].exercises.splice(exerciseIndex, 1);
    setFormData({ ...formData, dailyWorkouts: newDaily });
  };

  const updateExerciseInForm = (dayIndex: number, exerciseIndex: number, field: string, value: string) => {
    const newDaily = [...formData.dailyWorkouts];
    newDaily[dayIndex].exercises[exerciseIndex] = {
      ...newDaily[dayIndex].exercises[exerciseIndex],
      [field]: value
    };
    setFormData({ ...formData, dailyWorkouts: newDaily });
  };

  const toggleRestDayInForm = (dayIndex: number) => {
    const newDaily = [...formData.dailyWorkouts];
    newDaily[dayIndex].restDay = !newDaily[dayIndex].restDay;
    if (newDaily[dayIndex].restDay) {
      newDaily[dayIndex].exercises = [];
    }
    setFormData({ ...formData, dailyWorkouts: newDaily });
  };

  const importExercises = (dayIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const newExercises: Exercise[] = [];

      lines.forEach((line, index) => {
        if (!line.trim()) return;
        if (index === 0 && line.toLowerCase().includes('name')) return;
        
        const [name, sets, reps, rest, notes] = line.split(',').map(s => s.trim());
        if (name) {
          newExercises.push({
            id: Math.random().toString(36).substring(2, 9),
            name,
            sets: sets || '',
            reps: reps || '',
            rest: rest || '',
            notes: notes || ''
          });
        }
      });

      const newDaily = [...formData.dailyWorkouts];
      newDaily[dayIndex].exercises = [...newDaily[dayIndex].exercises, ...newExercises];
      setFormData({ ...formData, dailyWorkouts: newDaily });
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const fillRandomExercises = (dayIndex: number) => {
    const pool = [
      'Bench Press', 'Incline Dumbbell Press', 'Push-ups', 'Chest Fly',
      'Deadlift', 'Pull-ups', 'Barbell Rows', 'Lat Pulldown', 'Seated Cable Row',
      'Squat', 'Leg Press', 'Lunges', 'Leg Extension', 'Hamstring Curls', 'Calf Raises',
      'Shoulder Press', 'Lateral Raises', 'Front Raise', 'Face Pull',
      'Bicep Curls', 'Hammer Curls', 'Tricep Pushdown', 'Skull Crushers', 'Dips',
      'Plank', 'Hanging Leg Raises', 'Russian Twists', 'Bicycle Crunches',
      'Burpees', 'Mountain Climbers', 'Jump Squats', 'Sprint', 'Barbell Curls',
      'Preacher Curls', 'Close Grip Bench', 'Cable Crossover'
    ];
    
    const count = 5 + Math.floor(Math.random() * 3);
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);
    
    const newExercises: Exercise[] = selected.map(name => ({
      id: Math.random().toString(36).substring(2, 9),
      name,
      sets: '3',
      reps: '12',
      rest: '60s',
      notes: 'Controlled tempo'
    }));

    const newDaily = [...formData.dailyWorkouts];
    newDaily[dayIndex].exercises = [...newDaily[dayIndex].exercises, ...newExercises];
    setFormData({ ...formData, dailyWorkouts: newDaily });
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      splitType: 'Full Body',
      dailyWorkouts: days.map(day => ({ day, title: '', exercises: [], restDay: false })),
      isDefault: false
    });
  };

  const handleLoadPresets = async () => {
    if (!window.confirm('This will load standard workout plans. Continue?')) return;
    try {
      const batch = writeBatch(db);
      WORKOUT_PRESETS.forEach(preset => {
        const newDocRef = doc(collection(db, 'workouts'));
        batch.set(newDocRef, {
          ...preset,
          gymId: user.gymId,
          createdAt: Date.now(),
          createdBy: user.uid,
          isDefault: user.role === UserRole.SUPER_STAFF,
          dailyWorkouts: days.map(day => ({ day, title: '', exercises: [], restDay: (day === 'Sunday') }))
        });
      });
      await batch.commit();
    } catch (err) {
      console.error('Failed to load presets:', err);
    }
  };

  const toggleExercise = async (workoutId: string, exerciseId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const mid = user.id || user.uid || '';
    if (progress) {
      const completedIds = progress.completedExerciseIds.includes(exerciseId)
        ? progress.completedExerciseIds.filter(id => id !== exerciseId)
        : [...progress.completedExerciseIds, exerciseId];
      
      await updateDoc(doc(db, 'workoutProgress', (progress as any).id), {
        completedExerciseIds: completedIds,
        gymId: user.gymId
      });
    } else {
      await addDoc(collection(db, 'workoutProgress'), {
        memberId: mid,
        gymId: user.gymId,
        workoutId,
        date: today,
        completedExerciseIds: [exerciseId],
        isRestDay: false
      });
    }
  };

  const toggleRestDay = async (workoutId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const mid = user.id || user.uid || '';
    if (progress) {
      await updateDoc(doc(db, 'workoutProgress', (progress as any).id), {
        isRestDay: !progress.isRestDay,
        completedExerciseIds: [],
        gymId: user.gymId
      });
    } else {
      await addDoc(collection(db, 'workoutProgress'), {
        memberId: mid,
        gymId: user.gymId,
        workoutId,
        date: today,
        completedExerciseIds: [],
        isRestDay: true
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this workout plan?')) return;
    try {
      await deleteDoc(doc(db, 'workouts', id));
    } catch (err) {
      console.error('Failed to delete workout:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-bold flex items-center gap-2">
          <Dumbbell className="w-5 h-5 text-[var(--primary)]" /> Workout Plans
        </h3>
        <div className="flex gap-2">
          {user.role === UserRole.SUPER_STAFF && workouts.length === 0 && (
            <Button variant="ghost" onClick={handleLoadPresets} icon={Plus} className="text-xs py-1.5 h-auto">
              Load Presets
            </Button>
          )}
          {(user.role === UserRole.SUPER_STAFF || user.role === UserRole.GYM_STAFF) && (
            <Button variant="primary" onClick={() => { resetForm(); setIsAdding(true); }} icon={Plus} className="text-xs py-1.5 h-auto">
              New Plan
            </Button>
          )}
        </div>
      </div>

      {user.role === UserRole.MEMBER && (
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {days.map(day => (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
                activeDay === day ? "bg-[var(--primary)] text-black" : "bg-white/5 text-[var(--text-muted)] hover:bg-white/10"
              )}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {workouts.map(w => {
          const todayWorkout = w.dailyWorkouts?.find(dw => dw.day === activeDay);
          const isAssigned = w.gymId === user.gymId || w.gymId === 'system' || user.role !== UserRole.MEMBER;

          if (user.role === UserRole.MEMBER && !isAssigned) return null;

          return (
            <Card key={w.id} className="relative overflow-hidden group">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-black uppercase italic text-lg">{w.title}</h4>
                    <span className="text-[10px] px-2 py-0.5 bg-[var(--primary)]/10 text-[var(--primary)] rounded-full font-bold uppercase">
                      {w.splitType}
                    </span>
                    {w.isDefault && (
                      <span className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded-full font-bold uppercase">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">{w.description}</p>
                </div>
                {(user.role === UserRole.SUPER_STAFF || user.role === UserRole.GYM_STAFF) && (
                  <div className="flex gap-2">
                    <button onClick={() => {
                      setEditingWorkout(w);
                      setFormData({
                        title: w.title,
                        description: w.description,
                        splitType: w.splitType || 'Full Body',
                        dailyWorkouts: w.dailyWorkouts || days.map(day => ({ day, title: '', exercises: [], restDay: false })),
                        isDefault: !!w.isDefault
                      });
                      setIsAdding(true);
                    }} className="p-2 hover:bg-white/5 rounded-lg transition-all"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(w.id)} className="p-2 hover:bg-red-500/10 text-red-500 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>

              {user.role === UserRole.MEMBER ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold uppercase tracking-widest text-[var(--primary)]">{activeDay}'s Routine</h5>
                    <button 
                      onClick={() => toggleRestDay(w.id)}
                      className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all",
                        progress?.isRestDay ? "bg-orange-500 text-white" : "bg-white/5 text-[var(--text-muted)] hover:bg-white/10"
                      )}
                    >
                      {progress?.isRestDay ? "Rest Day Active" : "Mark as Rest Day"}
                    </button>
                  </div>
                  
                  {progress?.isRestDay ? (
                    <div className="py-12 text-center bg-orange-500/5 rounded-2xl border border-dashed border-orange-500/20">
                      <p className="text-sm font-bold text-orange-500 italic">Enjoy your rest day! Recovery is key. 💪</p>
                    </div>
                  ) : todayWorkout?.exercises.length ? (
                    <div className="grid grid-cols-1 gap-2">
                      {todayWorkout.exercises.map(ex => {
                        const isDone = progress?.completedExerciseIds.includes(ex.id);
                        return (
                          <div 
                            key={ex.id}
                            onClick={() => toggleExercise(w.id, ex.id)}
                            className={cn(
                              "p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between",
                              isDone ? "bg-[var(--primary)]/10 border-[var(--primary)]/30" : "bg-white/5 border-white/10 hover:border-white/20"
                            )}
                          >
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                                isDone ? "bg-[var(--primary)] border-[var(--primary)]" : "border-white/20"
                              )}>
                                {isDone && <Check className="w-4 h-4 text-black" />}
                              </div>
                              <div>
                                <p className={cn("font-bold text-sm", isDone && "line-through opacity-50")}>{ex.name}</p>
                                <p className="text-[10px] text-[var(--text-muted)]">{ex.sets} Sets × {ex.reps} Reps</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-8 text-center bg-white/5 rounded-2xl border border-dashed border-white/10">
                      <p className="text-xs text-[var(--text-muted)] italic">Rest Day or No Workout Scheduled</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
                  {days.map(day => {
                    const dw = w.dailyWorkouts?.find(d => d.day === day);
                    return (
                      <div key={day} className="p-2 bg-white/5 rounded-xl border border-white/5">
                        <p className="text-[10px] font-bold uppercase text-[var(--text-muted)] mb-1">{day.slice(0, 3)}</p>
                        <p className="text-[10px] font-medium truncate">{dw?.exercises.length || 0} Exs</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Modal 
        isOpen={isAdding} 
        onClose={() => { setIsAdding(false); setEditingWorkout(null); }} 
        title={editingWorkout ? "Edit Workout Plan" : "New Workout Plan"}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setIsAdding(false); setEditingWorkout(null); }} className="flex-1">Cancel</Button>
            <Button variant="primary" onClick={handleSave} loading={savingPlan} className="flex-1">Save Plan</Button>
          </>
        }
      >
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Plan Title</label>
              <input 
                type="text" 
                value={formData.title} 
                onChange={(e) => setFormData({...formData, title: e.target.value})} 
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:neon-border outline-none transition-all" 
                placeholder="e.g. Summer Shred" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Split Type</label>
              <select 
                value={formData.splitType} 
                onChange={(e) => setFormData({...formData, splitType: e.target.value as any})} 
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:neon-border outline-none transition-all"
              >
                {splitTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Description</label>
            <textarea 
              value={formData.description} 
              onChange={(e) => setFormData({...formData, description: e.target.value})} 
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:neon-border outline-none transition-all resize-none h-20" 
              placeholder="Brief description..." 
            />
          </div>

          {(user.role === UserRole.SUPER_STAFF || user.role === UserRole.GYM_STAFF) && (
            <label className="flex items-center gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl cursor-pointer">
              <input 
                type="checkbox" 
                checked={formData.isDefault} 
                onChange={(e) => setFormData({...formData, isDefault: e.target.checked})}
                className="w-5 h-5 rounded border-white/20 bg-white/5 text-[var(--primary)] focus:ring-0"
              />
              <div>
                <p className="text-sm font-bold">Public Plan</p>
                <p className="text-[10px] text-[var(--text-muted)]">This plan will be visible to all members in your gym.</p>
              </div>
            </label>
          )}

          <div className="space-y-4 pt-4 border-t border-white/10">
            <h4 className="text-sm font-black uppercase italic">Daily Routines</h4>
            <div className="space-y-6">
              {formData.dailyWorkouts.map((dw, dIdx) => (
                <div key={dw.day} className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold uppercase tracking-widest text-[var(--primary)]">{dw.day}</h5>
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        onClick={() => toggleRestDayInForm(dIdx)} 
                        className={cn("text-[10px] py-1 h-auto", dw.restDay ? "bg-orange-500/20 text-orange-500 border-orange-500/50" : "")}
                      >
                        {dw.restDay ? "Rest day active" : "Mark as Rest Day"}
                      </Button>
                      {!dw.restDay && (
                        <>
                           <Button variant="ghost" onClick={() => fillRandomExercises(dIdx)} icon={Sparkles} className="text-[10px] py-1 h-auto text-[var(--primary)]">Autofill</Button>
                           <Button variant="ghost" onClick={() => addExerciseToForm(dIdx)} icon={Plus} className="text-[10px] py-1 h-auto">Add Exercise</Button>
                        </>
                      )}
                    </div>
                  </div>
                  {!dw.restDay && (
                    <div className="space-y-4">
                      {dw.exercises.map((ex, eIdx) => (
                        <div key={ex.id} className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-3">
                          <div className="grid grid-cols-12 gap-3 items-end">
                            <div className="col-span-11 grid grid-cols-1 md:grid-cols-4 gap-2">
                              <div className="space-y-1">
                                <label className="text-[8px] font-bold uppercase text-[var(--text-muted)]">Name</label>
                                <input 
                                  type="text" 
                                  value={ex.name} 
                                  onChange={(e) => updateExerciseInForm(dIdx, eIdx, 'name', e.target.value)}
                                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none"
                                  placeholder="Exercise"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8px] font-bold uppercase text-[var(--text-muted)]">Sets</label>
                                <input 
                                  type="text" 
                                  value={ex.sets} 
                                  onChange={(e) => updateExerciseInForm(dIdx, eIdx, 'sets', e.target.value)}
                                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none"
                                  placeholder="4"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8px] font-bold uppercase text-[var(--text-muted)]">Reps</label>
                                <input 
                                  type="text" 
                                  value={ex.reps} 
                                  onChange={(e) => updateExerciseInForm(dIdx, eIdx, 'reps', e.target.value)}
                                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none"
                                  placeholder="12"
                                />
                              </div>
                            </div>
                            <div className="col-span-1 flex justify-end">
                              <button onClick={() => removeExerciseFromForm(dIdx, eIdx)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
