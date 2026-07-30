"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { VoiceFingerprint } from "@/lib/voice-analysis";

interface VoiceFingerprintCardProps {
  fingerprint: VoiceFingerprint;
  version: number;
  onEdit: () => void;
}

function FingerprintItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-[#2a2a2a] last:border-0">
      <span className="text-sm text-[#888]">{label}</span>
      <span className="text-sm font-medium text-white text-right">{value}</span>
    </div>
  );
}

export function VoiceFingerprintCard({ fingerprint, version, onEdit }: VoiceFingerprintCardProps) {
  return (
    <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-white">Voice Fingerprint</CardTitle>
          <p className="text-sm text-[#666]">Version {version}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          className="bg-[#0a0a0a] border-[#2a2a2a] text-[#ccc] hover:bg-[#2a2a2a] hover:text-white hover:border-[#3a3a3a] focus-visible:ring-2 focus-visible:ring-[#3a3a3a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] transition-colors"
        >
          Edit Manually
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <FingerprintItem label="Hook Style" value={fingerprint.hookStyle} />
        <FingerprintItem label="Sentence Length" value={fingerprint.sentenceLength} />
        <FingerprintItem label="Tone" value={fingerprint.tone} />
        <FingerprintItem label="Vocabulary" value={fingerprint.vocabulary} />
        <FingerprintItem label="Humor Level" value={fingerprint.humorLevel} />
        <FingerprintItem label="CTA Pattern" value={fingerprint.ctaPattern} />

        {fingerprint.sampleSentences && fingerprint.sampleSentences.length > 0 && (
          <div className="pt-4 border-t border-[#2a2a2a]">
            <p className="text-sm font-medium text-[#ccc] mb-2">Sample Sentences</p>
            <div className="space-y-2">
              {fingerprint.sampleSentences.map((sentence, i) => (
                <p key={i} className="text-sm text-[#888] italic">
                  &quot;{sentence}&quot;
                </p>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
