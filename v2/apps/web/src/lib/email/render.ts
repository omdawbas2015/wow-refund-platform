/**
 * Renders an email template by replacing {{placeholder}} tokens with values.
 * Missing values render as empty strings.
 */
export function renderTemplate(
  template: string,
  variables: Record<string, string | number | undefined | null>,
): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const value = variables[key];
    if (value === null || value === undefined) return '';
    return String(value);
  });
}
