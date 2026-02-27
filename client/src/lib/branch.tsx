import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Branch } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";

interface BranchContextType {
  branches: Branch[];
  selectedBranch: Branch | null;
  selectedBranchId: string | null;
  setSelectedBranchId: (id: string | null) => void;
  isLoading: boolean;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

const STORAGE_KEY = "last_branch_id";

function getBranchFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("branch");
}

function setBranchInUrl(branchId: string | null) {
  const url = new URL(window.location.href);
  if (branchId) {
    url.searchParams.set("branch", branchId);
  } else {
    url.searchParams.delete("branch");
  }
  window.history.replaceState({}, "", url.toString());
}

export function BranchProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(() => {
    const urlBranch = getBranchFromUrl();
    if (urlBranch) return urlBranch;
    return localStorage.getItem(STORAGE_KEY);
  });

  const { data: branches = [], isLoading } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    enabled: isAuthenticated,
  });

  const selectedBranch = branches.find((b) => b.id === selectedBranchId) || null;

  useEffect(() => {
    if (!isLoading && branches.length > 0) {
      // If selectedBranchId is set but doesn't match any loaded branch (e.g. stale from previous user),
      // OR if no branch is selected yet, auto-select the first active branch
      const branchExists = branches.some((b) => b.id === selectedBranchId);
      if (!selectedBranchId || !branchExists) {
        const firstActive = branches.find((b) => b.isActive);
        if (firstActive) {
          setSelectedBranchIdState(firstActive.id);
          localStorage.setItem(STORAGE_KEY, firstActive.id);
        }
      }
    }
  }, [branches, isLoading, selectedBranchId]);

  useEffect(() => {
    if (selectedBranchId) {
      localStorage.setItem(STORAGE_KEY, selectedBranchId);
      setBranchInUrl(selectedBranchId);
    }
  }, [selectedBranchId]);

  const setSelectedBranchId = (id: string | null) => {
    setSelectedBranchIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
      setBranchInUrl(id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      setBranchInUrl(null);
    }
    // Invalidate all cached queries so they refetch with the new branch context
    queryClient.invalidateQueries();
  };

  return (
    <BranchContext.Provider
      value={{
        branches,
        selectedBranch,
        selectedBranchId,
        setSelectedBranchId,
        isLoading,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error("useBranch must be used within a BranchProvider");
  }
  return context;
}
