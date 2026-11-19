export interface LeakRule {
  name: string;
  re: RegExp;
  allow?: (match: string) => boolean;
  onlyFixtures?: boolean;
}

export declare function ruleApplies(rule: Pick<LeakRule, 'onlyFixtures'>, relPath: string): boolean;

export declare const LEAK_RULES: LeakRule[];
export declare function findLeaks(text: string, relPath?: string): string[];
export function plausibleNik(m: string): boolean;
export function plausibleNip(m: string): boolean;
