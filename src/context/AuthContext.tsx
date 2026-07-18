import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { get, ref, set, update } from 'firebase/database';
import { auth, database, googleProvider } from '../lib/firebase';
import { effectivePlanId, type PlanId } from '../lib/plans';
import {
  ensurePlanDefaults,
  isUserBanned,
  profileIsAdmin,
  syncExpiredBan,
  syncExpiredPlan,
  watchUserProfile,
  type UserProfile,
} from '../lib/rtdb';

interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  company?: string;
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  planId: PlanId;
  planExpiresAt: number | null;
  isAdmin: boolean;
  isBanned: boolean;
  loading: boolean;
  register: (payload: RegisterPayload) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapAuthError(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Этот email уже зарегистрирован. Войдите в аккаунт.';
    case 'auth/invalid-email':
      return 'Некорректный email.';
    case 'auth/weak-password':
      return 'Пароль слишком слабый. Минимум 6 символов.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Неверный email или пароль.';
    case 'auth/popup-closed-by-user':
      return 'Окно Google было закрыто. Попробуйте ещё раз.';
    case 'auth/popup-blocked':
      return 'Браузер заблокировал окно Google. Разрешите всплывающие окна.';
    case 'auth/cancelled-popup-request':
      return 'Запрос Google отменён.';
    case 'auth/account-exists-with-different-credential':
      return 'Аккаунт с этим email уже есть. Войдите через email/пароль.';
    case 'auth/unauthorized-domain':
      return 'Домен не авторизован в Firebase. Добавьте его в Authentication → Settings.';
    case 'auth/operation-not-allowed':
      return 'Этот способ входа отключён в Firebase Console.';
    case 'auth/too-many-requests':
      return 'Слишком много попыток. Попробуйте позже.';
    case 'auth/network-request-failed':
      return 'Ошибка сети. Проверьте подключение.';
    default:
      return 'Что-то пошло не так. Попробуйте ещё раз.';
  }
}

function getErrorCode(err: unknown): string {
  if (typeof err === 'object' && err && 'code' in err) {
    return String((err as { code: string }).code);
  }
  return '';
}

async function upsertUserProfile(user: User, extras?: { company?: string | null; provider?: string }) {
  const userRef = ref(database, `users/${user.uid}`);
  const snapshot = await get(userRef);
  const now = Date.now();
  const provider =
    extras?.provider ||
    user.providerData[0]?.providerId ||
    'password';

  if (!snapshot.exists()) {
    await set(userRef, {
      uid: user.uid,
      name: user.displayName || '',
      email: (user.email || '').toLowerCase(),
      photoURL: user.photoURL || null,
      company: extras?.company ?? null,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      provider,
      plan: 'free',
      planUpdatedAt: now,
      isAdmin: false,
    });
    return;
  }

  const existing = snapshot.val() as UserProfile;
  const patch: Record<string, unknown> = {
    name: user.displayName || existing.name || '',
    email: (user.email || '').toLowerCase(),
    photoURL: user.photoURL || existing.photoURL || null,
    updatedAt: now,
    lastLoginAt: now,
    provider,
  };
  if (!existing.plan) {
    patch.plan = 'free';
    patch.planUpdatedAt = now;
  }
  if (typeof existing.isAdmin !== 'boolean') {
    patch.isAdmin = existing.admin === true;
  }
  await update(userRef, patch);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;
    const unsub = onAuthStateChanged(auth, (next) => {
      unsubProfile?.();
      unsubProfile = undefined;
      setUser(next);
      if (!next) {
        setProfile(null);
        setLoading(false);
        return;
      }
      void ensurePlanDefaults(next.uid);
      unsubProfile = watchUserProfile(next.uid, (p) => {
        setProfile(p);
        setLoading(false);
        if (p) {
          void syncExpiredPlan(next.uid, p).catch(() => {});
          void syncExpiredBan(next.uid, p).catch(() => {});
        }
      });
    });
    return () => {
      unsub();
      unsubProfile?.();
    };
  }, []);

  const register = useCallback(async ({ name, email, password, company }: RegisterPayload) => {
    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(credential.user, { displayName: name.trim() });
      await upsertUserProfile(credential.user, {
        company: company?.trim() || null,
        provider: 'password',
      });
    } catch (err: unknown) {
      throw new Error(mapAuthError(getErrorCode(err)));
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      await upsertUserProfile(credential.user, { provider: 'password' });
    } catch (err: unknown) {
      throw new Error(mapAuthError(getErrorCode(err)));
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const info = getAdditionalUserInfo(result);
      await upsertUserProfile(result.user, {
        provider: 'google.com',
        company: null,
      });
      void info;
    } catch (err: unknown) {
      throw new Error(mapAuthError(getErrorCode(err)));
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const planId: PlanId = effectivePlanId(profile ?? {});
  const planExpiresAt =
    planId !== 'free' && typeof profile?.planExpiresAt === 'number' ? profile.planExpiresAt : null;
  const isBanned = isUserBanned(profile);

  const value = useMemo(
    () => ({
      user,
      profile,
      planId,
      planExpiresAt,
      isAdmin: profileIsAdmin(profile),
      isBanned,
      loading,
      register,
      login,
      loginWithGoogle,
      logout,
    }),
    [user, profile, planId, planExpiresAt, isBanned, loading, register, login, loginWithGoogle, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
