import { Workout, DailyWorkout, Exercise } from '../types';

const createEx = (name: string): Exercise => ({
  id: Math.random().toString(36).substr(2, 9),
  name,
  sets: 3,
  reps: 15
});

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const WORKOUT_PRESETS: Partial<Workout>[] = [
  {
    title: 'Full Body Workout',
    description: 'Train entire body in one session. High efficiency, burns more calories.',
    splitType: 'Full Body',
    dailyWorkouts: days.map(day => ({
      day,
      title: 'Full Body Session',
      exercises: [
        createEx('Squat'),
        createEx('Bench Press'),
        createEx('Bent Over Row'),
        createEx('Shoulder Press'),
        createEx('Deadlift'),
        createEx('Plank / Hanging Leg Raise')
      ]
    })).concat([{ day: 'Sunday', title: 'Rest Day', exercises: [] }])
  },
  {
    title: 'Upper / Lower Split',
    description: 'Split body into upper and lower. Solid upgrade from full body.',
    splitType: 'Upper/Lower',
    dailyWorkouts: days.map((day, i) => ({
      day,
      title: i % 2 === 0 ? 'Upper Body' : 'Lower Body',
      exercises: i % 2 === 0 ? [
        createEx('Bench Press'),
        createEx('Pull-ups / Lat Pulldown'),
        createEx('Shoulder Press'),
        createEx('Dumbbell Row'),
        createEx('Bicep Curl'),
        createEx('Tricep Pushdown')
      ] : [
        createEx('Squat'),
        createEx('Romanian Deadlift'),
        createEx('Leg Press'),
        createEx('Hamstring Curl'),
        createEx('Calf Raises'),
        createEx('Abs')
      ]
    })).concat([{ day: 'Sunday', title: 'Rest Day', exercises: [] }])
  },
  {
    title: 'Push / Pull / Legs (PPL)',
    description: 'Split by movement. Muscle building and advanced consistency.',
    splitType: 'PPL',
    dailyWorkouts: days.map((day, i) => {
      const cycle = i % 3;
      if (cycle === 0) return {
        day,
        title: 'Push Day',
        exercises: [
          createEx('Bench Press'),
          createEx('Incline Dumbbell Press'),
          createEx('Shoulder Press'),
          createEx('Lateral Raises'),
          createEx('Tricep Dips'),
          createEx('Tricep Pushdown')
        ]
      };
      if (cycle === 1) return {
        day,
        title: 'Pull Day',
        exercises: [
          createEx('Pull-ups / Lat Pulldown'),
          createEx('Barbell Row'),
          createEx('Seated Cable Row'),
          createEx('Face Pull'),
          createEx('Bicep Curl'),
          createEx('Hammer Curl')
        ]
      };
      return {
        day,
        title: 'Legs Day',
        exercises: [
          createEx('Squat'),
          createEx('Deadlift'),
          createEx('Leg Press'),
          createEx('Lunges'),
          createEx('Calf Raises'),
          createEx('Hanging Leg Raise')
        ]
      };
    }).concat([{ day: 'Sunday', title: 'Rest Day', exercises: [] }])
  },
  {
    title: 'Body Part Split (Bro Split)',
    description: 'One muscle group per day. Ideal for bodybuilders.',
    splitType: 'Bro Split',
    dailyWorkouts: [
      { day: 'Monday', title: 'Chest Day', exercises: [createEx('Bench Press'), createEx('Incline Bench Press'), createEx('Chest Fly'), createEx('Cable Fly'), createEx('Push-ups'), createEx('Dips')] },
      { day: 'Tuesday', title: 'Back Day', exercises: [createEx('Pull-ups'), createEx('Barbell Row'), createEx('Lat Pulldown'), createEx('Seated Row'), createEx('Deadlift'), createEx('Face Pull')] },
      { day: 'Wednesday', title: 'Legs Day', exercises: [createEx('Squat'), createEx('Leg Press'), createEx('Lunges'), createEx('Hamstring Curl'), createEx('Calf Raises'), createEx('Leg Extension')] },
      { day: 'Thursday', title: 'Shoulders Day', exercises: [createEx('Shoulder Press'), createEx('Lateral Raise'), createEx('Front Raise'), createEx('Rear Delt Fly'), createEx('Shrugs'), createEx('Face Pull')] },
      { day: 'Friday', title: 'Arms Day', exercises: [createEx('Bicep Curl'), createEx('Hammer Curl'), createEx('Preacher Curl'), createEx('Tricep Pushdown'), createEx('Skull Crushers'), createEx('Dips')] },
      { day: 'Saturday', title: 'Core + Cardio', exercises: [createEx('Hanging Leg Raise'), createEx('Plank'), createEx('Russian Twist'), createEx('Bicycle Crunch'), createEx('Mountain Climbers'), createEx('HIIT')] },
      { day: 'Sunday', title: 'Rest Day', exercises: [] }
    ]
  },
  {
    title: 'HIIT Training',
    description: 'Short bursts + rest. Fast, brutal, effective for fat loss.',
    splitType: 'HIIT',
    dailyWorkouts: days.map(day => ({
      day,
      title: 'HIIT Session',
      exercises: [
        createEx('Sprint (30 sec)'),
        createEx('Jump Squats'),
        createEx('Burpees'),
        createEx('Mountain Climbers'),
        createEx('High Knees'),
        createEx('Plank')
      ]
    })).concat([{ day: 'Sunday', title: 'Rest Day', exercises: [] }])
  },
  {
    title: 'Functional Training',
    description: 'Real-life movement training. Kettlebells, balance, and core.',
    splitType: 'Functional',
    dailyWorkouts: days.map(day => ({
      day,
      title: 'Functional Session',
      exercises: [
        createEx('Kettlebell Swings'),
        createEx('Battle Ropes'),
        createEx('Box Jumps'),
        createEx('Farmer’s Carry'),
        createEx('Medicine Ball Slams'),
        createEx('Core (Plank / Rotation)')
      ]
    })).concat([{ day: 'Sunday', title: 'Rest Day', exercises: [] }])
  },
  {
    title: 'Calisthenics Mastery',
    description: 'Bodyweight training for strength and control. Lean aesthetic.',
    splitType: 'Calisthenics',
    dailyWorkouts: [
      { day: 'Monday', title: 'Push Day', exercises: [createEx('Push-ups'), createEx('Incline Push-ups'), createEx('Dips'), createEx('Pike Push-ups'), createEx('Diamond Push-ups'), createEx('Plank')] },
      { day: 'Tuesday', title: 'Pull Day', exercises: [createEx('Pull-up'), createEx('Negative Pull-ups'), createEx('Australian Rows'), createEx('Dead Hang'), createEx('Bicep Chin-ups'), createEx('Hanging Knee Raises')] },
      { day: 'Wednesday', title: 'Legs Day', exercises: [createEx('Squats'), createEx('Jump Squats'), createEx('Lunges'), createEx('Bulgarian Split Squat'), createEx('Calf Raises'), createEx('Wall Sit')] },
      { day: 'Thursday', title: 'Push Day', exercises: [createEx('Push-ups'), createEx('Incline Push-ups'), createEx('Dips'), createEx('Pike Push-ups'), createEx('Diamond Push-ups'), createEx('Plank')] },
      { day: 'Friday', title: 'Pull Day', exercises: [createEx('Pull-up'), createEx('Negative Pull-ups'), createEx('Australian Rows'), createEx('Dead Hang'), createEx('Bicep Chin-ups'), createEx('Hanging Knee Raises')] },
      { day: 'Saturday', title: 'Legs Day', exercises: [createEx('Squats'), createEx('Jump Squats'), createEx('Lunges'), createEx('Bulgarian Split Squat'), createEx('Calf Raises'), createEx('Wall Sit')] },
      { day: 'Sunday', title: 'Rest Day', exercises: [] }
    ]
  }
];
