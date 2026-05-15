import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Dumbbell, 
  Megaphone, 
  History, 
  CheckCircle, 
  ChevronRight, 
  CreditCard,
  Download,
  Bell
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  limit, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc,
  orderBy
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { UserProfile, CheckIn, MembershipPlan, Gym, Broadcast, UserRole } from '../types';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Modal } from './ui/Modal';

interface MemberDashboardProps {
  user: UserProfile;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const PWAInstallSection = ({ canInstall, onInstall }: { canInstall: boolean, onInstall: () => void }) => {
  if (!canInstall) return null;
  
  return (
    <Card className="p-4 border-[var(--primary)]/20 bg-[var(--primary)]/5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[var(--primary)]/20 text-[var(--primary)]">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm uppercase tracking-tighter italic">Install Official App</h4>
            <p className="text-[10px] opacity-60">Install for a better mobile experience and offline access.</p>
          </div>
        </div>
        <Button variant="primary" onClick={onInstall} className="py-2 px-4 h-auto text-[10px]">
          Install
        </Button>
      </div>
    </Card>
  );
};

export const NotificationPermissionSection = () => {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const requestPermission = async () => {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  if (permission === 'granted') return (
    <Card className="p-4 bg-green-500/5 border-green-500/20">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-green-500/20 text-green-500">
          <CheckCircle className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-bold text-sm uppercase tracking-tighter italic">Notifications Enabled</h4>
          <p className="text-[10px] opacity-60">You will receive alerts for important updates.</p>
        </div>
      </div>
    </Card>
  );

  return (
    <Card className="p-4 border-orange-500/20 bg-orange-500/5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-orange-500/20 text-orange-500">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm uppercase tracking-tighter italic">Enable Notifications</h4>
            <p className="text-[10px] opacity-60">Get notified about check-ins and renewals.</p>
          </div>
        </div>
        <Button 
          variant="secondary" 
          onClick={requestPermission} 
          className="py-2 px-4 h-auto text-[10px] bg-orange-500 hover:bg-orange-600 border-none"
        >
          Enable
        </Button>
      </div>
    </Card>
  );
};

export const MemberDashboard = ({ user, activeTab, setActiveTab }: MemberDashboardProps) => {
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [myCheckins, setMyCheckins] = useState<CheckIn[]>([]);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [staffProfile, setStaffProfile] = useState<UserProfile | null>(null);
  const [checkinsLimit, setCheckinsLimit] = useState(20);
  const [hasMoreCheckins, setHasMoreCheckins] = useState(true);
  const [showRenewalDialog, setShowRenewalDialog] = useState(false);
  const [availablePlans, setAvailablePlans] = useState<MembershipPlan[]>([]);
  const [gymDetails, setGymDetails] = useState<Gym | null>(null);
  const [isRenewing, setIsRenewing] = useState(false);

  // Fetch staff profile for theme
  useEffect(() => {
    if (!user.gymId) return;
    const unsub = onSnapshot(doc(db, 'users', user.gymId), (docSnap) => {
      if (docSnap.exists()) setStaffProfile({ uid: docSnap.id, ...docSnap.data() } as UserProfile);
    });
    return unsub;
  }, [user.gymId]);

  // Fetch Gym Plans for Renewal
  useEffect(() => {
    if (!user.gymId || !showRenewalDialog) return;
    const q = query(collection(db, `gyms/${user.gymId}/membershipPlans`), orderBy('price', 'asc'));
    return onSnapshot(q, (snapshot) => {
      setAvailablePlans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MembershipPlan)));
    });
  }, [user.gymId, showRenewalDialog]);

  // Fetch Gym Details for Payment Info
  useEffect(() => {
    if (!user.gymId) return;
    return onSnapshot(doc(db, 'gyms', user.gymId), (docSnap) => {
      if (docSnap.exists()) setGymDetails({ id: docSnap.id, ...docSnap.data() } as Gym);
    });
  }, [user.gymId]);

  // Apply Theme
  useEffect(() => {
    if (staffProfile?.gymConfig) {
      document.documentElement.style.setProperty('--primary', staffProfile.gymConfig.themeColor);
    }
    return () => {
      document.documentElement.style.setProperty('--primary', '#00FF00'); // Reset on unmount
    };
  }, [staffProfile]);

  useEffect(() => {
    if (!user.membershipExpiresAt) return;
    
    const checkExpiry = async () => {
      const now = Date.now();
      const expiry = user.membershipExpiresAt!;
      const dayInMs = 86400000;
      const diff = expiry - now;

      if (diff < 0) {
        setStatusMsg("⚠️ MEMBERSHIP EXPIRED! Please pay for renewal immediately.");
      } else if (diff < dayInMs) {
        if (!user.expiryNotified?.dayOf) {
          await addDoc(collection(db, 'broadcasts'), {
            gymId: user.gymId,
            message: `Your membership expires TODAY! Please renew to avoid interruption.`,
            timestamp: Date.now(),
            senderId: 'system',
            targetType: 'individual_member',
            targetId: user.id || user.uid
          });
          await updateDoc(doc(db, `gyms/${user.gymId}/members`, user.uid), {
            'expiryNotified.dayOf': true
          });
        }
      }
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 3600000); 
    return () => clearInterval(interval);
  }, [user.membershipExpiresAt, user.uid, user.id, user.gymId, user.expiryNotified]);

  useEffect(() => {
    if (!user.id && !user.uid) return;
    const q = query(
      collection(db, 'checkins'), 
      where('memberId', '==', user.id || user.uid),
      where('gymId', '==', user.gymId),
      limit(checkinsLimit)
    );
    return onSnapshot(q, 
      (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CheckIn));
        docs.sort((a, b) => b.timestamp - a.timestamp);
        setMyCheckins(docs);
        setHasMoreCheckins(snapshot.docs.length === checkinsLimit);
      },
      (error) => {
        console.error('My checkins snapshot error:', error);
      }
    );
  }, [user.id, user.uid, user.gymId, checkinsLimit]);

  const [broadcasts, setBroadcasts] = useState<any[]>([]);

  useEffect(() => {
    if (!user.gymId) return;
    const q = query(
      collection(db, 'broadcasts'), 
      where('gymId', '==', user.gymId),
      limit(50)
    );
    return onSnapshot(q, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Broadcast));
        data.sort((a, b) => b.timestamp - a.timestamp);
        const filtered = data.filter(b => 
          b.gymId === user.gymId && 
          (b.targetType === 'all_members' || (b.targetType === 'individual_member' && (b.targetId === user.id || b.targetId === user.uid)))
        );
        setBroadcasts(filtered.slice(0, 3));
      },
      (error) => {
        console.error('Member broadcasts error:', error);
      }
    );
  }, [user.id, user.uid, user.gymId]);

  const performCheckIn = async () => {
    try {
      setIsCheckingIn(true);
      const now = new Date();

      const gracePeriodMs = 1 * 24 * 60 * 60 * 1000;
      if (user.membershipExpiresAt && Date.now() > (user.membershipExpiresAt + gracePeriodMs)) {
        setStatusMsg('Subscription expired. Please renew.');
        setTimeout(() => setStatusMsg(null), 3000);
        return;
      }
      
      if (now.getDay() === 0) {
        setStatusMsg('Check-ins are closed on Sundays.');
        setTimeout(() => setStatusMsg(null), 3000);
        return;
      }

      const todayStr = now.toLocaleDateString('en-US');
      const alreadyCheckedIn = myCheckins.some(ci => {
        const ciDate = new Date(ci.timestamp).toLocaleDateString('en-US');
        return ciDate === todayStr;
      });

      if (alreadyCheckedIn) {
        setStatusMsg('You have already checked in today.');
        setTimeout(() => setStatusMsg(null), 3000);
        return;
      }

      const day = now.toLocaleDateString('en-US', { weekday: 'long' });
      const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      const checkInData = {
        memberId: user.id || user.uid,
        gymId: user.gymId || 'system',
        memberName: user.name,
        timestamp: Date.now(),
        day,
        time,
        status: user.autoApproveCheckin ? 'approved' : 'request' as const
      };

      await addDoc(collection(db, 'checkins'), checkInData);
      setStatusMsg(user.autoApproveCheckin ? 'Check-in successful!' : 'Check-in request sent to staff!');
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      console.error('Check-in failed:', err);
      setStatusMsg('Failed to check in.');
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleRenew = async (plan: MembershipPlan) => {
    if (!gymDetails?.paymentConfig) {
      setStatusMsg('Gym has not set up payments');
      setTimeout(() => setStatusMsg(null), 3000);
      return;
    }
    
    try {
      setIsRenewing(true);
      
      if (gymDetails.paymentConfig.type === 'upi' && gymDetails.paymentConfig.upiId) {
        setStatusMsg('Opening UPI Payment...');
        window.open(`upi://pay?pa=${gymDetails.paymentConfig.upiId}&pn=${gymDetails.name}&am=${plan.price}&cu=INR`, '_blank');
      }

      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const dayInMs = 24 * 60 * 60 * 1000;
      const baseDate = Math.max(Date.now(), user.membershipExpiresAt || 0);
      const newExpiry = baseDate + (plan.durationDays * dayInMs);
      
      const updateData = {
        membershipExpiresAt: newExpiry,
        membershipPlanId: plan.id,
        status: 'active',
        lastPaymentAt: Date.now(),
        lastPaymentAmount: plan.price
      };

      const memberId = user.id || user.uid;
      await updateDoc(doc(db, `gyms/${user.gymId}/members`, memberId), updateData);

      if (user.role !== UserRole.MEMBER || !user.uid.startsWith('mem_')) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            await updateDoc(userRef, updateData);
          }
        } catch (e) {
          console.warn('Optional users collection update skipped:', e);
        }
      }

      setShowRenewalDialog(false);
      setStatusMsg('Renewal successful!');
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      console.error('Renewal Error:', err);
      setStatusMsg('Renewal failed. Try again.');
    } finally {
      setIsRenewing(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-8 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-8">
        <div className="flex items-center gap-3 md:gap-4">
          {staffProfile?.gymConfig?.logoUrl ? (
            <img src={staffProfile.gymConfig.logoUrl} alt="Logo" className="w-10 h-10 md:w-16 md:h-16 rounded-xl object-cover border border-white/10" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-10 h-10 md:w-16 md:h-16 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center border border-[var(--primary)]/20">
              <Dumbbell className="w-5 h-5 md:w-8 md:h-8 text-[var(--primary)]" />
            </div>
          )}
          <div>
            <h1 className="text-xl md:text-4xl font-black uppercase italic tracking-tight leading-none">
              {staffProfile?.gymConfig?.name || 'My Fitness'}
            </h1>
            <div className="flex items-center gap-2 mt-1 md:mt-2">
              <span className="text-[7px] md:text-[10px] uppercase tracking-widest text-[var(--primary)] font-bold">Member Portal</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className="text-[7px] md:text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Welcome, {user.name}</span>
            </div>
          </div>
        </div>
        
        <div className="hidden md:flex items-center gap-3">
          {statusMsg && (
            <motion.span 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-xs font-bold text-[var(--primary)] bg-[var(--primary)]/10 px-3 py-1.5 rounded-full"
            >
              {statusMsg}
            </motion.span>
          )}
          <div className="flex gap-2">
            <Button 
              onClick={performCheckIn} 
              variant="primary" 
              loading={isCheckingIn} 
              icon={CheckCircle}
            >
              Check In Now
            </Button>
          </div>
        </div>

        <div className="md:hidden flex items-center justify-between bg-white/5 p-3 rounded-2xl border border-white/10">
          <div className="flex-1">
            {statusMsg ? (
              <p className="text-[10px] font-bold text-[var(--primary)] animate-pulse">{statusMsg}</p>
            ) : (
              <p className="text-[10px] text-[var(--text-muted)] font-medium">Ready for your workout?</p>
            )}
          </div>
          <Button 
            onClick={performCheckIn} 
            variant="primary" 
            loading={isCheckingIn} 
            icon={CheckCircle}
            className="h-10 px-6"
          >
            Check In
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-6">
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PWAInstallSection 
              canInstall={(window as any).deferredPrompt !== undefined || !!(window as any).PWA_CAN_INSTALL} 
              onInstall={() => (window as any).TRIGGER_PWA_INSTALL?.()} 
            />
            <NotificationPermissionSection />
          </div>
        )}
        
        {user.membershipExpiresAt && (
          <Card className={cn(
            "p-4 border-l-4",
            user.membershipExpiresAt < Date.now() ? "border-red-500 bg-red-500/5" : 
            user.membershipExpiresAt < Date.now() + 86400000 * 2 ? "border-yellow-500 bg-yellow-500/5" : "border-green-500 bg-green-500/5"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  user.membershipExpiresAt < Date.now() ? "bg-red-500/20 text-red-500" : "bg-[var(--primary)]/20 text-[var(--primary)]"
                )}>
                   <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Membership Status</h4>
                  <p className="text-xs opacity-70">
                    {user.membershipExpiresAt < Date.now() 
                      ? "Your membership has expired. Please renew to continue." 
                      : `Your membership expires on ${new Date(user.membershipExpiresAt).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
              {user.membershipExpiresAt < Date.now() && (
                <Button 
                  variant="danger" 
                  className="text-[10px] py-1.5 h-auto"
                  onClick={() => setShowRenewalDialog(true)}
                >
                  Renew Now
                </Button>
              )}
            </div>
          </Card>
        )}

        <Card className="p-4 border-[var(--secondary)]/20 bg-[var(--secondary)]/5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2 text-sm">
              <Dumbbell className="w-4 h-4 text-[var(--secondary)]" /> Workout Plans
            </h3>
            <Button 
              variant="ghost" 
              onClick={() => setActiveTab('workouts')}
              className="text-[10px] uppercase tracking-widest font-bold text-[var(--secondary)] hover:bg-[var(--secondary)]/10 py-1 h-auto"
            >
              View All
            </Button>
          </div>
          <p className="text-[10px] text-[var(--text-muted)] italic">
            Check your personalized workout plans and exercises.
          </p>
        </Card>

        {broadcasts.length > 0 && (
          <Card className="bg-[var(--primary)]/5 border-[var(--primary)]/20 p-4">
            <h3 className="font-bold flex items-center gap-2 mb-3 text-sm">
              <Megaphone className="w-4 h-4 text-[var(--primary)]" /> Announcements
            </h3>
            <div className="space-y-3">
              {broadcasts.map(b => (
                <div key={b.id} className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-xs">{b.message}</p>
                  <p className="text-[9px] text-[var(--text-muted)] mt-1">
                    {new Date(b.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {myCheckins.length > 0 && (
          <Card className="space-y-3 p-4">
            <h3 className="font-bold flex items-center gap-2 text-sm">
              <History className="w-4 h-4 text-[var(--secondary)]" /> My Check-in History
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {myCheckins.map(ci => (
                <div key={ci.id} className="p-2.5 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold">{ci.day}</p>
                    <p className="text-[9px] text-[var(--text-muted)]">{ci.time}</p>
                  </div>
                  <span className={cn(
                    "text-[8px] px-1.5 py-0.5 rounded-full uppercase font-bold",
                    ci.status === 'approved' ? "bg-green-500/20 text-green-500" : 
                    ci.status === 'rejected' ? "bg-red-500/20 text-red-500" : "bg-yellow-500/20 text-yellow-500"
                  )}>
                    {ci.status}
                  </span>
                </div>
              ))}
            </div>
            {hasMoreCheckins && myCheckins.length > 0 && (
              <div className="pt-2 flex justify-center">
                <Button 
                  variant="ghost" 
                  onClick={() => setCheckinsLimit(prev => prev + 20)} 
                  className="text-[8px] uppercase tracking-widest font-bold text-[var(--primary)] hover:bg-[var(--primary)]/10 py-1 h-auto"
                >
                  Load More
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>

      <Modal 
        isOpen={showRenewalDialog} 
        onClose={() => setShowRenewalDialog(false)} 
        title="Renew Membership"
      >
        <div className="space-y-6">
          <div className="p-4 bg-[var(--primary)]/10 rounded-xl border border-[var(--primary)]/20">
            <h4 className="text-[10px] uppercase font-bold tracking-widest text-[var(--primary)] mb-1">Direct Bank Transfer / UPI</h4>
            <p className="text-xs opacity-75 leading-relaxed">
              Payments go directly to the gym owner. Please ensure payment is confirmed by staff.
            </p>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {availablePlans.map(plan => (
              <button
                key={plan.id}
                onClick={() => handleRenew(plan)}
                disabled={isRenewing}
                className="w-full p-4 rounded-xl border border-white/10 bg-white/5 hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 transition-all text-left group"
              >
                <div className="flex justify-between items-center mb-1">
                  <h5 className="font-black italic uppercase tracking-tight group-hover:text-[var(--primary)]">{plan.name}</h5>
                  <span className="text-lg font-black italic text-[var(--primary)]">₹{plan.price}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest opacity-50">
                  <span>{plan.durationDays} Days</span>
                  <div className="flex items-center gap-1 group-hover:gap-2 transition-all">
                    Select Plan <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              </button>
            ))}
            {availablePlans.length === 0 && (
              <div className="py-8 text-center opacity-40">
                <CreditCard className="w-8 h-8 mx-auto mb-2" />
                <p className="text-[10px] uppercase tracking-widest font-bold">No active plans available</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-white/5">
            <p className="text-[9px] uppercase tracking-widest font-medium opacity-30 text-center">
              SECURE DIRECT PAYMENT PLATFORM
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
