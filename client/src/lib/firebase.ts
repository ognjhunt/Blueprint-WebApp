// Placeholder file for Firebase configuration
// Firebase integration has been removed as per requirements
const dummyAuth = {
  currentUser: null,
  onAuthStateChanged: () => () => {},
  signInWithEmailAndPassword: async () => {},
  createUserWithEmailAndPassword: async () => {},
  signInWithPopup: async () => {},
  signOut: async () => {},
};

const dummyDb = {};

export const auth = dummyAuth;
export const db = dummyDb;
export default { auth: dummyAuth, db: dummyDb };
