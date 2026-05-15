import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin configuration
let firebaseProjectId = process.env.VITE_FIREBASE_PROJECT_ID;
let firebaseApiKey = process.env.VITE_FIREBASE_API_KEY;

try {
  // Use dynamic import to handle optional file
  const { default: config } = await import("./firebase-applet-config.json", { assert: { type: "json" } });
  firebaseProjectId = firebaseProjectId || config.projectId;
  firebaseApiKey = firebaseApiKey || config.apiKey;
} catch (e) {
  console.log("Note: firebase-applet-config.json not found or could not be loaded. Relying on ENVs.");
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  
  if (serviceAccount) {
    try {
      const parsedAccount = JSON.parse(serviceAccount);
      admin.initializeApp({
        credential: admin.credential.cert(parsedAccount),
        projectId: firebaseProjectId,
      });
      console.log("Firebase Admin initialized with Service Account");
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT ENV, falling back to basic init");
      admin.initializeApp({
        projectId: firebaseProjectId,
      });
    }
  } else {
    admin.initializeApp({
      projectId: firebaseProjectId,
    });
    console.log("Firebase Admin initialized with Project ID only");
  }
}

const auth = admin.auth();

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  app.use(cors());
  app.use(express.json());

  // Bulk User Creation Endpoint
  app.post("/api/staff/bulk-create-users", async (req, res) => {
    const { users } = req.body;
    if (!Array.isArray(users)) {
      return res.status(400).json({ error: "Users array is required" });
    }

    const results = {
      successful: [] as any[],
      failed: [] as any[],
    };

    // Process in chunks to avoid overwhelming the API
    const CHUNK_SIZE = 10;
    const getValidPassword = (pwd?: string) => {
      if (!pwd || pwd.length < 6) {
        // Generate a random 10-character alphanumeric password
        return Math.random().toString(36).slice(2, 12);
      }
      return pwd;
    };

    for (let i = 0; i < users.length; i += CHUNK_SIZE) {
      const chunk = users.slice(i, i + CHUNK_SIZE);
      const chunkPromises = chunk.map(async (user: any) => {
        try {
          if (!user.email) {
            return { name: user.name, phone: user.phone, status: 'success', noAuth: true };
          }

          let uid: string | null = null;
          const userPassword = getValidPassword(user.password);

          // Try Admin SDK first
          try {
            const userRecord = await auth.getUserByEmail(user.email);
            uid = userRecord.uid;
          } catch (e: any) {
            // If Admin SDK fails due to API disabled, or user not found, try REST API or Create
            if (e.code === 'auth/user-not-found') {
              // Proceed to create
            } else if (e.code === 'auth/project-not-found' || e.message.includes('Identity Toolkit API') || e.code === 'auth/internal-error') {
              // Try REST API Lookup
              try {
                const lookupResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: [user.email] })
                });
                const lookupData: any = await lookupResponse.json();
                if (lookupData.users && lookupData.users.length > 0) {
                  uid = lookupData.users[0].localId;
                }
              } catch (restErr) {
                console.error("REST Lookup failed:", restErr);
              }
            } else {
              throw e;
            }
          }

          // If user still not found, create them
          if (!uid) {
            try {
              const createParams: any = {
                email: user.email,
                displayName: user.name,
                password: userPassword,
              };
              if (user.phone) {
                createParams.phoneNumber = user.phone;
              }
              const userRecord = await auth.createUser(createParams);
              uid = userRecord.uid;
            } catch (e: any) {
              // Fallback to REST API Create (signUp)
              if (e.code === 'auth/project-not-found' || e.message.includes('Identity Toolkit API') || e.code === 'auth/internal-error' || e.code === 'auth/operation-not-allowed') {
                const signUpResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseApiKey}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email: user.email,
                    password: userPassword,
                    displayName: user.name,
                    returnSecureToken: true
                  })
                });
                const signUpData: any = await signUpResponse.json();
                
                if (signUpData.error) {
                  if (signUpData.error.message === "EMAIL_EXISTS") {
                    // Try lookup one last time to get UID
                    const finalLookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email: [user.email] })
                    });
                    const finalData: any = await finalLookup.json();
                    if (finalData.users && finalData.users.length > 0) {
                      uid = finalData.users[0].localId;
                    } else {
                      throw new Error(signUpData.error.message);
                    }
                  } else if (signUpData.error.message === "OPERATION_NOT_ALLOWED") {
                    throw new Error("EMAIL_PASSWORD_DISABLED");
                  } else {
                    throw new Error(signUpData.error.message);
                  }
                } else {
                  uid = signUpData.localId;
                }
              } else {
                throw e;
              }
            }
          }

          return { email: user.email, uid, status: 'success' };
        } catch (error: any) {
          console.error("Bulk create error for user:", user.email, error.code, error.message);
          let errorMessage = error.message;
          let isApiDisabled = false;
          let apiLink = `https://console.cloud.google.com/apis/library/identitytoolkit.googleapis.com?project=${firebaseProjectId}`;
          
          if (error.message === "IDENTITY_TOOLKIT_API_DISABLED" || error.message.includes('Identity Toolkit API') || error.message.includes('SERVICE_DISABLED')) {
            const projectMatch = error.message.match(/project\s+([a-z0-9-]+)/i) || 
                               error.message.match(/projects\/([a-z0-9-]+)/i) ||
                               (error.message.includes('153469865892') ? [null, '153469865892'] : null);
            
            const projectId = projectMatch ? projectMatch[1] : firebaseProjectId;
            
            errorMessage = `Firebase Authentication API (Identity Toolkit) is not enabled for project '${projectId}'. Please enable it to allow user creation.`;
            isApiDisabled = true;
            apiLink = `https://console.cloud.google.com/apis/library/identitytoolkit.googleapis.com?project=${projectId}`;
          } else if (error.message === "EMAIL_PASSWORD_DISABLED" || error.code === 'auth/operation-not-allowed') {
            errorMessage = "Email/Password sign-in is not enabled in your Firebase Console. Please go to Authentication > Sign-in method and enable 'Email/Password'.";
            apiLink = `https://console.firebase.google.com/project/${firebaseProjectId}/authentication/providers`;
          }
          
          return { 
            email: user.email || user.phone || user.name, 
            error: errorMessage, 
            status: 'failed',
            isApiDisabled,
            apiLink
          };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      chunkResults.forEach(res => {
        if (res.status === 'success') results.successful.push(res);
        else results.failed.push(res);
      });
    }

    res.json(results);
  });

  // Cleanup Users Endpoint (Admin only)
  app.post("/api/admin/cleanup-users", async (req, res) => {
    const { superAdminEmail } = req.body;
    if (!superAdminEmail) {
      return res.status(400).json({ error: "Super admin email is required" });
    }

    // Ensure only the authorized super admin can trigger cleanup
    if (superAdminEmail !== "dangbruh010@gmail.com") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    try {
      const listUsersResult = await auth.listUsers();
      const authUsersToDelete = listUsersResult.users.filter(user => user.email !== superAdminEmail);
      
      const firestore = admin.firestore();
      const batch = firestore.batch();
      
      // Delete from Auth
      const authDeletePromises = authUsersToDelete.map(user => auth.deleteUser(user.uid));
      await Promise.all(authDeletePromises);

      // Delete from Firestore 'users' collection (all except super admin)
      const usersSnapshot = await firestore.collection('users').get();
      let deletedCount = 0;
      
      for (const doc of usersSnapshot.docs) {
        const userData = doc.data();
        if (userData.email !== superAdminEmail) {
          batch.delete(doc.ref);
          deletedCount++;
        }
      }

      // Also cleanup nested members in gyms if any
      const gymsSnapshot = await firestore.collection('gyms').get();
      for (const gymDoc of gymsSnapshot.docs) {
        const membersSnapshot = await firestore.collection(`gyms/${gymDoc.id}/members`).get();
        for (const memberDoc of membersSnapshot.docs) {
          batch.delete(memberDoc.ref);
          deletedCount++;
        }
      }

      await batch.commit();

      res.json({ 
        message: `Successfully deleted ${deletedCount} user records from Firestore and ${authUsersToDelete.length} users from Auth.`,
        deletedCount: deletedCount
      });
    } catch (error: any) {
      console.error("Error cleaning up users:", error);
      let errorMessage = error.message;
      if (error.message.includes('Identity Toolkit API')) {
        errorMessage = "Firebase Authentication API is not enabled. Please enable the 'Identity Toolkit API' in your Google Cloud Console.";
      }
      res.status(500).json({ error: errorMessage });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
