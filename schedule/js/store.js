// 保存層の抽象化。
// - Firebase 設定があれば FirebaseStore（Firestore リアルタイム同期 + Google ログイン）
// - なければ LocalStore（localStorage・ログイン不要・この端末のみ）
// どちらも同じインターフェイスを提供し、UI 側は保存先を意識しない。

import { firebaseConfig, workspaceId, defaultCategories, isCloudEnabled } from "./config.js";
import { uid } from "./util.js";

// 簡易イベントエミッタ
class Emitter {
  constructor() { this.handlers = {}; }
  on(type, fn) { (this.handlers[type] ||= []).push(fn); return () => this.off(type, fn); }
  off(type, fn) { this.handlers[type] = (this.handlers[type] || []).filter((f) => f !== fn); }
  emit(type, payload) { (this.handlers[type] || []).forEach((f) => f(payload)); }
}

// ---------------------------------------------------------------
// LocalStore
// ---------------------------------------------------------------
class LocalStore extends Emitter {
  constructor() {
    super();
    this.mode = "local";
    this.eventsKey = `schedule.events.${workspaceId}`;
    this.catKey = "schedule.categories";
    this.user = { name: "あなた", email: "local", uid: "local" };
  }

  async init() {
    if (!localStorage.getItem(this.catKey))
      localStorage.setItem(this.catKey, JSON.stringify(defaultCategories));
    if (!localStorage.getItem(this.eventsKey))
      localStorage.setItem(this.eventsKey, JSON.stringify([]));
    // 別タブでの変更も反映
    window.addEventListener("storage", (e) => {
      if (e.key === this.eventsKey || e.key === this.catKey) this.emit("change");
    });
    this.emit("change");
    this.emit("auth", this.user);
  }

  _read(key) { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } }
  _write(key, val) { localStorage.setItem(key, JSON.stringify(val)); this.emit("change"); }

  getEvents() { return this._read(this.eventsKey); }
  getCategories() { return this._read(this.catKey); }

  async addEvent(ev) {
    const list = this.getEvents();
    const now = new Date().toISOString();
    const full = { ...ev, id: uid(), createdBy: this.user.email, createdAt: now, updatedAt: now };
    list.push(full);
    this._write(this.eventsKey, list);
    return full;
  }
  async updateEvent(id, patch) {
    const list = this.getEvents().map((e) =>
      e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e);
    this._write(this.eventsKey, list);
  }
  async deleteEvent(id) {
    this._write(this.eventsKey, this.getEvents().filter((e) => e.id !== id));
  }
  async saveCategories(cats) { this._write(this.catKey, cats); }

  async signIn() { /* ローカルでは不要 */ }
  async signOut() { /* ローカルでは不要 */ }

  importData(data) {
    if (Array.isArray(data.events)) localStorage.setItem(this.eventsKey, JSON.stringify(data.events));
    if (Array.isArray(data.categories)) localStorage.setItem(this.catKey, JSON.stringify(data.categories));
    this.emit("change");
  }
}

// ---------------------------------------------------------------
// FirebaseStore（リアルタイム同期 + Google 認証）
// ---------------------------------------------------------------
class FirebaseStore extends Emitter {
  constructor() {
    super();
    this.mode = "cloud";
    this.events = [];
    this.categories = defaultCategories.slice();
    this.user = null;
    this._unsub = null;
  }

  async init() {
    const appMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
    const authMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
    const fsMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    this._auth = authMod;
    this._fs = fsMod;

    const app = appMod.initializeApp(firebaseConfig);
    this.db = fsMod.getFirestore(app);
    this.auth = authMod.getAuth(app);

    authMod.onAuthStateChanged(this.auth, (user) => {
      this.user = user
        ? { name: user.displayName || user.email, email: user.email, uid: user.uid }
        : null;
      this.emit("auth", this.user);
      this._subscribe();
    });
  }

  _col() {
    return this._fs.collection(this.db, "workspaces", workspaceId, "events");
  }

  _subscribe() {
    if (this._unsub) { this._unsub(); this._unsub = null; }
    if (!this.user) { this.events = []; this.emit("change"); return; }
    const q = this._fs.query(this._col());
    this._unsub = this._fs.onSnapshot(q, (snap) => {
      this.events = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      this.emit("change");
    }, (err) => {
      console.error("Firestore error:", err);
      this.emit("error", err);
    });
  }

  getEvents() { return this.events; }
  getCategories() { return this.categories; }

  async addEvent(ev) {
    const now = new Date().toISOString();
    const ref = await this._fs.addDoc(this._col(), {
      ...ev, createdBy: this.user?.email || "unknown", createdAt: now, updatedAt: now,
    });
    return { id: ref.id, ...ev };
  }
  async updateEvent(id, patch) {
    await this._fs.updateDoc(this._fs.doc(this._col(), id), {
      ...patch, updatedAt: new Date().toISOString(),
    });
  }
  async deleteEvent(id) {
    await this._fs.deleteDoc(this._fs.doc(this._col(), id));
  }
  async saveCategories(cats) { this.categories = cats; this.emit("change"); }

  async signIn() {
    const provider = new this._auth.GoogleAuthProvider();
    await this._auth.signInWithPopup(this.auth, provider);
  }
  async signOut() { await this._auth.signOut(this.auth); }

  async importData(data) {
    if (!Array.isArray(data.events)) return;
    for (const ev of data.events) {
      const { id, ...rest } = ev;
      await this._fs.addDoc(this._col(), rest);
    }
  }
}

// 公開: 環境に応じて適切なストアを生成
export function createStore() {
  return isCloudEnabled ? new FirebaseStore() : new LocalStore();
}
