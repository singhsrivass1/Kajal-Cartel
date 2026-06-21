"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SaveArtistButton({ artistSlug }: { artistSlug: string }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!session) {
      
      router.push("/auth?callbackUrl=/artists/" + artistSlug);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/user/save-artist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistSlug }),
      });

      if (res.ok) {
        setIsSaved(true);
      }
    } catch (error) {
      console.error("Failed to save artist");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-50">
      <button
        onClick={handleSave}
        disabled={isLoading || isSaved}
        className={`px-6 py-4 rounded-full shadow-2xl backdrop-blur-md transition-all flex items-center gap-3 font-medium tracking-wide border ${
          isSaved 
            ? "bg-[#C9A96E]/90 text-[#080808] border-[#C9A96E]" 
            : "bg-black/80 text-[#F0EBE0] border-gray-700 hover:border-[#C9A96E]"
        }`}
      >
        {isSaved ? (
          <>
            <span className="text-lg">✓</span> 
            Saved to Journey
          </>
        ) : isLoading ? (
          "Saving..."
        ) : (
          <>
            <span className="text-lg text-[#C9A96E]">♡</span> 
            Save Artist
          </>
        )}
      </button>
    </div>
  );
}