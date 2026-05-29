export enum UserRole {
  SUPER_STAFF = 'SUPER_STAFF',
  GYM_STAFF = 'GYM_STAFF',
  STAFF = 'STAFF',
  MEMBER = 'MEMBER'
}

export enum OperationType {
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE'
}

export interface Gym {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  themeColor: string;
  active: boolean;
  memberCount: number;
  capacity: number;
  currentOccupancy: number;
  ownerId: string;
  paymentConfig?: {
    type: 'upi' | 'razorpay' | 'stripe';
    upiId?: string;
    razorpayKey?: string;
    stripeKey?: string;
    bankAccount?: {
      accountNumber: string;
      ifsc: string;
      holderName: string;
    };
  };
  createdAt: number;
}

export interface MembershipPlan {
  id: string;
  gymId: string;
  name: string;
  price: number;
  durationDays: number;
  description?: string;
  createdAt: number;
}

export interface UserProfile {
  uid: string;
  id?: string; // Custom Member ID (e.g. GYM-101)
  phone?: string; // Primary identifier for members
  name: string;
  email?: string;
  role: UserRole;
  gymId: string; // The primary link to a gym
  status: 'active' | 'inactive' | 'suspended';
  membershipExpiresAt?: number;
  expiryNotified?: {
    dayBefore: boolean;
    dayOf: boolean;
  };
  createdAt: number;
  gymConfig?: { // Added back for UI convenience
    name: string;
    themeColor: string;
    logoUrl?: string;
  };
  membershipPlanId?: string;
  lastPaymentId?: string;
  assignedWorkoutId?: string; // Current workout plan
  autoApproveCheckin?: boolean;
}

export interface CheckIn {
  id: string;
  gymId: string;
  memberId: string;
  memberName: string;
  timestamp: number;
  day?: string;
  time?: string;
  status: 'request' | 'approved' | 'rejected';
  approvedAt?: number;
  approvedBy?: string; // Staff member UID who approved this
  staffName?: string;
}

export interface ProgressLog {
  id: string;
  memberId: string;
  gymId: string;
  weight: number;
  bodyFat?: number;
  chest?: number;
  waist?: number;
  arms?: number;
  thighs?: number;
  timestamp: number;
  notes?: string;
}

export interface Broadcast {
  id: string;
  gymId: string;
  message: string;
  timestamp: number;
  senderId: string;
  targetType: 'all_members' | 'individual_member';
  targetId?: string;
}

export interface Exercise {
  id: string;
  name: string;
  reps?: string | number;
  sets?: string | number;
  rest?: string;
  notes?: string;
  isCompleted?: boolean;
}

export interface DailyWorkout {
  day: string; // Monday, Tuesday, etc.
  title: string;
  exercises: Exercise[];
  restDay?: boolean;
}

export interface Workout {
  id: string;
  gymId: string;
  title: string;
  description: string;
  splitType: 'Full Body' | 'Upper/Lower' | 'PPL' | 'Bro Split' | 'HIIT' | 'Functional' | 'Calisthenics' | 'Custom';
  dailyWorkouts: DailyWorkout[];
  isDefault?: boolean;
  createdAt: number;
  createdBy: string;
}

export interface MemberWorkoutProgress {
  memberId: string;
  workoutId: string;
  date: string; // YYYY-MM-DD
  completedExerciseIds: string[];
  isRestDay?: boolean;
}
