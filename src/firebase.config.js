/**
 * Firebase project identifiers.
 *
 * These are deliberately committed. A Firebase web config is not a credential —
 * it names the project, the way a URL does, and it is inlined into the JavaScript
 * bundle of every Firebase web app, so it is readable by anyone who opens the
 * deployed site regardless of where it is stored. Keeping it in an environment
 * variable would hide it from nobody and would mean every deploy target needed
 * hand-configuring before the app could start.
 *
 * What actually protects the data is `firestore.rules` and `storage.rules`:
 * without a signed-in account holding a membership document in a jungle, this
 * config gets you nothing. See ARCHITECTURE.md §9.
 *
 * To point a fork at a different project, either edit this file or set the
 * matching `VITE_FB_*` environment variables, which take precedence.
 */
export default {
  apiKey: 'AIzaSyDpnjMAEit0DeDLi_gCFKUs0aMjuDAO13c',
  authDomain: 'myjungle-68907.firebaseapp.com',
  projectId: 'myjungle-68907',
  storageBucket: 'myjungle-68907.firebasestorage.app',
  messagingSenderId: '1027694915924',
  appId: '1:1027694915924:web:1c49fee28ea10428cb98c1',
};
