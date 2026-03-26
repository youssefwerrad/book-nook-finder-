import { useState, useCallback } from "react";
import { Search, X } from "lucide-react";

const searchTypes = [
  { value: "title", label: "Title" },
  { value: "author", label: "Author" },
  { value: "subject", label: "Genre" },
];

export default function SearchBar({ onSearch, onClear }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("title");

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      if (query.trim()) onSearch(query.trim(), type);
    },
    [query, type, onSearch]
  );

  const handleClear = () => {
    setQuery("");
    onClear?.();
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="flex gap-2 mb-3">
        {searchTypes.map((st) => (
          <button
            key={st.value}
            type="button"
            onClick={() => setType(st.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
              type === st.value
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search by ${type === "subject" ? "genre" : type}...`}
          className="w-full rounded-xl border border-border bg-card px-5 py-3.5 pr-24 text-foreground placeholder:text-muted-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all duration-200"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-12 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all duration-150"
        >
          <Search className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}
