"use client";

interface ScoreSuggestionsProps {
  suggestions: string[];
  onApply?: (suggestion: string) => void;
}

export function ScoreSuggestions({ suggestions, onApply }: ScoreSuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <h4 className="text-sm font-semibold text-gray-700 mb-2">
        💡 Suggestions
      </h4>
      <ul className="space-y-1.5">
        {suggestions.map((suggestion, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
            <span className="text-gray-400">·</span>
            <span>{suggestion}</span>
            {onApply && (
              <button
                className="text-xs text-blue-600 hover:text-blue-800 underline ml-auto"
                onClick={() => onApply(suggestion)}
              >
                Apply
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}