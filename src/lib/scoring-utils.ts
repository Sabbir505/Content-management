export function getScoreColorClass(score: number): string {
  if (score >= 90) return "text-green-400 bg-green-500/10 border-green-500/20";
  if (score >= 80) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  if (score >= 70) return "text-blue-400 bg-blue-500/10 border-blue-500/20";
  if (score >= 60) return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
  if (score >= 45) return "text-orange-400 bg-orange-500/10 border-orange-500/20";
  return "text-red-400 bg-red-500/10 border-red-500/20";
}

export function getGrade(score: number): "A" | "B+" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 80) return "B+";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}

export function getHealthScoreColor(score: number): string {
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-yellow-500";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
}

export function getHealthScoreBg(score: number): string {
  if (score >= 80) return "bg-green-500/10 border-green-500/20";
  if (score >= 60) return "bg-yellow-500/10 border-yellow-500/20";
  if (score >= 40) return "bg-orange-500/10 border-orange-500/20";
  return "bg-red-500/10 border-red-500/20";
}
