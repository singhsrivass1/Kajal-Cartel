"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SaveArtistButton({ artistSlug, initialSaved = false }: { artistSlug: string; initialSaved?: boolean }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [isSaved, setIsSaved] = useState(initialSaved);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async () => {
    if (!session) {
      router.push("/auth?callbackUrl=" + encodeURIComponent("/artists/" + artistSlug));
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = isSaved
        ? await fetch(`/api/user/save-artist?artistSlug=${encodeURIComponent(artistSlug)}`, { method: "DELETE" })
        : await fetch("/api/user/save-artist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ artistSlug }),
          });

      if (res.status === 401) {
        setError("Your session has expired. Please sign in again.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Could not update your saved artists.");
        return;
      }
      setIsSaved(!isSaved);
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50 flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isLoading}
        aria-pressed={isSaved}
        className={`px-6 py-4 rounded-full shadow-2xl backdrop-blur-md transition-all flex items-center gap-3 font-medium tracking-wide border ${
          isSaved
            ? "bg-[#C9A96E]/90 text-[#080808] border-[#C9A96E]"
            : "bg-black/80 text-[#F0EBE0] border-gray-700 hover:border-[#C9A96E]"
        }`}
      >
        {isLoading ? (
          isSaved ? "Removing..." : "Saving..."
        ) : isSaved ? (
          <>
            <span className="text-lg" aria-hidden="true">✓</span>
            Saved to Journey
          </>
        ) : (
          <>
            <span className="text-lg text-[#C9A96E]" aria-hidden="true">♡</span>
            Save Artist
          </>
        )}
      </button>
      {error && (
        <p role="alert" className="max-w-[260px] text-right text-xs bg-black/90 border border-[#3A2020] px-3 py-2 text-[#E08A7A]">
          {error}
        </p>
      )}
    </div>
  );
}
