export interface LeakRule {
  name: string;
  re: RegExp;
  allow?: (match: string) => boolean;
}

export declare const LEAK_RULES: LeakRule[];
export declare function findLeaks(text: string): string[];
