export function classifyEducationRisk(text: string) {
  const value = (text || '').toLowerCase();
  if (/硕士|博士|master|phd/.test(value)) return 'VERY_HIGH';
  if (/统招本科|全日制本科|第一学历|985|211|硬性本科/.test(value)) return 'HIGH';
  if (/本科|bachelor/.test(value)) return 'MEDIUM';
  return 'LOW';
}

export function classifyVerification(input: {blocked?: boolean; closedSignal?: boolean; recruiterConfirmed?: boolean; pageExists?: boolean; actionAvailable?: boolean}) {
  if (input.blocked) return 'BLOCKED';
  if (input.closedSignal) return 'CLOSED';
  if (input.recruiterConfirmed) return 'RECRUITER_CONFIRMED';
  if (input.pageExists && input.actionAvailable) return 'LIVE_CONFIRMED';
  if (input.pageExists) return 'LISTED';
  return 'UNKNOWN';
}

export function evaluateMatch(text: string, terms: Array<{term:string; matchType:string; weight:number; active:boolean}>) {
  const haystack = (text || '').toLowerCase();
  let score = 50; const matched:any[]=[]; const risks:any[]=[]; const excludedTerms:any[]=[];
  for (const t of terms.filter(x => x.active && haystack.includes(x.term.toLowerCase()))) {
    if (t.matchType === 'EXCLUDE') excludedTerms.push(t);
    else if (t.matchType === 'RISK' || t.matchType === 'STRONG_RISK') { score -= Math.abs(t.weight); risks.push(t); }
    else { score += Math.abs(t.weight); matched.push(t); }
  }
  const ruleScore = Math.max(0, Math.min(100, score));
  const excluded = excludedTerms.length > 0;
  return { ruleScore, finalScore: excluded ? 0 : ruleScore, excluded, matched, risks, excludedTerms };
}
