import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { 
  onAuthStateChanged, 
  signOut, 
  signInAnonymously, 
  setPersistence, 
  browserLocalPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, collectionGroup, getDocFromServer, deleteDoc } from 'firebase/firestore';
import { UserRole, UserProfile, Gym } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const normalizePhone = (phone: string): string => {
  if (!phone) return '';
  let cleaned = phone.trim();
  const digits = cleaned.replace(/\D/g, '');
  
  if (cleaned.startsWith('+')) {
    return '+' + digits;
  }
  
  let finalDigits = digits;
  if (digits.length === 11 && digits.startsWith('0')) {
    finalDigits = digits.substring(1);
  }
  
  if (finalDigits.length === 10) {
    return '+91' + finalDigits;
  }
  
  return digits ? '+' + digits : '';
};

// Global registry helpers to avoid collectionGroup index errors
export const updateRegistry = async (type: 'phone' | 'uid', key: string, data: { gymId: string, memberId: string, role: string, uid?: string }) => {
  const sanitizedKey = key.replace(/[.#$[\]]/g, '_'); // Firestore doc ID safety
  await setDoc(doc(db, 'registries', `${type}_${sanitizedKey}`), data, { merge: true });
};

export const deleteFromRegistry = async (type: 'phone' | 'uid', key: string) => {
  const sanitizedKey = key.replace(/[.#$[\]]/g, '_');
  await deleteDoc(doc(db, 'registries', `${type}_${sanitizedKey}`));
};

export const getFromRegistry = async (type: 'phone' | 'uid', key: string) => {
  const sanitizedKey = key.replace(/[.#$[\]]/g, '_');
  const d = await getDoc(doc(db, 'registries', `${type}_${sanitizedKey}`));
  return d.exists() ? d.data() : null;
};

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(console.error);

    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // If anonymous, skip users collection and check sessions
          if (firebaseUser.isAnonymous) {
            let sessionDoc;
            try {
              sessionDoc = await getDoc(doc(db, 'sessions', firebaseUser.uid));
            } catch (err) {
              handleFirestoreError(err, OperationType.GET, `sessions/${firebaseUser.uid}`);
            }

            if (sessionDoc && sessionDoc.exists()) {
              const sessionData = sessionDoc.data();
              const memberPath = `gyms/${sessionData.gymId}/members/${sessionData.memberId}`;
              let memberDoc;
              try {
                memberDoc = await getDoc(doc(db, memberPath));
              } catch (err) {
                handleFirestoreError(err, OperationType.GET, memberPath);
              }

              if (memberDoc && memberDoc.exists()) {
                const memberData = memberDoc.data() as UserProfile;
                const normalizedRole = memberData.role?.toString().toUpperCase() as UserRole;
                setUser({ uid: firebaseUser.uid, ...memberData, role: normalizedRole } as UserProfile);
              }
            }
            setLoading(false);
            return;
          }

          // Try to fetch profile from users collection (for Staff)
          let userDoc;
          try {
            userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          } catch (err) {
            handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
          }

          if (userDoc && userDoc.exists()) {
            const userData = userDoc.data() as UserProfile;
            const normalizedRole = userData.role?.toString().toUpperCase() as UserRole;
            setUser({ uid: firebaseUser.uid, ...userData, role: normalizedRole } as UserProfile);
          } else {
            // Check if it's a linked member session (for non-anonymous users who might be members)
            let sessionDoc;
            try {
              sessionDoc = await getDoc(doc(db, 'sessions', firebaseUser.uid));
            } catch (err) {
              handleFirestoreError(err, OperationType.GET, `sessions/${firebaseUser.uid}`);
            }

            if (sessionDoc && sessionDoc.exists()) {
              const sessionData = sessionDoc.data();
              const memberPath = `gyms/${sessionData.gymId}/members/${sessionData.memberId}`;
              let memberDoc;
              try {
                memberDoc = await getDoc(doc(db, memberPath));
              } catch (err) {
                handleFirestoreError(err, OperationType.GET, memberPath);
              }

              if (memberDoc && memberDoc.exists()) {
                const memberData = memberDoc.data() as UserProfile;
                const normalizedRole = memberData.role?.toString().toUpperCase() as UserRole;
                setUser({ uid: firebaseUser.uid, ...memberData, role: normalizedRole } as UserProfile);
              }
            } else {
              // Check global registry (Faster, no index needed)
              const registryData = await getFromRegistry('uid', firebaseUser.uid) as any;
              if (registryData) {
                const memberPath = `gyms/${registryData.gymId}/members/${registryData.memberId}`;
                const memberDoc = await getDoc(doc(db, memberPath));
                if (memberDoc.exists()) {
                  const memberData = memberDoc.data() as UserProfile;
                  const normalizedRole = memberData.role?.toString().toUpperCase() as UserRole;
                  setUser({ uid: firebaseUser.uid, ...memberData, role: normalizedRole, id: memberDoc.id });
                  return;
                }
              }

              // Final fallback for legacy data (May still hit index error until registry is populated)
              try {
                const membersQuery = query(collectionGroup(db, 'members'), where('uid', '==', firebaseUser.uid));
                const membersSnapshot = await getDocs(membersQuery);
                if (!membersSnapshot.empty) {
                  const memberDoc = membersSnapshot.docs[0];
                  const memberData = memberDoc.data() as UserProfile;
                  const gymId = memberData.gymId || memberDoc.ref.parent.parent?.id;
                  if (gymId) {
                    const normalizedRole = memberData.role?.toString().toUpperCase() as UserRole;
                    // Auto-migrate to registry
                    await updateRegistry('uid', firebaseUser.uid, { gymId, memberId: memberDoc.id, role: normalizedRole });
                    setUser({ uid: firebaseUser.uid, ...memberData, role: normalizedRole, id: memberDoc.id });
                  }
                }
              } catch (cgErr) {
                console.warn("Legacy lookup failed (missing index):", cgErr);
              }
            }
          }
        } catch (err) {
          console.error("Auth profile fetch failed:", err);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
  }, []);

  const login = async (email: string, pass: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, pass);
      
      // Check users collection first (Staff/SuperAdmin)
      let userDoc;
      try {
        userDoc = await getDoc(doc(db, 'users', result.user.uid));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${result.user.uid}`);
      }
      
      if (userDoc && userDoc.exists()) {
        const userData = userDoc.data() as UserProfile;
        const normalizedRole = userData.role?.toString().toUpperCase() as UserRole;
        setUser({ uid: result.user.uid, ...userData, role: normalizedRole });
        return null;
      }

      // Check global registry (Faster, no index needed)
      const registryData = await getFromRegistry('uid', result.user.uid) as any;
      if (registryData) {
        const memberDoc = await getDoc(doc(db, `gyms/${registryData.gymId}/members/${registryData.memberId}`));
        if (memberDoc.exists()) {
          const memberData = memberDoc.data() as UserProfile;
          const normalizedRole = memberData.role?.toString().toUpperCase() as UserRole;
          setUser({ uid: result.user.uid, ...memberData, role: normalizedRole, id: memberDoc.id });
          return null;
        }
      }

      // Check if they are a member (Search across all gyms by UID)
      try {
        const membersQuery = query(collectionGroup(db, 'members'), where('uid', '==', result.user.uid));
        const membersSnapshot = await getDocs(membersQuery);

        if (!membersSnapshot.empty) {
          const memberDoc = membersSnapshot.docs[0];
          const memberData = memberDoc.data() as UserProfile;
          const gymId = memberData.gymId || memberDoc.ref.parent.parent?.id;

          if (gymId) {
            const normalizedRole = memberData.role?.toString().toUpperCase() as UserRole;
            // Create registry entries
            await updateRegistry('uid', result.user.uid, { gymId, memberId: memberDoc.id, role: normalizedRole });
            if (memberData.phone) {
              await updateRegistry('phone', memberData.phone, { gymId, memberId: memberDoc.id, role: normalizedRole, uid: result.user.uid });
            }
            // Create session if it doesn't exist
            await setDoc(doc(db, 'sessions', result.user.uid), {
              gymId,
              memberId: memberDoc.id,
              role: normalizedRole,
              createdAt: Date.now()
            });
            setUser({ uid: result.user.uid, ...memberData, role: normalizedRole, id: memberDoc.id });
            return null;
          }
        }
      } catch (cgErr) {
        console.warn("Legacy lookup failed (missing index):", cgErr);
      }

      // Auto-bootstrap super admin if email matches
      if (email === "dangbruh010@gmail.com") {
        const superProfile: UserProfile = {
          uid: result.user.uid,
          name: "Adhithyan",
          email: email,
          role: UserRole.SUPER_STAFF,
          gymId: 'system',
          status: 'active',
          createdAt: Date.now()
        };
        await setDoc(doc(db, 'users', result.user.uid), superProfile);
        setUser(superProfile);
        return null;
      }

      return "Profile not found.";
    } catch (error: any) {
      return error.message;
    }
  };

  const loginMember = async (phone: string) => {
    try {
      const normalizedPhone = normalizePhone(phone);
      if (!normalizedPhone) return "Please enter a valid phone number.";

      // 0. Sign in anonymously FIRST to satisfy security rules for collectionGroup query
      let firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        const result = await signInAnonymously(auth);
        firebaseUser = result.user;
      }

      // 1. Try Registry First (Fast, no index needed)
      const registryData = await getFromRegistry('phone', normalizedPhone) as any;
      if (registryData) {
        const memberDoc = await getDoc(doc(db, `gyms/${registryData.gymId}/members/${registryData.memberId}`));
        if (memberDoc.exists()) {
          const memberData = memberDoc.data() as UserProfile;
          await setDoc(doc(db, 'sessions', firebaseUser.uid), {
            gymId: registryData.gymId,
            memberId: registryData.memberId,
            role: UserRole.MEMBER,
            createdAt: Date.now()
          });
          // Also link UID in registry
          await updateRegistry('uid', firebaseUser.uid, { gymId: registryData.gymId, memberId: registryData.memberId, role: UserRole.MEMBER });
          
          setUser({ uid: firebaseUser.uid, ...memberData, role: UserRole.MEMBER, id: memberDoc.id });
          return null;
        }
      }

      // 2. Legacy Fallback: Find the member by phone number across all gyms
      try {
        const membersQuery = query(collectionGroup(db, 'members'), where('phone', '==', normalizedPhone));
        let querySnapshot = await getDocs(membersQuery);
        
        if (querySnapshot.empty) {
          // 3. Try searching in users collection (for Staff/Owners)
          const usersQuery = query(collection(db, 'users'), where('phone', '==', normalizedPhone));
          querySnapshot = await getDocs(usersQuery);
        }
        
        if (querySnapshot.empty) {
          // CLEANUP: If member not found, sign out the anonymous user to avoid orphaned accounts
          await signOut(auth);
          setUser(null);
          return "No account found with this phone number.";
        }

        // Take the first matching member
        const memberDoc = querySnapshot.docs[0];
        const memberData = memberDoc.data() as UserProfile;
        const gymId = memberData.gymId || memberDoc.ref.parent.parent?.id;

        if (!gymId) {
          return "Gym association not found for this account.";
        }

        if (memberData.status && memberData.status !== 'active') {
          return `Account is ${memberData.status}.`;
        }
        
        // Auto-migrate to registry
        await updateRegistry('phone', normalizedPhone, { gymId, memberId: memberDoc.id, role: UserRole.MEMBER });
        await updateRegistry('uid', firebaseUser.uid, { gymId, memberId: memberDoc.id, role: UserRole.MEMBER });

        // 3. Create a session mapping
        const sessionPath = `sessions/${firebaseUser.uid}`;
        try {
          await setDoc(doc(db, 'sessions', firebaseUser.uid), {
            gymId,
            memberId: memberDoc.id,
            role: UserRole.MEMBER,
            createdAt: Date.now()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, sessionPath);
        }

        setUser({ uid: firebaseUser.uid, ...memberData, role: UserRole.MEMBER, id: memberDoc.id });
        return null;
      } catch (cgErr: any) {
        if (cgErr.message.includes('requires an index')) {
          return "Login failed (System indexing required). Please ask staff to update your profile to fix this.";
        }
        throw cgErr;
      }
    } catch (error: any) {
      if (error.message.includes('requires an index')) {
        return "System indexing in progress. Please try again in a few minutes.";
      }
      return error.message;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const registerGym = async (email: string, pass: string, gymName: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, pass);
      const gymId = gymName.toLowerCase().replace(/\s+/g, '-');
      
      const gymData: Gym = {
        id: gymId,
        name: gymName,
        slug: gymId,
        themeColor: '#00FF00',
        active: true,
        memberCount: 0,
        capacity: 100,
        currentOccupancy: 0,
        ownerId: result.user.uid,
        createdAt: Date.now()
      };

      const staffProfile: UserProfile = {
        uid: result.user.uid,
        id: 'staff',
        name: 'Gym Staff',
        email: email,
        role: UserRole.GYM_STAFF,
        gymId: gymId,
        status: 'active',
        createdAt: Date.now(),
        gymConfig: {
          name: gymName,
          themeColor: '#00FF00'
        }
      };

      await setDoc(doc(db, 'users', result.user.uid), staffProfile);
      await setDoc(doc(db, 'gyms', gymId), gymData);
      
      setUser(staffProfile);
      return null;
    } catch (error: any) {
      return error.message;
    }
  };

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      // Use the provided client ID if needed, though Firebase usually handles this in the console.
      // Setting it explicitly can help in some environments.
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      const result = await signInWithPopup(auth, provider);
      
      // Check users collection first (Staff/SuperAdmin)
      let userDoc;
      try {
        userDoc = await getDoc(doc(db, 'users', result.user.uid));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${result.user.uid}`);
      }
      
      if (userDoc && userDoc.exists()) {
        const userData = userDoc.data() as UserProfile;
        const normalizedRole = userData.role?.toString().toUpperCase() as UserRole;
        setUser({ uid: result.user.uid, ...userData, role: normalizedRole });
        return null;
      }

      // Check global registry (Faster, no index needed)
      const registryData = await getFromRegistry('uid', result.user.uid) as any;
      if (registryData) {
        const memberDoc = await getDoc(doc(db, `gyms/${registryData.gymId}/members/${registryData.memberId}`));
        if (memberDoc.exists()) {
          const memberData = memberDoc.data() as UserProfile;
          const normalizedRole = memberData.role?.toString().toUpperCase() as UserRole;
          setUser({ uid: result.user.uid, ...memberData, role: normalizedRole, id: memberDoc.id });
          return null;
        }
      }

      // Check if they are a member (Search across all gyms by UID)
      try {
        const membersQuery = query(collectionGroup(db, 'members'), where('uid', '==', result.user.uid));
        const membersSnapshot = await getDocs(membersQuery);

        if (!membersSnapshot.empty) {
          const memberDoc = membersSnapshot.docs[0];
          const memberData = memberDoc.data() as UserProfile;
          const gymId = memberData.gymId || memberDoc.ref.parent.parent?.id;

          if (gymId) {
            const normalizedRole = memberData.role?.toString().toUpperCase() as UserRole;
            // Create registry entries
            await updateRegistry('uid', result.user.uid, { gymId, memberId: memberDoc.id, role: normalizedRole });
            if (memberData.phone) {
              await updateRegistry('phone', memberData.phone, { gymId, memberId: memberDoc.id, role: normalizedRole, uid: result.user.uid });
            }
            // Create session if it doesn't exist
            await setDoc(doc(db, 'sessions', result.user.uid), {
              gymId,
              memberId: memberDoc.id,
              role: normalizedRole,
              createdAt: Date.now()
            });
            setUser({ uid: result.user.uid, ...memberData, role: normalizedRole, id: memberDoc.id });
            return null;
          }
        }
      } catch (cgErr) {
        console.warn("Legacy lookup failed (missing index):", cgErr);
      }

      // Auto-bootstrap super admin if email matches
      if (result.user.email === "dangbruh010@gmail.com") {
        const superProfile: UserProfile = {
          uid: result.user.uid,
          name: result.user.displayName || "Adhithyan",
          email: result.user.email,
          role: UserRole.SUPER_STAFF,
          gymId: 'system',
          status: 'active',
          createdAt: Date.now()
        };
        await setDoc(doc(db, 'users', result.user.uid), superProfile);
        setUser(superProfile);
        return null;
      }

      // If not a staff member, we might want to check if they are a member
      // but usually Google Login is for Portal Access (Staff/Admin)
      return "Profile not found. Please contact your gym administrator.";
    } catch (error: any) {
      return error.message;
    }
  };

  return { user, loading, login, loginMember, loginWithGoogle, registerGym, logout };
}
