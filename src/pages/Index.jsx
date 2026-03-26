import { useState, useCallback } from "react";
import { BookOpen } from "lucide-react";
import SearchBar from "@/components/SearchBar";
import BookGrid from "@/components/BookGrid";
import BookCard from "@/components/BookCard";
import BookModal from "@/components/BookModal";
import { useTrending, fetchBooks } from "@/hooks/useBookSearch";

const GENRES = ["Fiction", "Mystery", "Fantasy", "Science", "History", "Romance", "Biography", "Thriller"];

export default function Index() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("title");
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);
  const [allBooks, setAllBooks] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalFound, setTotalFound] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  const { data: trending } = useTrending();

  const handleSearch = useCallback(async (query, type) => {
    setSearchQuery(query);
    setSearchType(type);
    setHasSearched(true);
    setPage(1);
    setAllBooks([]);
    setIsLoading(true);
    setIsError(false);
    try {
      const data = await fetchBooks(query, type, 1);
      setAllBooks(data.books ?? []);
      setTotalFound(data.total ?? 0);
      setTotalPages(data.totalPages ?? 0);
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleClear = useCallback(() => {
    setHasSearched(false);
    setAllBooks([]);
    setTotalFound(0);
    setTotalPages(0);
    setPage(1);
    setSearchQuery("");
    setIsError(false);
  }, []);

  const handleGenre = useCallback(
    (genre) => handleSearch(genre, "subject"),
    [handleSearch]
  );

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    try {
      const data = await fetchBooks(searchQuery, searchType, nextPage);
      setAllBooks((prev) => [...prev, ...(data.books ?? [])]);
      setPage(nextPage);
    } finally {
      setIsLoadingMore(false);
    }
  }, [page, searchQuery, searchType, isLoadingMore]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="pt-16 pb-12 px-6 text-center">
        <div className="flex items-center justify-center gap-3 mb-4 opacity-0 animate-fade-up">
          <BookOpen className="w-8 h-8 text-primary" strokeWidth={1.5} />
          <h1
            className="text-3xl md:text-4xl font-serif font-bold text-foreground tracking-tight"
            style={{ lineHeight: 1.1 }}
          >
            Bookwise
          </h1>
        </div>
        <p
          className="text-muted-foreground max-w-md mx-auto mb-10 opacity-0 animate-fade-up"
          style={{ animationDelay: "100ms" }}
        >
          Explore millions of books from the Open Library. Search by title, author, or genre.
        </p>
        <div className="opacity-0 animate-fade-up" style={{ animationDelay: "200ms" }}>
          <SearchBar onSearch={handleSearch} onClear={handleClear} />

          {/* Genre pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {GENRES.map((genre) => (
              <button
                key={genre}
                onClick={() => handleGenre(genre)}
                className="px-3 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-150"
              >
                {genre}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-20">
        {/* Search results */}
        <BookGrid
          books={allBooks}
          isLoading={isLoading && hasSearched && allBooks.length === 0}
          isError={isError}
          hasSearched={hasSearched}
          totalFound={totalFound}
          onBookClick={setSelectedBook}
          onLoadMore={handleLoadMore}
          hasMore={page < totalPages}
          isLoadingMore={isLoadingMore}
        />

        {/* Trending — shown when no search has been made */}
        {!hasSearched && trending && (
          <section className="opacity-0 animate-fade-up" style={{ animationDelay: "300ms" }}>
            <div className="flex items-baseline gap-2 mb-6">
              <h2 className="text-lg font-serif font-bold text-foreground">Trending in</h2>
              <span className="text-lg font-serif font-bold text-primary capitalize">
                {trending.subject}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-4">
              {trending.books.map((book, i) => (
                <BookCard key={book.key} book={book} index={i} onClick={setSelectedBook} />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Book detail modal */}
      {selectedBook && (
        <BookModal book={selectedBook} onClose={() => setSelectedBook(null)} />
      )}
    </div>
  );
}
