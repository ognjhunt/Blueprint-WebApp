import type { User as FirebaseUser } from "firebase/auth";

export async function withFirebaseAuthHeaders(
  currentUser: FirebaseUser | null | undefined,
  headers: Record<string, string> = {},
): Promise<Record<string, string>> {
  if (!currentUser) {
    return headers;
  }

  const token = await currentUser.getIdToken();
  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  };
}
