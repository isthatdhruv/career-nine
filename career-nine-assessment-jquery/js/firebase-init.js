// Career-9 Assessment - Firebase Initialization
let db = null;

(function initFirebase() {
  try {
    const app = firebase.initializeApp(AppConfig.FIREBASE);
    db = firebase.firestore(app);
  } catch (e) {
    console.error('Firebase init failed:', e);
  }
})();

// Save animal reaction game data to Firestore
async function firebaseSaveAnimalReaction(data, userStudentId) {
  const docId = userStudentId || localStorage.getItem('userStudentId');
  if (!docId) { console.error('Cannot save: no userStudentId'); return; }
  try {
    await db.collection('game_results').doc(String(docId)).set({
      userStudentId: String(docId),
      animal_reaction: { ...data, timestamp: new Date().toISOString() },
      lastUpdated: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.error('Failed to save Animal Reaction:', e);
    throw e;
  }
}

// Save rabbit path game data to Firestore
async function firebaseSaveRabbitPath(data, userStudentId) {
  const docId = userStudentId || localStorage.getItem('userStudentId');
  if (!docId) { console.error('Cannot save: no userStudentId'); return; }
  try {
    await db.collection('game_results').doc(String(docId)).set({
      userStudentId: String(docId),
      rabbit_path: { ...data, timestamp: new Date().toISOString() },
      lastUpdated: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.error('Failed to save Rabbit Path:', e);
    throw e;
  }
}

// Save hydro tube game data to Firestore
async function firebaseSaveHydroTube(data, userStudentId) {
  const docId = userStudentId || localStorage.getItem('userStudentId');
  if (!docId) { console.error('Cannot save: no userStudentId'); return; }
  try {
    await db.collection('game_results').doc(String(docId)).set({
      userStudentId: String(docId),
      hydro_tube: { ...data, timestamp: new Date().toISOString() },
      lastUpdated: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.error('Failed to save Hydro Tube:', e);
    throw e;
  }
}
