/** Internal URLs also work when Sentinel is mounted below another site's path. */
export function appPath(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return path.startsWith("/") && !path.startsWith("//") ? `${base}${path}` : path;
}
