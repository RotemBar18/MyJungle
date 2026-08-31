import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  writeBatch,
  deleteField,
} from 'firebase/firestore';
import { db } from '../firebase.js';

/**
 * A jungle is the unit of sharing: plants, history and photos all live under
 * one, and one or more people are members of it. A person can belong to several
 * (their own home, a partner's, a parent's) and switches between them.
 *
 *   jungles/{jid}                  name, ownerUid
 *   jungles/{jid}/members/{uid}    role, who they are     <- source of truth for access
 *   jungles/{jid}/plants/{pid}
 *   jungles/{jid}/events/{eid}
 *   invites/{code}                 jungleId + jungleName, unguessable doc id
 *   users/{uid}                    prefs, lastJungleId, jungles: { jid: {name, role} }
 *
 * Security rests on the members subcollection — every rule for plants, events
 * and photos asks "does jungles/{jid}/members/{me} exist?". The copy of the
 * jungle list on the user document is only a convenience index, never an
 * authority; entries the reader can no longer open are pruned on load.
 */

export const junglesCol = () => collection(db, 'jungles');
export const jungleDoc = (jid) => doc(db, 'jungles', jid);
export const membersCol = (jid) => collection(db, 'jungles', jid, 'members');
export const memberDoc = (jid, uid) => doc(db, 'jungles', jid, 'members', uid);
export const plantsCol = (jid) => collection(db, 'jungles', jid, 'plants');
export const eventsCol = (jid) => collection(db, 'jungles', jid, 'events');
export const inviteDoc = (code) => doc(db, 'invites', code);
export const userDoc = (uid) => doc(db, 'users', uid);

const personOf = (user) => ({
  uid: user.uid,
  email: user.email || null,
  displayName: user.displayName || null,
  photoURL: user.photoURL || null,
});

/** Unguessable, readable invite code (no look-alike characters). */
export function makeCode(len = 10) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

export async function createJungle(user, name) {
  const jid = doc(junglesCol()).id;
  // Deliberately sequential, not batched: the security rule for the owner's
  // membership document reads the jungle document, and rules see only state
  // already committed — inside one batch the jungle would not exist yet.
  await setDoc(jungleDoc(jid), {
    name: name || 'myJungle',
    ownerUid: user.uid,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await setDoc(memberDoc(jid, user.uid), {
    ...personOf(user),
    role: 'owner',
    joinedAt: new Date(),
  });
  await setDoc(
    userDoc(user.uid),
    { jungles: { [jid]: { name: name || 'myJungle', role: 'owner' } }, lastJungleId: jid },
    { merge: true },
  );
  return jid;
}

export async function renameJungle(jid, uid, name) {
  const batch = writeBatch(db);
  batch.update(jungleDoc(jid), { name, updatedAt: new Date() });
  batch.set(userDoc(uid), { jungles: { [jid]: { name } } }, { merge: true });
  await batch.commit();
}

export const setLastJungle = (uid, jid) => setDoc(userDoc(uid), { lastJungleId: jid }, { merge: true });

/* -------------------------------------------------------------- invitations */

export async function createInvite(jid, jungleName, user, days = 14) {
  const code = makeCode();
  await setDoc(inviteDoc(code), {
    jungleId: jid,
    jungleName,
    createdBy: user.uid,
    createdByName: user.displayName || user.email || null,
    role: 'member',
    active: true,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + days * 86400000),
  });
  return code;
}

export const revokeInvite = (code) => deleteDoc(inviteDoc(code));

export async function readInvite(code) {
  const snap = await getDoc(inviteDoc(code.trim().toUpperCase()));
  if (!snap.exists()) return { error: 'notFound' };
  const data = snap.data();
  if (data.active === false) return { error: 'revoked' };
  const exp = data.expiresAt?.toDate?.() || (data.expiresAt ? new Date(data.expiresAt) : null);
  if (exp && exp < new Date()) return { error: 'expired' };
  return { code: snap.id, ...data };
}

/** Joining writes only the joiner's own membership document. */
export async function joinJungle(code, user) {
  const invite = await readInvite(code);
  if (invite.error) return invite;
  const jid = invite.jungleId;

  const existing = await getDoc(memberDoc(jid, user.uid));
  if (!existing.exists()) {
    await setDoc(memberDoc(jid, user.uid), {
      ...personOf(user),
      role: 'member',
      joinedAt: new Date(),
      inviteCode: invite.code,
    });
  }
  await setDoc(
    userDoc(user.uid),
    {
      jungles: { [jid]: { name: invite.jungleName || 'myJungle', role: 'member' } },
      lastJungleId: jid,
    },
    { merge: true },
  );
  return { jungleId: jid, name: invite.jungleName };
}

export async function leaveJungle(jid, uid) {
  await deleteDoc(memberDoc(jid, uid));
  await updateDoc(userDoc(uid), { [`jungles.${jid}`]: deleteField() });
}

export const removeMember = (jid, uid) => deleteDoc(memberDoc(jid, uid));
