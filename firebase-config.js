// Firebase config and shared Firestore helpers (CDN, ESM)
// 1) Replace the placeholder config with your Firebase project's credentials
// 2) Use functions below from pages with: import { addCategory, addProduct, fetchCategories, fetchLatestProducts, fetchProductsByCategory } from './firebase-config.js'

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAnalytics, isSupported as analyticsIsSupported } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Project config (provided by user)
const firebaseConfig = {
  apiKey: "AIzaSyCPeW-2K-9j8JrtqLkgGALrnljHaY7OMjA",
  authDomain: "shreeramelectronics-55add.firebaseapp.com",
  projectId: "shreeramelectronics-55add",
  storageBucket: "shreeramelectronics-55add.firebasestorage.app",
  messagingSenderId: "122107318683",
  appId: "1:122107318683:web:58b672e46607d3917c913e",
  measurementId: "G-YFFZH6Y723"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export let analytics = null;
export const auth = getAuth(app);

// Admin UID (provided by user)
export const ADMIN_UID = 'k3fh6cMV94Ya1f8S4ooLFI5UIXF3';
export function isAdminUser(user) {
  return !!(user && user.uid === ADMIN_UID);
}
try {
  const supported = await analyticsIsSupported();
  if (supported) {
    analytics = getAnalytics(app);
  }
} catch (e) {
  // Analytics not supported in this environment; ignore
}

// Auth helpers
export function observeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function registerWithEmailPassword(email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  // Create user doc
  await setDoc(doc(db, 'users', cred.user.uid), { email: email, createdAt: serverTimestamp() }, { merge: true });
  return cred.user;
}

export async function loginWithEmailPassword(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logout() {
  await signOut(auth);
}

// Per-user cart/wishlist paths
function cartItemRef(uid, productName) {
  return doc(db, 'users', uid, 'cart', productName);
}
function wishlistItemRef(uid, productName) {
  return doc(db, 'users', uid, 'wishlist', productName);
}

export async function addToUserCart(user, product) {
  if (!user) throw new Error('AUTH_REQUIRED');
  const ref = cartItemRef(user.uid, product.name);
  const snap = await getDoc(ref);
  const qty = snap.exists() ? (snap.data().qty || 1) + 1 : 1;
  await setDoc(ref, { name: product.name, price: Number(product.price) || 0, image: product.image || '', qty: qty, updatedAt: serverTimestamp() }, { merge: true });
}

export async function addToUserWishlist(user, product) {
  if (!user) throw new Error('AUTH_REQUIRED');
  const ref = wishlistItemRef(user.uid, product.name);
  await setDoc(ref, { name: product.name, price: Number(product.price) || 0, image: product.image || '', createdAt: serverTimestamp() }, { merge: true });
}

export async function fetchUserCart(user) {
  if (!user) return [];
  const snap = await getDocs(collection(db, 'users', user.uid, 'cart'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function fetchUserWishlist(user) {
  if (!user) return [];
  const snap = await getDocs(collection(db, 'users', user.uid, 'wishlist'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateUserCartQty(user, productName, qty) {
  if (!user) throw new Error('AUTH_REQUIRED');
  const ref = cartItemRef(user.uid, productName);
  if (qty <= 0) { await deleteDoc(ref); return; }
  await updateDoc(ref, { qty: qty, updatedAt: serverTimestamp() });
}

export async function removeUserCartItem(user, productName) {
  if (!user) throw new Error('AUTH_REQUIRED');
  await deleteDoc(cartItemRef(user.uid, productName));
}

export async function moveWishlistItemToCart(user, productName) {
  if (!user) throw new Error('AUTH_REQUIRED');
  const wRef = wishlistItemRef(user.uid, productName);
  const wSnap = await getDoc(wRef);
  if (wSnap.exists()) {
    await addToUserCart(user, wSnap.data());
    await deleteDoc(wRef);
  }
}

// Category APIs
export async function addCategory(category) {
  // category: { name, image }
  if(!category || !category.name) return;
  await addDoc(collection(db, 'categories'), {
    name: category.name,
    image: category.image || 'https://via.placeholder.com/150',
    createdAt: serverTimestamp()
  });
}

export async function fetchCategories() {
  const q = query(collection(db, 'categories'), orderBy('name'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Product APIs
export async function addProduct(product) {
  // product: { name, description, price, availableQty, category, image }
  if(!product || !product.name || !product.category) return;
  await addDoc(collection(db, 'products'), {
    name: product.name,
    description: product.description || '',
    price: Number(product.price) || 0,
    availableQty: Number(product.availableQty) || 0,
    category: product.category,
    image: product.image || 'https://via.placeholder.com/150',
    createdAt: serverTimestamp()
  });
}

export async function fetchLatestProducts(maxItems = 6) {
  try {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'), limit(maxItems));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(err){
    // Fallback if createdAt missing: just return all and slice
    const snap = await getDocs(collection(db, 'products'));
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return all.slice(-maxItems).reverse();
  }
}

export async function fetchProductsByCategory(categoryName) {
  const q = query(collection(db, 'products'), where('category', '==', categoryName));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}


