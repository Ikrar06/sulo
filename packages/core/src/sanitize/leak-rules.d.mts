export interface LeakRule {
  name: string;
  re: RegExp;
  allow?: (match: string) => boolean;
  onlyFixtures?: boolean;
  onlyUnder?: string;
}

export declare function ruleApplies(rule: Pick<LeakRule, 'onlyFixtures' | 'onlyUnder'>, relPath: string): boolean;

export declare const LEAK_RULES: LeakRule[];
export declare function findLeaks(text: string, relPath?: string): string[];
export function plausibleNik(m: string): boolean;
export function plausibleNip(m: string): boolean;
