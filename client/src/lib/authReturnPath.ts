export function resultSignInHref(pathname: string): string {
  return /^\/app\/results\/[A-Za-z0-9_-]+$/.test(pathname)
    ? `/sign-in?next=${encodeURIComponent(pathname)}`
    : "/sign-in";
}
